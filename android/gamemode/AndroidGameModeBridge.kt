/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.android.gamemode

import android.app.GameManager
import android.content.Context
import android.os.Build

/** The Android Game Mode API is query-only for application code. */
data class AndroidGameModeSnapshot(
    val apiLevel: Int,
    val requestedMode: String,
    val systemMode: String,
    val supported: Boolean,
    val refreshedOnResume: Boolean,
)

object AndroidGameModeBridge {
    private val requestedModes = setOf("Follow system", "Performance", "Battery", "Standard")

    /** Query the current system selection; call this from Activity.onResume(). */
    fun queryOnResume(context: Context, requestedMode: String?): AndroidGameModeSnapshot {
        val requested = requestedMode?.takeIf { it in requestedModes } ?: "Follow system"
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return AndroidGameModeSnapshot(Build.VERSION.SDK_INT, requested, "Unsupported", false, true)
        }
        val manager = context.getSystemService(GameManager::class.java)
        val observed = manager?.gameMode ?: GameManager.GAME_MODE_UNSUPPORTED
        return AndroidGameModeSnapshot(Build.VERSION.SDK_INT, requested, nameOf(observed), observed != GameManager.GAME_MODE_UNSUPPORTED, true)
    }

    fun nameOf(mode: Int): String = when (mode) {
        GameManager.GAME_MODE_PERFORMANCE -> "Performance"
        GameManager.GAME_MODE_BATTERY -> "Battery"
        GameManager.GAME_MODE_STANDARD -> "Standard"
        GameManager.GAME_MODE_CUSTOM -> "Custom"
        else -> "Unsupported"
    }
}
