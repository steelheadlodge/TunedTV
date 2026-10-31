import ExpoModulesCore
import Foundation
import Network
import Security

/// Raw home-network primitives for "Tune my TV". Protocols (HTTP, WebSocket, TV pairing) are
/// implemented by the web app on top of these, so new TV brands don't need an app build. The JS
/// bridge (src/lib/netBridge.ts) only lets the tunedtv.com page reach private IPv4 addresses.
public final class TvNetModule: Module {
  private let queue = DispatchQueue(label: "com.tunedtv.tvnet")
  private var sockets: [String: NWConnection] = [:]
  private var counter = 0
  private var searches: [MdnsSearch] = []

  public func definition() -> ModuleDefinition {
    Name("TvNet")

    Events("onTcpData", "onTcpClose")

    AsyncFunction("tcpOpen") { (opts: [String: Any], promise: Promise) in
      self.queue.async { self.open(opts, promise) }
    }

    AsyncFunction("tcpWrite") { (id: String, base64: String, promise: Promise) in
      self.queue.async {
        guard let conn = self.sockets[id] else {
          promise.reject("E_CLOSED", "Socket is closed")
          return
        }
        guard let data = Data(base64Encoded: base64) else {
          promise.reject("E_ARGS", "Bad data")
          return
        }
        conn.send(content: data, completion: .contentProcessed { error in
          if let error { promise.reject("E_WRITE", error.debugDescription) } else { promise.resolve(nil) }
        })
      }
    }

    AsyncFunction("tcpClose") { (id: String) in
      self.queue.async { self.sockets[id]?.cancel() }
    }

    AsyncFunction("closeAll") {
      self.queue.async {
        for conn in self.sockets.values { conn.cancel() }
      }
    }

    AsyncFunction("scan") { (opts: [String: Any], promise: Promise) in
      self.queue.async { self.scan(opts, promise) }
    }

    AsyncFunction("udp") { (opts: [String: Any], promise: Promise) in
      self.queue.async { self.udp(opts, promise) }
    }

    AsyncFunction("mdns") { (opts: [String: Any], promise: Promise) in
      DispatchQueue.main.async { self.mdns(opts, promise) }
    }

    OnDestroy {
      self.queue.async {
        for conn in self.sockets.values { conn.cancel() }
      }
    }
  }

  // MARK: TCP / TLS

  private final class CertBox { var der: Data? }

