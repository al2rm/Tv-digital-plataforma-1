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
        requirePlaybackUrl(manifestUrl, "manifestUrl", BuildConfig.ALLOW_HTTP_STREAMS)
        drm?.let { requirePlaybackUrl(it.licenseUrl, "licenseUrl", false) }
    }

    data class DrmConfig(
        val scheme: String,
        val licenseUrl: String,
        val licenseHeaders: Map<String, String>
    )

    fun playbackCandidates(): List<PlaybackSession> {
        if (drm != null) return listOf(this)

        val hlsUrl = manifestUrl.replace(MPEG_TS_SUFFIX, ".m3u8")
        if (hlsUrl == manifestUrl) return listOf(this)

        return listOf(
            copy(manifestUrl = hlsUrl, mimeType = HLS_MIME_TYPE),
            copy(mimeType = mimeType ?: MPEG_TS_MIME_TYPE)
        )
    }

    companion object {
        private val MPEG_TS_SUFFIX = Regex("(?i)\\.ts(?=([?#]|$))")
        private const val HLS_MIME_TYPE = "application/x-mpegURL"
        private const val MPEG_TS_MIME_TYPE = "video/mp2t"

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

    }
}

internal fun requirePlaybackUrl(url: String, field: String, allowHttp: Boolean) {
    val uri = runCatching { URI(url) }.getOrNull()
    val protocolAllowed = uri?.scheme.equals("https", ignoreCase = true) ||
        (allowHttp && uri?.scheme.equals("http", ignoreCase = true))
    require(protocolAllowed && !uri?.host.isNullOrBlank() && uri?.userInfo == null) {
        "$field debe usar ${if (allowHttp) "HTTP o HTTPS" else "HTTPS"}"
    }
}
