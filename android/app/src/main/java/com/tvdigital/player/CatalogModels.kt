package com.tvdigital.player

import org.json.JSONObject

data class Channel(
    val groupId: String,
    val name: String,
    val category: String,
    val logo: String,
    val squareLogo: String
)

data class Category(val name: String, val channelCount: Int)

object CatalogParser {
    fun parseCategories(rawJson: String): List<Category> {
        val root = requireSuccess(rawJson)
        val data = root.getJSONArray("data")
        return buildList {
            for (index in 0 until data.length()) {
                val item = data.getJSONObject(index)
                add(Category(item.getString("name"), item.getInt("channelCount")))
            }
        }
    }

    fun parseChannels(rawJson: String): Pair<List<Channel>, Boolean> {
        val root = requireSuccess(rawJson)
        val data = root.getJSONObject("data")
        val items = data.getJSONArray("items")
        val channels = buildList {
            for (index in 0 until items.length()) {
                val item = items.getJSONObject(index)
                add(Channel(
                    groupId = item.getString("groupId"),
                    name = item.getString("name"),
                    category = item.getString("category"),
                    logo = item.optString("logo"),
                    squareLogo = item.optString("squareLogo")
                ))
            }
        }
        return channels to data.getJSONObject("pagination").optBoolean("hasMore", false)
    }

    private fun requireSuccess(rawJson: String): JSONObject {
        val root = JSONObject(rawJson)
        require(root.optBoolean("ok", false)) { root.optString("message", "Respuesta inválida") }
        return root
    }
}