  private func open(_ opts: [String: Any], _ promise: Promise) {
    guard let host = opts["host"] as? String, let portNum = (opts["port"] as? NSNumber)?.intValue,
      portNum > 0, portNum < 65536, let port = NWEndpoint.Port(rawValue: UInt16(portNum))
    else {
      promise.reject("E_ARGS", "Bad host or port")
      return
    }
    let timeoutMs = (opts["timeoutMs"] as? NSNumber)?.intValue ?? 6000
    let tcp = NWProtocolTCP.Options()
    tcp.noDelay = true
    tcp.connectionTimeout = max(1, timeoutMs / 1000)
    let box = CertBox()
    var tlsOptions: NWProtocolTLS.Options?
    if (opts["tls"] as? Bool) == true {
      let tls = NWProtocolTLS.Options()
      let sec = tls.securityProtocolOptions
      // TVs use self-signed certificates; the leaf is kept because some pairing protocols
      // (Android TV) hash the TV's public key.
      sec_protocol_options_set_verify_block(sec, { _, trust, complete in
        let ref = sec_trust_copy_ref(trust).takeRetainedValue()
        if let chain = SecTrustCopyCertificateChain(ref) as? [SecCertificate], let leaf = chain.first {
          box.der = SecCertificateCopyData(leaf) as Data
        }
        complete(true)
      }, queue)
      if let p12b64 = opts["clientP12"] as? String {
        guard let identity = importIdentity(p12b64, opts["p12Password"] as? String ?? "") else {
          promise.reject("E_CERT", "Client certificate could not be loaded")
          return
        }
        sec_protocol_options_set_local_identity(sec, identity)
      }
      tlsOptions = tls
    }
    let params = NWParameters(tls: tlsOptions, tcp: tcp)
    let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: params)
    counter += 1
    let id = "s\(counter)"
    var settled = false
    let timer = DispatchWorkItem {
      if settled { return }
      settled = true
      conn.cancel()
      promise.reject("E_TIMEOUT", "Timed out")
    }
    queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs), execute: timer)
    conn.stateUpdateHandler = { [weak self] state in
      guard let self else { return }
      switch state {
      case .ready:
        if settled { return }
        settled = true
        timer.cancel()
        self.sockets[id] = conn
        promise.resolve(["id": id, "peerCert": box.der?.base64EncodedString() as Any])
        self.receive(id, conn)
      case .waiting(let error):
        if settled { return }
        settled = true
        timer.cancel()
        conn.cancel()
        promise.reject(Self.localNetworkDenied(conn) ? "E_DENIED" : "E_CONNECT", error.debugDescription)
      case .failed(let error):
        if !settled {
          settled = true
          timer.cancel()
          promise.reject("E_CONNECT", error.debugDescription)
        } else {
          self.closed(id, error.debugDescription)
        }
      case .cancelled:
        if settled { self.closed(id, nil) }
      default:
        break
      }
    }
    conn.start(queue: queue)
  }

  private func receive(_ id: String, _ conn: NWConnection) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 65536) { [weak self] data, _, isComplete, error in
      guard let self else { return }
      if let data, !data.isEmpty {
        self.sendEvent("onTcpData", ["id": id, "data": data.base64EncodedString()])
      }
      if isComplete || error != nil {
        conn.cancel()
        self.closed(id, error?.debugDescription)
        return
      }
      self.receive(id, conn)
    }
  }

  private func closed(_ id: String, _ error: String?) {
    guard sockets.removeValue(forKey: id) != nil else { return }
    sendEvent("onTcpClose", ["id": id, "error": error as Any])
  }

  private func importIdentity(_ base64: String, _ password: String) -> sec_identity_t? {
    guard let p12 = Data(base64Encoded: base64) else { return nil }
    var items: CFArray?
    let status = SecPKCS12Import(p12 as CFData, [kSecImportExportPassphrase as String: password] as CFDictionary, &items)
    guard status == errSecSuccess, let list = items as? [[String: Any]],
      let raw = list.first?[kSecImportItemIdentity as String]
    else { return nil }
    // swiftlint:disable:next force_cast
    return sec_identity_create(raw as! SecIdentity)
  }

  private static func localNetworkDenied(_ conn: NWConnection) -> Bool {
    if #available(iOS 16.0, *) {
      return conn.currentPath?.unsatisfiedReason == .localNetworkDenied
    }
    return false
  }

  // MARK: Port scan

  /// Tries every host × port pair and returns the ones that accept a TCP connection.
  private func scan(_ opts: [String: Any], _ promise: Promise) {
    let hosts = (opts["hosts"] as? [String]) ?? []
    let ports = ((opts["ports"] as? [NSNumber]) ?? []).map(\.intValue).filter { $0 > 0 && $0 < 65536 }
    let timeoutMs = (opts["timeoutMs"] as? NSNumber)?.intValue ?? 700
    let concurrency = max(1, min(128, (opts["concurrency"] as? NSNumber)?.intValue ?? 64))
    var jobs: [(String, Int)] = []
    for h in hosts { for p in ports { jobs.append((h, p)) } }
    if jobs.isEmpty {
      promise.resolve(["open": [] as [Any], "denied": false])
      return
    }
    var next = 0
    var running = 0
    var open: [[String: Any]] = []
    var denied = false
    var finished = false

    func launch() {
      while running < concurrency && next < jobs.count {
        let (host, port) = jobs[next]
        next += 1
        running += 1
        probe(host, port, timeoutMs) { ok, wasDenied in
          running -= 1
          if ok { open.append(["host": host, "port": port]) }
          if wasDenied { denied = true }
          if next < jobs.count {
            launch()
          } else if running == 0 && !finished {
            finished = true
            promise.resolve(["open": open, "denied": denied])
          }
        }
      }
    }
    launch()
  }

  private func probe(_ host: String, _ port: Int, _ timeoutMs: Int, _ done: @escaping (Bool, Bool) -> Void) {
    guard let p = NWEndpoint.Port(rawValue: UInt16(port)) else {
      done(false, false)
      return
    }
    let tcp = NWProtocolTCP.Options()
    tcp.connectionTimeout = max(1, timeoutMs / 1000)
    let conn = NWConnection(host: NWEndpoint.Host(host), port: p, using: NWParameters(tls: nil, tcp: tcp))
    var settled = false
    let finish: (Bool, Bool) -> Void = { ok, wasDenied in
      if settled { return }
      settled = true
      conn.stateUpdateHandler = nil
      conn.cancel()
      done(ok, wasDenied)
    }
    queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) { finish(false, false) }
    conn.stateUpdateHandler = { state in
      switch state {
      case .ready: finish(true, false)
      case .waiting: finish(false, Self.localNetworkDenied(conn))
      case .failed: finish(false, false)
      default: break
      }
    }
    conn.start(queue: queue)
  }

  // MARK: UDP

  /// Sends one datagram and collects replies until the timeout (e.g. a unicast SSDP M-SEARCH).
  private func udp(_ opts: [String: Any], _ promise: Promise) {
    guard let host = opts["host"] as? String, let portNum = (opts["port"] as? NSNumber)?.intValue,
      let port = NWEndpoint.Port(rawValue: UInt16(max(1, min(65535, portNum)))),
      let data = Data(base64Encoded: opts["data"] as? String ?? "")
    else {
      promise.reject("E_ARGS", "Bad host, port or data")
      return
    }
    let timeoutMs = (opts["timeoutMs"] as? NSNumber)?.intValue ?? 1500
    let maxReplies = (opts["maxReplies"] as? NSNumber)?.intValue ?? 8
    let conn = NWConnection(host: NWEndpoint.Host(host), port: port, using: .udp)
    var replies: [String] = []
    var settled = false
    let finish = {
      if settled { return }
      settled = true
      conn.cancel()
      promise.resolve(["replies": replies])
    }
    func read() {
      conn.receiveMessage { data, _, _, error in
        if let data, !data.isEmpty { replies.append(data.base64EncodedString()) }
        if error != nil || replies.count >= maxReplies {
          finish()
          return
        }
        if !settled { read() }
      }
    }
    conn.stateUpdateHandler = { state in
      switch state {
      case .ready:
        conn.send(content: data, completion: .contentProcessed { _ in })
        read()
      case .failed, .waiting:
        finish()
      default:
        break
      }
    }
    queue.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) { finish() }
    conn.start(queue: queue)
  }

  // MARK: Bonjour

  private func mdns(_ opts: [String: Any], _ promise: Promise) {
    guard let type = opts["type"] as? String, type.range(of: #"^_[a-z0-9-]{1,30}\._(tcp|udp)$"#, options: .regularExpression) != nil
    else {
      promise.reject("E_ARGS", "Bad service type")
      return
    }
    let timeoutMs = (opts["timeoutMs"] as? NSNumber)?.intValue ?? 3000
    let search = MdnsSearch()
    searches.append(search)
    search.start(type: type, timeoutMs: timeoutMs) { [weak self] result in
      self?.searches.removeAll { $0 === search }
      promise.resolve(result)
    }
  }
}

