/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.app

import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.os.Bundle
import android.os.SystemClock
import android.view.WindowManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.webkit.WebViewAssetLoader
import com.spartan.gaming.android.SpartanAndroidBridge
import com.spartan.gaming.android.controller.AndroidControllerInventory
import com.spartan.gaming.android.gamemode.AndroidGameModeBridge
import com.spartan.gaming.android.gamenative.GameNativeHandoff
import org.json.JSONObject

/** Minimal Android shell for the shared frontend and bounded native bridge. */
class MainActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var assetLoader: WebViewAssetLoader
    private var bridge: SpartanAndroidBridge? = null
    private var lastBackPressAt = 0L

    private val resultSink =
        object : SpartanAndroidBridge.ResultSink {
            override fun emit(requestId: String, action: String, accepted: Boolean) {
                val result =
                    JSONObject().apply {
                        put("version", 1)
                        put("requestId", requestId)
                        put("action", action)
                        put("status", if (accepted) "accepted" else "rejected")
                    }
                if (::webView.isInitialized) {
                    webView.post {
                        webView.evaluateJavascript(
                            "window.dispatchEvent(new CustomEvent('spartan:android-result',{detail:$result}));",
                            null,
                        )
                    }
                }
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.statusBarColor = Color.rgb(16, 21, 27)
        window.navigationBarColor = Color.rgb(16, 21, 27)
        webView = WebView(this)
        configureWebView(webView)
        val nativeBridge = SpartanAndroidBridge(NativeHandler(this), resultSink)
        bridge = nativeBridge
        webView.addJavascriptInterface(nativeBridge, "SpartanAndroid")
        setContentView(webView)
        webView.loadUrl(FRONTEND_URL)
        GithubReleaseUpdate.check(this)
    }

    override fun onResume() {
        super.onResume()
        // Game Mode is query-only and is refreshed by the native boundary.
        AndroidGameModeBridge.queryOnResume(this, null)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("SpartanAndroid")
        webView.stopLoading()
        webView.destroy()
        bridge = null
        super.onDestroy()
    }

    @Deprecated("Use the predictive back dispatcher on newer Android releases")
    override fun onBackPressed() {
        webView.evaluateJavascript("window.spartanAndroidBack?.() === true") { handled ->
            if (handled == "true") return@evaluateJavascript
            if (webView.canGoBack()) {
                webView.goBack()
                return@evaluateJavascript
            }
            val now = SystemClock.elapsedRealtime()
            if (now - lastBackPressAt < 2000) {
                super@MainActivity.onBackPressed()
            } else {
                lastBackPressAt = now
                Toast.makeText(this, "Press Back again to exit Spartan Gaming", Toast.LENGTH_SHORT)
                    .show()
            }
        }
    }

    private fun configureWebView(view: WebView) {
        assetLoader =
            WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/providers/", WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/emulators/", WebViewAssetLoader.AssetsPathHandler(this))
                .addPathHandler("/games/", WebViewAssetLoader.AssetsPathHandler(this))
                .build()
        view.setBackgroundColor(Color.rgb(16, 21, 27))
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        }
        view.webViewClient =
            object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView?,
                    request: WebResourceRequest?,
                ): WebResourceResponse? = request?.url?.let(assetLoader::shouldInterceptRequest)

                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest,
                ): Boolean {
                    val target = request.url
                    if (target.scheme == "https" && target.host == ASSET_HOST) return false
                    if (target.scheme == "https") return false
                    return true
                }
            }
    }

    private class NativeHandler(private val activity: MainActivity) : SpartanAndroidBridge.Handler {
        override fun onPolicy(payload: JSONObject): Boolean {
            if (payload.optBoolean("keepScreenAwake", false)) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
            when (payload.optString("orientation")) {
                "portrait" ->
                    activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                "landscape" ->
                    activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                "sensor" ->
                    activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
            return true
        }

        override fun onGameModeQuery(): Boolean {
            AndroidGameModeBridge.queryOnResume(activity, null)
            return true
        }

        override fun onControllerInventoryQuery(): Boolean {
            AndroidControllerInventory.snapshot(activity)
            return true
        }

        override fun onTextInput(payload: JSONObject): Boolean {
            // GameTextInput remains an explicit SDK boundary, not a fake IME.
            return false
        }

        override fun onGameNativeLaunch(payload: JSONObject): Boolean {
            val appId = payload.optLong("appId", -1L)
            val store = payload.optString("store")
            if (appId !in 1..Int.MAX_VALUE.toLong()) return false
            return try {
                GameNativeHandoff.launchOrInstall(activity, appId.toInt(), store)
            } catch (_: RuntimeException) {
                Toast.makeText(activity, "GameNative handoff unavailable", Toast.LENGTH_SHORT)
                    .show()
                false
            }
        }
    }

    companion object {
        const val ASSET_HOST = "appassets.androidplatform.net"
        const val FRONTEND_URL =
            "https://appassets.androidplatform.net/assets/frontend/dashboard/index.html"
    }
}
