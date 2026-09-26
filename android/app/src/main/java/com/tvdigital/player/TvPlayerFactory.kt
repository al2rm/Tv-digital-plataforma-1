package com.tvdigital.player

import android.content.Context
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory

object TvPlayerFactory {
    fun create(context: Context, session: PlaybackSession): ExoPlayer {
        val httpFactory = DefaultHttpDataSource.Factory()
            .setUserAgent("TV Digital Android/1.0")
            .setConnectTimeoutMs(10_000)
            .setReadTimeoutMs(20_000)
            .setAllowCrossProtocolRedirects(false)
            .setDefaultRequestProperties(session.streamHeaders)

        val mediaItemBuilder = MediaItem.Builder()
            .setUri(session.manifestUrl)
            .setMediaId(session.contentId)

        session.mimeType?.let(mediaItemBuilder::setMimeType)
        session.drm?.let { drm ->
            require(drm.scheme.equals("widevine", ignoreCase = true)) {
                "DRM no compatible: ${drm.scheme}"
            }
            mediaItemBuilder.setDrmConfiguration(
                MediaItem.DrmConfiguration.Builder(C.WIDEVINE_UUID)
                    .setLicenseUri(drm.licenseUrl)
                    .setLicenseRequestHeaders(drm.licenseHeaders)
                    .setMultiSession(false)
                    .build()
            )
        }

        return ExoPlayer.Builder(context)
            .setMediaSourceFactory(DefaultMediaSourceFactory(httpFactory))
            .build()
            .also { player ->
                player.setMediaItem(mediaItemBuilder.build())
                player.prepare()
                player.playWhenReady = true
            }
    }
}
