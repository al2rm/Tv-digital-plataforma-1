package com.tvdigital.player
import java.net.URLEncoder
class CatalogApiClient(baseUrl: String, token: String) {
    private val api = AppApiClient(baseUrl, token)
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
    private fun encode(s: String) = URLEncoder.encode(s, "UTF-8")
}
