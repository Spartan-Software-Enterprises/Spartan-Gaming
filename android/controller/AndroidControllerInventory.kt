/*
 * Copyright 2026 Spartan Software Enterprises
 * SPDX-License-Identifier: Apache-2.0
 */
package com.spartan.gaming.android.controller

import android.content.Context
import android.os.Build
import android.view.InputDevice

data class AndroidControllerDevice(
    val deviceId: Int,
    val name: String,
    val sources: Int,
    val vendorId: Int,
    val productId: Int,
    val hasVibrator: Boolean,
)

object AndroidControllerInventory {
    fun snapshot(context: Context): List<AndroidControllerDevice> = InputDevice.getDeviceIds().mapNotNull { id ->
        val device = InputDevice.getDevice(id) ?: return@mapNotNull null
        if (!isController(device.sources)) return@mapNotNull null
        AndroidControllerDevice(
            deviceId = id,
            name = device.name.take(128),
            sources = device.sources,
            vendorId = if (Build.VERSION.SDK_INT >= 19) device.vendorId else 0,
            productId = if (Build.VERSION.SDK_INT >= 19) device.productId else 0,
            hasVibrator = if (Build.VERSION.SDK_INT >= 31) device.vibratorManager.vibratorIds.isNotEmpty() else device.vibrator.hasVibrator(),
        )
    }.sortedBy { it.deviceId }

    fun isController(sources: Int): Boolean = sources and (InputDevice.SOURCE_GAMEPAD or InputDevice.SOURCE_JOYSTICK) != 0
}
