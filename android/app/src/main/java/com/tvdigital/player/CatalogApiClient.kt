package com.tvdigital.player
import android.content.Context
import java.net.URLEncoder
class CatalogApiClient(context: Context, baseUrl: String, token: String) {
    private val api = AppApiClient(baseUrl, token, SessionStore.deviceHeaders(context))
    fun loadCategories() = CatalogParser.parseCategories(api.request("api/catalog/categories").toString())
    fun loadAccount() = api.request("api/app/account").getJSONObject("data")
    fun loadChannels(category: String = "", search: String = ""): List<Channel> {
        val results = mutableListOf<Channel>()
        var more: Boolean
        do {
            val path = "api/catalog/channels?limit=100&offset=${results.size}&category=${encode(category)}&search=${encode(search)}"
            val (items, hasMore) = CatalogParser.parseChannels(api.request(path).toString())
            results += items
            more = hasMore && items.isNotEmpty()
        } while (more)
        return results
    }
    fun loadEpisodes(seriesId: String): List<Channel> = CatalogParser.parseChannels(api.request("api/catalog/series/${encode(seriesId)}/episodes").toString()).first
    private fun encode(s: String) = URLEncoder.encode(s, "UTF-8")
}