/// One NetServiceBrowser run: browse, resolve each service to an IPv4 address, stop at the timeout.
private final class MdnsSearch: NSObject, NetServiceBrowserDelegate, NetServiceDelegate {
  private let browser = NetServiceBrowser()
  private var services: [NetService] = []
  private var results: [[String: Any]] = []
  private var error: String?
  private var done: (([String: Any]) -> Void)?

  func start(type: String, timeoutMs: Int, done: @escaping ([String: Any]) -> Void) {
    self.done = done
    browser.delegate = self
    browser.searchForServices(ofType: "\(type).", inDomain: "local.")
    DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(timeoutMs)) { self.finish() }
  }

  private func finish() {
    guard let done else { return }
    self.done = nil
    browser.stop()
    for s in services { s.stop() }
    done(["services": results, "error": error as Any])
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didFind service: NetService, moreComing: Bool) {
    services.append(service)
    service.delegate = self
    service.resolve(withTimeout: 2)
  }

  func netServiceBrowser(_ browser: NetServiceBrowser, didNotSearch errorDict: [String: NSNumber]) {
    error = errorDict.map { "\($0.key)=\($0.value)" }.joined(separator: ",")
    finish()
  }

  func netServiceDidResolveAddress(_ sender: NetService) {
    guard let ip = sender.addresses?.compactMap(Self.ipv4).first else { return }
    var txt: [String: String] = [:]
    if let record = sender.txtRecordData() {
      for (k, v) in NetService.dictionary(fromTXTRecord: record) {
        txt[k] = String(data: v, encoding: .utf8) ?? ""
      }
    }
    results.removeAll { ($0["name"] as? String) == sender.name }
    results.append(["name": sender.name, "host": ip, "port": sender.port, "txt": txt])
  }

  private static func ipv4(_ data: Data) -> String? {
    data.withUnsafeBytes { (raw: UnsafeRawBufferPointer) -> String? in
      guard let base = raw.baseAddress, raw.count >= MemoryLayout<sockaddr_in>.size else { return nil }
      let sa = base.assumingMemoryBound(to: sockaddr.self)
      guard sa.pointee.sa_family == sa_family_t(AF_INET) else { return nil }
      var addr = base.assumingMemoryBound(to: sockaddr_in.self).pointee.sin_addr
      var buf = [CChar](repeating: 0, count: Int(INET_ADDRSTRLEN))
      guard inet_ntop(AF_INET, &addr, &buf, socklen_t(INET_ADDRSTRLEN)) != nil else { return nil }
      return String(cString: buf)
    }
  }
}
