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

    @Test(expected = IllegalArgumentException::class)
    fun rejectsCleartextManifest() {
        PlaybackSession(
            contentId = "unsafe",
            manifestUrl = "http://example.test/video.mpd",
            mimeType = null,
            streamHeaders = emptyMap(),
            drm = null
        )
    }
}
