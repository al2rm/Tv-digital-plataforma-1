package com.tvdigital.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class PlaybackSessionTest {
    @Test
    fun parsesAuthorizedWidevineSession() {
        val session = PlaybackSession.fromApiResponse(
            """
            {
              "ok": true,
              "data": {
                "contentId": "canal-1",
                "manifestUrl": "https://cdn.example/manifest.mpd",
                "mimeType": "application/dash+xml",
                "streamHeaders": {"X-Playback": "session-value"},
                "drm": {
                  "scheme": "widevine",
                  "licenseUrl": "https://api.example/license",
                  "licenseHeaders": {"Authorization": "Bearer short-session-token"}
                }
              }
            }
            """.trimIndent()
        )

        assertEquals("canal-1", session.contentId)
        assertEquals("session-value", session.streamHeaders["X-Playback"])
        assertNotNull(session.drm)
        assertEquals("widevine", session.drm?.scheme)
    }

    @Test
    fun demoSessionDoesNotRequireDrm() {
        assertNull(PlaybackSession.demo().drm)
    }

    @Test
    fun acceptsCleartextManifestInTrialBuild() {
        val session = PlaybackSession(
            contentId = "unsafe",
            manifestUrl = "http://example.test/video.mpd",
            mimeType = null,
            streamHeaders = emptyMap(),
            drm = null
        )
        assertEquals("http://example.test/video.mpd", session.manifestUrl)
    }

    @Test(expected = IllegalArgumentException::class)
    fun secureModeRejectsCleartextManifest() {
        requirePlaybackUrl("http://example.test/video.mpd", "manifestUrl", false)
    }

    @Test
    fun prioritizesHlsForXtreamTransportStream() {
        val session = PlaybackSession(
            contentId = "canal-xtream",
            manifestUrl = "http://provider.example/live/user/token/123.ts",
            mimeType = null,
            streamHeaders = emptyMap(),
            drm = null
        )

        val candidates = session.playbackCandidates()

        assertEquals(2, candidates.size)
        assertEquals("http://provider.example/live/user/token/123.m3u8", candidates[0].manifestUrl)
        assertEquals("application/x-mpegURL", candidates[0].mimeType)
        assertEquals("http://provider.example/live/user/token/123.ts", candidates[1].manifestUrl)
        assertEquals("video/mp2t", candidates[1].mimeType)
    }

    @Test
    fun keepsExistingHlsAsOnlyCandidate() {
        val session = PlaybackSession(
            contentId = "canal-hls",
            manifestUrl = "http://provider.example/live/channel.m3u8?token=short",
            mimeType = "application/x-mpegURL",
            streamHeaders = emptyMap(),
            drm = null
        )

        val candidates = session.playbackCandidates()
        assertEquals(2, candidates.size)
        assertEquals("HLS", candidates[0].formatLabel())
        assertEquals("http://provider.example/live/channel.ts?token=short", candidates[1].manifestUrl)
        assertEquals("TS", candidates[1].formatLabel())
    }

    @Test
    fun respectsExplicitTsPreference() {
        val session = PlaybackSession(
            contentId = "canal-ts",
            manifestUrl = "http://provider.example/live/channel.ts?token=short",
            mimeType = "video/mp2t",
            streamHeaders = emptyMap(),
            drm = null
        )

        assertEquals("TS", session.playbackCandidates()[0].formatLabel())
        assertEquals("HLS", session.playbackCandidates()[1].formatLabel())
    }

    @Test
    fun doesNotRewriteDrmTransportStream() {
        val session = PlaybackSession(
            contentId = "canal-drm",
            manifestUrl = "https://provider.example/live/channel.ts",
            mimeType = null,
            streamHeaders = emptyMap(),
            drm = PlaybackSession.DrmConfig(
                scheme = "widevine",
                licenseUrl = "https://provider.example/license",
                licenseHeaders = emptyMap()
            )
        )

        assertEquals(listOf(session), session.playbackCandidates())
    }
}
