package com.tunedtv.tvnet

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.os.Handler
import android.os.Looper
import android.util.Base64
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.ByteArrayInputStream
import java.io.InputStream
import java.io.OutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.Inet4Address
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Socket
import java.net.SocketTimeoutException
import java.security.KeyStore
import java.security.SecureRandom
import java.security.cert.X509Certificate
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import javax.net.ssl.KeyManagerFactory
import javax.net.ssl.SSLContext
import javax.net.ssl.SSLSocket
import javax.net.ssl.X509TrustManager

/**
 * Raw home-network primitives for "Tune my TV". Protocols (HTTP, WebSocket, TV pairing) are
 * implemented by the web app on top of these, so new TV brands don't need an app build. The JS
 * bridge (src/lib/netBridge.ts) only lets the tunedtv.com page reach private IPv4 addresses.
 */
class TvNetModule : Module() {
  private class Sock(val socket: Socket, val input: InputStream, val output: OutputStream) {
    val writer = Executors.newSingleThreadExecutor()
  }

  private val sockets = ConcurrentHashMap<String, Sock>()
  private val counter = AtomicInteger(0)
  private val io = Executors.newCachedThreadPool()

  private val trustAll = object : X509TrustManager {
    override fun checkClientTrusted(chain: Array<X509Certificate>, authType: String) {}
    override fun checkServerTrusted(chain: Array<X509Certificate>, authType: String) {}
    override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
  }

  override fun definition() = ModuleDefinition {
    Name("TvNet")

    Events("onTcpData", "onTcpClose")

    AsyncFunction("tcpOpen") { opts: Map<String, Any?>, promise: Promise ->
      io.execute { open(opts, promise) }
    }

    AsyncFunction("tcpWrite") { id: String, data: String, promise: Promise ->
      val s = sockets[id]
      if (s == null) {
        promise.reject("E_CLOSED", "Socket is closed", null)
        return@AsyncFunction
      }
      val bytes = try {
        Base64.decode(data, Base64.DEFAULT)
      } catch (e: IllegalArgumentException) {
        promise.reject("E_ARGS", "Bad data", e)
        return@AsyncFunction
      }
      s.writer.execute {
        try {
          s.output.write(bytes)
          s.output.flush()
          promise.resolve(null)
        } catch (e: Exception) {
          promise.reject("E_WRITE", e.message ?: "Write failed", e)
          close(id, e.message)
        }
      }
    }

    AsyncFunction("tcpClose") { id: String ->
      close(id, null)
    }

    AsyncFunction("closeAll") {
      for (id in sockets.keys.toList()) close(id, null)
    }

    AsyncFunction("scan") { opts: Map<String, Any?>, promise: Promise ->
      io.execute { scan(opts, promise) }
    }

    AsyncFunction("udp") { opts: Map<String, Any?>, promise: Promise ->
      io.execute { udp(opts, promise) }
    }

    AsyncFunction("mdns") { opts: Map<String, Any?>, promise: Promise ->
      mdns(opts, promise)
    }

    OnDestroy {
      for (id in sockets.keys.toList()) close(id, null)
    }
  }

  private fun num(v: Any?): Int? = (v as? Number)?.toInt()

  // TCP / TLS

