package com.tvdigital.player

import android.content.Context
import android.os.Build
import java.util.UUID

object SessionStore {
    var baseUrl: String = ""
    var token: String = ""
    var userId: String = ""
    var name: String = ""
    private const val PREFS = "user_session"
    fun restore(context: Context): Boolean {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        baseUrl = prefs.getString("baseUrl", "").orEmpty()
        token = prefs.getString("token", "").orEmpty()
        userId = prefs.getString("userId", "").orEmpty()
        name = prefs.getString("name", "").orEmpty()
        return baseUrl.isNotBlank() && token.isNotBlank() && userId.isNotBlank()
    }
    fun save(context: Context, server: String, accessToken: String, id: String, displayName: String) {
        baseUrl = server; token = accessToken; userId = id; name = displayName
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
            .putString("baseUrl", server).putString("token", accessToken)
            .putString("userId", id).putString("name", displayName).apply()
    }
    fun clear(context: Context? = null) {
        token = ""; userId = ""; name = ""
        context?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)?.edit()
            ?.remove("baseUrl")?.remove("token")?.remove("userId")?.remove("name")?.apply()
    }
    fun deviceHeaders(context: Context): Map<String,String> {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val id = prefs.getString("deviceId", "").orEmpty().ifBlank {
            UUID.randomUUID().toString().also { prefs.edit().putString("deviceId", it).apply() }
        }
        val model = listOf(Build.MANUFACTURER, Build.MODEL).filter { it.isNotBlank() }.joinToString(" ").take(100)
        return mapOf(
            "X-Device-Id" to id,
            "X-Device-Name" to (model.ifBlank { "TV Box" }),
            "X-Device-Platform" to "Android TV ${Build.VERSION.RELEASE}"
        )
    }
}
