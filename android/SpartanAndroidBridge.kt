/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.android

import android.webkit.JavascriptInterface
import org.json.JSONException
import org.json.JSONObject
import java.util.Locale

/**
 * Bounded WebView bridge for shared Spartan Android policy requests.
 *
 * The Activity owns the Handler implementation and must still apply Android
 * permissions, lifecycle, GameTextInput, controller, and GameNative policy.
 * This class intentionally does not expose Context or raw Android objects to
 * JavaScript and never executes an arbitrary command or URL.
 */
class SpartanAndroidBridge(
    private val handler: Handler,
    private val resultSink: ResultSink? = null,
) {
    interface ResultSink {
        fun emit(requestId: String, action: String, accepted: Boolean)
    }

    interface Handler {
        fun onPolicy(payload: JSONObject): Boolean
        fun onGameModeQuery(): Boolean
        fun onControllerInventoryQuery(): Boolean
        fun onTextInput(payload: JSONObject): Boolean
        fun onGameNativeLaunch(payload: JSONObject): Boolean
    }

    @JavascriptInterface
    fun postMessage(raw: String): Boolean {
        if (raw.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_BYTES) return false
        return try {
            val message = JSONObject(raw)
            if (message.optInt("version", -1) != 1) return false
            val requestId = message.optString("requestId")
            if (!REQUEST_ID_PATTERN.matches(requestId)) return false
            val payload = if (!message.has("payload")) JSONObject() else message.optJSONObject("payload") ?: return false
            val action = message.optString("action")
            val accepted = when (action) {
                "android.policy" -> handler.onPolicy(payload)
                "android.game-mode.query" -> handler.onGameModeQuery()
                "android.controllers.snapshot" -> handler.onControllerInventoryQuery()
                "android.text-input" -> handler.onTextInput(payload)
                "android.gamenative.launch" -> if (isValidGameNativePayload(payload)) handler.onGameNativeLaunch(payload) else false
                else -> false
            }
            resultSink?.emit(requestId, action, accepted)
            accepted
        } catch (_: JSONException) {
            false
        } catch (_: RuntimeException) {
            false
        }
    }

    companion object {
        const val MAX_MESSAGE_BYTES = 16 * 1024
        private val GAME_NATIVE_STORES = setOf("STEAM", "EPIC", "GOG", "AMAZON")
        private val REQUEST_ID_PATTERN = Regex("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

        private fun isValidGameNativePayload(payload: JSONObject): Boolean {
            val appId = payload.optLong("appId", Long.MIN_VALUE)
            val store = payload.optString("store").uppercase(Locale.ROOT)
            return appId in 1..Int.MAX_VALUE.toLong() && store in GAME_NATIVE_STORES
        }
    }
}
