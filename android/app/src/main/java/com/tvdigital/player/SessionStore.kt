package com.tvdigital.player

object SessionStore {
    var baseUrl: String = ""
    var token: String = ""
    var userId: String = ""
    var name: String = ""
    fun clear() { token = ""; userId = ""; name = "" }
}
