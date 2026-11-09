package com.tunedtv.tvnet

import android.app.Presentation
import android.content.Context
import android.graphics.Color
import android.hardware.display.DisplayManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Display
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * "Show on TV" while the phone mirrors to a TV over Smart View / Miracast (Samsung, LG, Roku,
 * Fire TV): Android gives apps that TV as a second display, so the TV gets its own full-screen TV
 * screen page instead of a copy of the phone. Same contract as the iOS AirPlay module. Google's
 * "Cast screen" only copies the phone and never offers a second display.
 * The JS bridge (src/lib/nativeExtras.ts) only hands over tunedtv.com pages.
 */
private const val TAG = "TvScreen"

class TvScreenModule : Module() {
  private val main = Handler(Looper.getMainLooper())
  private var presentation: Presentation? = null
  private var url: String? = null
  private var listener: DisplayManager.DisplayListener? = null

  private val displays: DisplayManager?
    get() = appContext.reactContext?.getSystemService(Context.DISPLAY_SERVICE) as? DisplayManager

  private fun external(): Display? =
    displays?.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)?.firstOrNull()

  private fun state(): Map<String, Boolean> =
    mapOf("connected" to (external() != null), "showing" to (presentation != null))

  private fun emit() = sendEvent("onScreenChange", state())

  private fun attach() {
    val u = url ?: return
    val d = external() ?: return teardown()
    if (presentation?.display?.displayId == d.displayId) return
    teardown()
    val activity = appContext.currentActivity ?: return
    val p = TvPage(activity, d, u)
    p.setOnDismissListener {
      if (presentation === p) {
        presentation = null
        holdPhoneAwake(false)
        emit()
      }
    }
    presentation = p
    try {
      p.show()
      holdPhoneAwake(true)
    } catch (e: RuntimeException) {
      Log.w(TAG, "couldn't show on display ${d.displayId}", e)
      presentation = null
    }
  }

  private fun teardown() {
    val p = presentation ?: return
    presentation = null
    holdPhoneAwake(false)
    p.dismiss()
  }

  /** Mirroring stops when the phone sleeps. */
  private fun holdPhoneAwake(on: Boolean) {
    val w = appContext.currentActivity?.window ?: return
    if (on) w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    else w.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun observe() {
    val dm = displays ?: return
    val l = object : DisplayManager.DisplayListener {
      override fun onDisplayAdded(displayId: Int) {
        attach()
        emit()
      }

      override fun onDisplayRemoved(displayId: Int) {
        if (presentation?.display?.displayId == displayId) teardown()
        attach()
        emit()
      }

      override fun onDisplayChanged(displayId: Int) {}
    }
    dm.registerDisplayListener(l, main)
    listener = l
  }

  override fun definition() = ModuleDefinition {
    Name("TvScreen")

    Events("onScreenChange")

    OnCreate {
      main.post { observe() }
    }

    OnDestroy {
      main.post {
        listener?.let { displays?.unregisterDisplayListener(it) }
        listener = null
        teardown()
      }
    }

    AsyncFunction("status") {
      state()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("show") { urlString: String ->
      if (Uri.parse(urlString).scheme == "https") {
        url = urlString
        attach()
      }
      state()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("hide") {
      url = null
      teardown()
      state()
    }.runOnQueue(Queues.MAIN)
  }
}

private class TvPage(ctx: Context, display: Display, private val pageUrl: String) : Presentation(ctx, display) {
  private var web: WebView? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    window?.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    val host = Uri.parse(pageUrl).host
    web = WebView(context).apply {
      setBackgroundColor(Color.parseColor("#07080c"))
      settings.javaScriptEnabled = true
      settings.domStorageEnabled = true
      settings.mediaPlaybackRequiresUserGesture = false
      settings.userAgentString = settings.userAgentString + " TunedTV-AndroidMirror/1.0"
      webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
          request.url.host != host
      }
      loadUrl(pageUrl)
    }
    setContentView(web!!)
  }

  override fun onStop() {
    web?.destroy()
    web = null
    super.onStop()
  }
}
