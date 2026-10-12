package com.tvdigital.player
import android.content.Context
import java.net.URLEncoder
class PlaybackSessionClient(private val context: Context, private val baseUrl: String) {
    fun load(contentId: String, bearerToken: String, parentalPin: String = ""): PlaybackSession =
        PlaybackSession.fromApiResponse(AppApiClient(baseUrl, bearerToken, SessionStore.deviceHeaders(context)).request("api/playback/session/${URLEncoder.encode(contentId, "UTF-8")}",headers=if(parentalPin.isBlank()) emptyMap() else mapOf("X-Parental-Pin" to parentalPin)).toString())
}