  private fun open(opts: Map<String, Any?>, promise: Promise) {
    val host = opts["host"] as? String
    val port = num(opts["port"])
    if (host == null || port == null || port !in 1..65535) {
      promise.reject("E_ARGS", "Bad host or port", null)
      return
    }
    val timeoutMs = num(opts["timeoutMs"]) ?: 6000
    try {
      val raw = Socket()
      raw.tcpNoDelay = true
      raw.connect(InetSocketAddress(host, port), timeoutMs)
      var socket: Socket = raw
      var peerCert: String? = null
      if (opts["tls"] == true) {
        val keyManagers = (opts["clientP12"] as? String)?.let { p12 ->
          val pass = ((opts["p12Password"] as? String) ?: "").toCharArray()
          val ks = KeyStore.getInstance("PKCS12")
          ks.load(ByteArrayInputStream(Base64.decode(p12, Base64.DEFAULT)), pass)
          val kmf = KeyManagerFactory.getInstance(KeyManagerFactory.getDefaultAlgorithm())
          kmf.init(ks, pass)
          kmf.keyManagers
        }
        val ctx = SSLContext.getInstance("TLS")
        ctx.init(keyManagers, arrayOf(trustAll), SecureRandom())
        val ssl = ctx.socketFactory.createSocket(raw, host, port, true) as SSLSocket
        ssl.soTimeout = timeoutMs
        ssl.startHandshake()
        ssl.soTimeout = 0
        peerCert = ssl.session.peerCertificates.firstOrNull()?.encoded?.let {
          Base64.encodeToString(it, Base64.NO_WRAP)
        }
        socket = ssl
      }
      val id = "s${counter.incrementAndGet()}"
      val sock = Sock(socket, socket.getInputStream(), socket.getOutputStream())
      sockets[id] = sock
      promise.resolve(mapOf("id" to id, "peerCert" to peerCert))
      io.execute { readLoop(id, sock) }
    } catch (e: SocketTimeoutException) {
      promise.reject("E_TIMEOUT", "Timed out", e)
    } catch (e: Exception) {
      promise.reject("E_CONNECT", e.message ?: "Connect failed", e)
    }
  }

  private fun readLoop(id: String, sock: Sock) {
    val buf = ByteArray(65536)
    try {
      while (true) {
        val n = sock.input.read(buf)
        if (n < 0) break
        if (n > 0) {
          sendEvent("onTcpData", mapOf("id" to id, "data" to Base64.encodeToString(buf, 0, n, Base64.NO_WRAP)))
        }
      }
      close(id, null)
    } catch (e: Exception) {
      close(id, e.message)
    }
  }

  private fun close(id: String, error: String?) {
    val s = sockets.remove(id) ?: return
    try {
      s.socket.close()
    } catch (_: Exception) {
    }
    s.writer.shutdown()
    sendEvent("onTcpClose", mapOf("id" to id, "error" to error))
  }

  // Port scan

  private fun scan(opts: Map<String, Any?>, promise: Promise) {
    val hosts = (opts["hosts"] as? List<*>)?.filterIsInstance<String>() ?: emptyList()
    val ports = (opts["ports"] as? List<*>)?.mapNotNull { num(it) }?.filter { it in 1..65535 } ?: emptyList()
    val timeoutMs = num(opts["timeoutMs"]) ?: 700
    val concurrency = (num(opts["concurrency"]) ?: 64).coerceIn(1, 128)
    val pool = Executors.newFixedThreadPool(concurrency)
    val open = java.util.Collections.synchronizedList(mutableListOf<Map<String, Any>>())
    for (h in hosts) for (p in ports) {
      pool.execute {
        try {
          Socket().use { s ->
            s.connect(InetSocketAddress(h, p), timeoutMs)
            open.add(mapOf("host" to h, "port" to p))
          }
        } catch (_: Exception) {
        }
      }
    }
    pool.shutdown()
    pool.awaitTermination(120, TimeUnit.SECONDS)
    promise.resolve(mapOf("open" to open.toList(), "denied" to false))
  }

  // UDP

