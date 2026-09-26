package com.tvdigital.player
import java.net.URLEncoder
class PlaybackSessionClient(private val baseUrl: String) {
    fun load(contentId: String, bearerToken: String): PlaybackSession =
        PlaybackSession.fromApiResponse(AppApiClient(baseUrl, bearerToken).request("api/playback/session/${URLEncoder.encode(contentId, "UTF-8")}").toString())
}
