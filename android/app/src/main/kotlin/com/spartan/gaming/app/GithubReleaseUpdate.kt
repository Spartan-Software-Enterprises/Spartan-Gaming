package com.spartan.gaming.app

import android.app.AlertDialog
import android.content.Intent
import android.net.Uri
import android.os.Handler
import android.os.Looper
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONArray

/** Blocks an older install until the newest compatible GitHub release is opened. */
object GithubReleaseUpdate {
    private const val RELEASES_URL =
        "https://api.github.com/repos/Spartan-Software-Enterprises/Spartan-Gaming/releases?per_page=20"

    fun check(activity: MainActivity) {
        Thread {
            val update = runCatching { findNewerRelease(activity) }.getOrNull() ?: return@Thread
            Handler(Looper.getMainLooper()).post {
                if (activity.isFinishing || activity.isDestroyed) return@post
                AlertDialog.Builder(activity)
                    .setTitle("Update required")
                    .setMessage(
                        "Spartan Gaming ${update.name} is available. Update from the official GitHub release before continuing."
                    )
                    .setCancelable(false)
                    .setPositiveButton("Download update") { _, _ ->
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
                            item.optBoolean("prerelease") != current.preRelease
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
            match.groupValues[4].isNotEmpty(),
        )
    }

    private data class Version(
        val major: Int,
        val minor: Int,
        val patch: Int,
        val preRelease: Boolean,
    ) : Comparable<Version> {
        override fun compareTo(other: Version): Int =
            compareValuesBy(
                this,
                other,
                Version::major,
                Version::minor,
                Version::patch,
                Version::preRelease,
            )
    }

    private data class Release(val name: String, val url: String, val version: Version)
}
