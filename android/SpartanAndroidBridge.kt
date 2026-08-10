/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.android

import android.webkit.JavascriptInterface
import org.json.JSONException
import org.json.JSONObject

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
) {
    interface Handler {
        fun onPolicy(payload: JSONObject): Boolean
        fun onGameModeQuery(): Boolean
        fun onControllerInventoryQuery(): Boolean
        fun onTextInput(payload: JSONObject): Boolean
    }

    @JavascriptInterface
    fun postMessage(raw: String): Boolean {
        if (raw.toByteArray(Charsets.UTF_8).size > MAX_MESSAGE_BYTES) return false
        return try {
            val message = JSONObject(raw)
            if (message.optInt("version", -1) != 1) return false
            val payload = message.optJSONObject("payload") ?: JSONObject()
            when (message.optString("action")) {
                "android.policy" -> handler.onPolicy(payload)
                "android.game-mode.query" -> handler.onGameModeQuery()
                "android.controllers.snapshot" -> handler.onControllerInventoryQuery()
                "android.text-input" -> handler.onTextInput(payload)
                else -> false
            }
        } catch (_: JSONException) {
            false
        } catch (_: RuntimeException) {
            false
        }
    }

    companion object {
        const val MAX_MESSAGE_BYTES = 16 * 1024
    }
}
