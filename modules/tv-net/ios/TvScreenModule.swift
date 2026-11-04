import ExpoModulesCore
import UIKit
import WebKit

/// "Show on TV" over AirPlay: while the iPhone mirrors to a TV (Roku, Apple TV, AirPlay 2 sets),
/// the TV gets its own full-screen window with the TV screen page instead of a copy of the phone.
/// The JS bridge (src/lib/nativeExtras.ts) only hands over tunedtv.com pages.
public final class TvScreenModule: Module {
  private var window: UIWindow?
  private var url: URL?
  private var observers: [NSObjectProtocol] = []

  public func definition() -> ModuleDefinition {
    Name("TvScreen")

    Events("onScreenChange")

    OnCreate {
      DispatchQueue.main.async { self.observe() }
    }

    OnDestroy {
      DispatchQueue.main.async {
        self.observers.forEach { NotificationCenter.default.removeObserver($0) }
        self.observers = []
        self.teardown()
      }
    }

    AsyncFunction("status") { () -> [String: Bool] in
      return self.state()
    }.runOnQueue(.main)

    AsyncFunction("show") { (urlString: String) -> [String: Bool] in
      guard let u = URL(string: urlString), u.scheme == "https" else { return self.state() }
      self.url = u
      self.attach()
      return self.state()
    }.runOnQueue(.main)

    AsyncFunction("hide") { () -> [String: Bool] in
      self.url = nil
      self.teardown()
      return self.state()
    }.runOnQueue(.main)
  }

  private func external() -> UIScreen? {
    if let scene = externalScene() { return scene.screen }
    return UIScreen.screens.first { $0 !== UIScreen.main }
  }

  /// Apps on the UIScene lifecycle get the TV as its own window scene; a window bound with
  /// `UIWindow.screen` there never draws, so use the scene whenever one exists.
  private func externalScene() -> UIWindowScene? {
    UIApplication.shared.connectedScenes
      .compactMap { $0 as? UIWindowScene }
      .first { $0.session.role == .windowExternalDisplayNonInteractive || $0.screen !== UIScreen.main }
  }

  private func state() -> [String: Bool] {
    ["connected": external() != nil, "showing": window != nil]
  }

  private func emit() {
    sendEvent("onScreenChange", state())
  }

  private func observe() {
    let nc = NotificationCenter.default
    observers.append(nc.addObserver(forName: UIScreen.didConnectNotification, object: nil, queue: .main) { [weak self] _ in
      self?.attach()
      self?.emit()
    })
    observers.append(nc.addObserver(forName: UIScreen.didDisconnectNotification, object: nil, queue: .main) { [weak self] _ in
      self?.teardown()
      self?.emit()
    })
    observers.append(nc.addObserver(forName: UIScene.willConnectNotification, object: nil, queue: .main) { [weak self] _ in
      DispatchQueue.main.async {
        self?.attach()
        self?.emit()
      }
    })
    observers.append(nc.addObserver(forName: UIScene.didDisconnectNotification, object: nil, queue: .main) { [weak self] note in
      guard let self, let scene = note.object as? UIWindowScene, self.window?.windowScene === scene else { return }
      self.teardown()
      self.emit()
    })
  }

  private func attach() {
    guard let url, let screen = external() else { return }
    let scene = externalScene()
    if let window, window.screen === screen, scene == nil || window.windowScene === scene {
      (window.rootViewController?.view as? WKWebView)?.load(URLRequest(url: url))
      return
    }
    teardown()
    let config = WKWebViewConfiguration()
    config.allowsInlineMediaPlayback = true
    config.mediaTypesRequiringUserActionForPlayback = []
    let web = WKWebView(frame: screen.bounds, configuration: config)
    web.isOpaque = false
    web.backgroundColor = .black
    web.scrollView.isScrollEnabled = false
    web.load(URLRequest(url: url))
    let vc = UIViewController()
    vc.view = web
    let w: UIWindow
    if let scene {
      w = UIWindow(windowScene: scene)
      w.frame = scene.coordinateSpace.bounds
    } else {
      w = UIWindow(frame: screen.bounds)
      w.screen = screen
    }
    w.rootViewController = vc
    w.isHidden = false
    window = w
    emit()
  }

  private func teardown() {
    guard let w = window else { return }
    (w.rootViewController?.view as? WKWebView)?.stopLoading()
    w.isHidden = true
    window = nil
    emit()
  }
}
