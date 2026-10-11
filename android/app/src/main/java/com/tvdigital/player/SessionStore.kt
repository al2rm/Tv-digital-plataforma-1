package com.tvdigital.player

import android.content.Context

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
        context?.getSharedPreferences(PREFS, Context.MODE_PRIVATE)?.edit()?.clear()?.apply()
    }
}