  private fun udp(opts: Map<String, Any?>, promise: Promise) {
    val host = opts["host"] as? String
    val port = num(opts["port"])
    val data = (opts["data"] as? String)?.let {
      try {
        Base64.decode(it, Base64.DEFAULT)
      } catch (_: Exception) {
        null
      }
    }
    if (host == null || port == null || port !in 1..65535 || data == null) {
      promise.reject("E_ARGS", "Bad host, port or data", null)
      return
    }
    val timeoutMs = num(opts["timeoutMs"]) ?: 1500
    val maxReplies = num(opts["maxReplies"]) ?: 8
    val replies = mutableListOf<String>()
    try {
      DatagramSocket().use { s ->
        s.broadcast = opts["broadcast"] == true
        s.send(DatagramPacket(data, data.size, InetAddress.getByName(host), port))
        val deadline = System.currentTimeMillis() + timeoutMs
        val buf = ByteArray(65536)
        while (replies.size < maxReplies) {
          val left = deadline - System.currentTimeMillis()
          if (left <= 0) break
          s.soTimeout = left.toInt()
          val packet = DatagramPacket(buf, buf.size)
          try {
            s.receive(packet)
          } catch (_: SocketTimeoutException) {
            break
          }
          replies.add(Base64.encodeToString(packet.data, packet.offset, packet.length, Base64.NO_WRAP))
        }
      }
      promise.resolve(mapOf("replies" to replies))
    } catch (e: Exception) {
      promise.resolve(mapOf("replies" to replies, "error" to e.message))
    }
  }

  // Bonjour (NsdManager resolves one service at a time, so resolves are queued)

  private fun mdns(opts: Map<String, Any?>, promise: Promise) {
    val type = opts["type"] as? String
    if (type == null || !Regex("^_[a-z0-9-]{1,30}\\._(tcp|udp)$").matches(type)) {
      promise.reject("E_ARGS", "Bad service type", null)
      return
    }
    val timeoutMs = (num(opts["timeoutMs"]) ?: 3000).toLong()
    val context = appContext.reactContext
    val nsd = context?.getSystemService(Context.NSD_SERVICE) as? NsdManager
    if (nsd == null) {
      promise.resolve(mapOf("services" to emptyList<Any>(), "error" to "unavailable"))
      return
    }
    val results = ConcurrentHashMap<String, Map<String, Any>>()
    val pending = ArrayDeque<NsdServiceInfo>()
    var resolving = false
    var finished = false
    val lock = Any()

    fun resolveNext() {
      val next = synchronized(lock) {
        if (resolving || finished) return
        val n = pending.removeFirstOrNull() ?: return
        resolving = true
        n
      }
      @Suppress("DEPRECATION")
      nsd.resolveService(next, object : NsdManager.ResolveListener {
        override fun onResolveFailed(info: NsdServiceInfo, errorCode: Int) {
          synchronized(lock) { resolving = false }
          resolveNext()
        }

        override fun onServiceResolved(info: NsdServiceInfo) {
          @Suppress("DEPRECATION")
          val addr = info.host
          if (addr is Inet4Address) {
            val txt = info.attributes.mapValues { (_, v) -> v?.let { String(it, Charsets.UTF_8) } ?: "" }
            results[info.serviceName] = mapOf(
              "name" to info.serviceName,
              "host" to (addr.hostAddress ?: ""),
              "port" to info.port,
              "txt" to txt,
            )
          }
          synchronized(lock) { resolving = false }
          resolveNext()
        }
      })
    }

    val listener = object : NsdManager.DiscoveryListener {
      override fun onDiscoveryStarted(serviceType: String) {}
      override fun onDiscoveryStopped(serviceType: String) {}
      override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) {}
      override fun onServiceLost(info: NsdServiceInfo) {}
      override fun onServiceFound(info: NsdServiceInfo) {
        synchronized(lock) { pending.addLast(info) }
        resolveNext()
      }
    }
    try {
      nsd.discoverServices(type, NsdManager.PROTOCOL_DNS_SD, listener)
    } catch (e: Exception) {
      promise.resolve(mapOf("services" to emptyList<Any>(), "error" to e.message))
      return
    }
    Handler(Looper.getMainLooper()).postDelayed({
      synchronized(lock) { finished = true }
      try {
        nsd.stopServiceDiscovery(listener)
      } catch (_: Exception) {
      }
      promise.resolve(mapOf("services" to results.values.toList()))
    }, timeoutMs)
  }
}
