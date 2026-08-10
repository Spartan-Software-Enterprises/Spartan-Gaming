/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.android.gamenative

import android.content.Context
import android.content.Intent
import android.net.Uri

/** Safe handoff boundary for the separately distributed GameNative Android app. */
object GameNativeHandoff {
    const val PACKAGE_NAME = "app.gamenative"
    const val ACTION_LAUNCH_GAME = "app.gamenative.LAUNCH_GAME"
    const val RELEASE_URL = "https://downloads.gamenative.app/releases/1.1.1/gamenative-v1.1.1.apk"

    private val supportedStores = setOf("STEAM", "EPIC", "GOG", "AMAZON")

    fun createLaunchIntent(appId: Int, store: String): Intent {
        require(appId > 0) { "GameNative app ID must be positive" }
        val normalizedStore = store.trim().uppercase()
        require(normalizedStore in supportedStores) { "Unsupported GameNative store" }
        return Intent(ACTION_LAUNCH_GAME).apply {
            `package` = PACKAGE_NAME
            putExtra("app_id", appId)
            putExtra("game_source", normalizedStore)
        }
    }

    fun isInstalled(context: Context): Boolean = try {
        context.packageManager.getPackageInfo(PACKAGE_NAME, 0)
        true
    } catch (_: Exception) {
        false
    }

    fun launchOrInstall(context: Context, appId: Int, store: String): Boolean {
        val intent = createLaunchIntent(appId, store)
        return if (intent.resolveActivity(context.packageManager) != null) {
            context.startActivity(intent)
            true
        } else {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(RELEASE_URL)))
            false
        }
    }
}
