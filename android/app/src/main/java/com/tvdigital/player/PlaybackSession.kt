package com.tvdigital.player

import org.json.JSONObject
import java.net.URI

data class PlaybackSession(
    val contentId: String,
    val manifestUrl: String,
    val mimeType: String?,
    val streamHeaders: Map<String, String>,
    val drm: DrmConfig?
) {
    init {
        requireHttps(manifestUrl, "manifestUrl")
        drm?.let { requireHttps(it.licenseUrl, "licenseUrl") }
    }

    data class DrmConfig(
        val scheme: String,
        val licenseUrl: String,
        val licenseHeaders: Map<String, String>
    )

    companion object {
        fun fromApiResponse(rawJson: String): PlaybackSession {
            val root = JSONObject(rawJson)
            require(root.optBoolean("ok", false)) { root.optString("message", "Sesión rechazada") }
            val data = root.getJSONObject("data")
            val drmJson = data.optJSONObject("drm")

            return PlaybackSession(
                contentId = data.getString("contentId"),
                manifestUrl = data.getString("manifestUrl"),
                mimeType = data.optString("mimeType").takeIf(String::isNotBlank),
                streamHeaders = data.optJSONObject("streamHeaders").toStringMap(),
                drm = drmJson?.let {
                    DrmConfig(
                        scheme = it.optString("scheme", "widevine"),
                        licenseUrl = it.getString("licenseUrl"),
                        licenseHeaders = it.optJSONObject("licenseHeaders").toStringMap()
                    )
                }
            )
        }

        fun demo() = PlaybackSession(
            contentId = "demo-clear",
            manifestUrl = "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd",
            mimeType = "application/dash+xml",
            streamHeaders = emptyMap(),
            drm = null
        )

        private fun JSONObject?.toStringMap(): Map<String, String> {
            if (this == null) return emptyMap()
            return keys().asSequence().associateWith { getString(it) }
        }

        private fun requireHttps(url: String, field: String) {
            val uri = runCatching { URI(url) }.getOrNull()
            require(uri?.scheme.equals("https", ignoreCase = true) && !uri?.host.isNullOrBlank()) {
                "$field debe usar HTTPS"
            }
        }
    }
}
