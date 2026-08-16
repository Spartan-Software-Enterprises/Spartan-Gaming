package com.spartan.gaming.app

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray

/** Blocks an older install until the newest compatible GitHub release is opened. */
object GithubReleaseUpdate {
    private const val RELEASES_URL =
        "https://api.github.com/repos/Spartan-Software-Enterprises/Spartan-Gaming/releases?per_page=20"
    @Volatile private var checkInFlight = false
    private const val TAG = "SpartanReleaseUpdate"

    fun check(activity: MainActivity) {
        if (checkInFlight) return
        checkInFlight = true
        Thread {
            val result = runCatching { findNewerRelease(activity) }
            checkInFlight = false
            val update = result.getOrNull()
            result.exceptionOrNull()?.let { Log.w(TAG, "GitHub update check failed", it) }
            if (update == null) return@Thread
            Handler(Looper.getMainLooper()).post {
                if (activity.isFinishing || activity.isDestroyed) return@post
                AlertDialog.Builder(activity)
                    .setTitle("Update Required")
                    .setMessage(
                        "Spartan Gaming ${update.name} is available. Update from the official GitHub release before continuing."
                    )
                    .setCancelable(false)
                    .setPositiveButton("Download Update") { _, _ ->
                        activity.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(update.url)))
                        activity.finishAffinity()
                    }
                    .setNegativeButton("Exit") { _, _ -> activity.finishAffinity() }
                    .show()
            }
        }
            .start()
    }

    private fun findNewerRelease(activity: MainActivity): Release? {
        val connection = URL(RELEASES_URL).openConnection() as HttpURLConnection
        connection.connectTimeout = 5000
        connection.readTimeout = 5000
        connection.setRequestProperty("Accept", "application/vnd.github+json")
        connection.setRequestProperty("User-Agent", "Spartan-Gaming-Android")
        return try {
            if (connection.responseCode !in 200..299) return null
            val releases = JSONArray(connection.inputStream.bufferedReader().use { it.readText() })
            val current =
                parseVersion(
                    activity.packageManager.getPackageInfo(activity.packageName, 0).versionName
                        ?: "0.0.0"
                ) ?: return null
            (0 until releases.length())
                .mapNotNull { index ->
                    val item = releases.optJSONObject(index) ?: return@mapNotNull null
                    if (
                        item.optBoolean("draft") ||
                            item.optBoolean("prerelease") != current.preRelease.isNotEmpty()
                    )
                        return@mapNotNull null
                    val version = parseVersion(item.optString("tag_name")) ?: return@mapNotNull null
                    if (version > current)
                        Release(
                            item.optString("name", item.optString("tag_name")),
                            item.optString("html_url"),
                            version,
                        )
                    else null
                }
                .maxByOrNull { it.version }
        } finally {
            connection.disconnect()
        }
    }

    private fun parseVersion(value: String): Version? {
        val match =
            Regex("^v?(\\d+)\\.(\\d+)\\.(\\d+)(?:-([0-9A-Za-z.-]+))?$").matchEntire(value.trim())
                ?: return null
        return Version(
            match.groupValues[1].toInt(),
            match.groupValues[2].toInt(),
            match.groupValues[3].toInt(),
            match.groupValues[4],
        )
    }

    private data class Version(
        val major: Int,
        val minor: Int,
        val patch: Int,
        val preRelease: String,
    ) : Comparable<Version> {
        override fun compareTo(other: Version): Int {
            val core = compareValuesBy(this, other, Version::major, Version::minor, Version::patch)
            if (core != 0) return core
            if (preRelease.isEmpty() != other.preRelease.isEmpty()) {
                return if (preRelease.isEmpty()) 1 else -1
            }
            val leftParts = preRelease.split('.')
            val rightParts = other.preRelease.split('.')
            for (index in 0 until maxOf(leftParts.size, rightParts.size)) {
                val left = leftParts.getOrNull(index) ?: return -1
                val right = rightParts.getOrNull(index) ?: return 1
                val leftNumber = left.toIntOrNull()
                val rightNumber = right.toIntOrNull()
                if (leftNumber != null && rightNumber != null && leftNumber != rightNumber) {
                    return leftNumber.compareTo(rightNumber)
                }
                if (leftNumber != null && rightNumber == null) return -1
                if (leftNumber == null && rightNumber != null) return 1
                if (left != right) return left.compareTo(right)
            }
            return 0
        }
    }

    private data class Release(val name: String, val url: String, val version: Version)
}
