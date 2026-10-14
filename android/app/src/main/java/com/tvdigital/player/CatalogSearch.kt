package com.tvdigital.player

import java.text.Normalizer
import java.util.Locale

object CatalogSearch {
    private fun normalized(value: String) = Normalizer.normalize(value, Normalizer.Form.NFD)
        .replace(Regex("\\p{M}+"), "").lowercase(Locale.ROOT).trim()

    fun filter(items: List<Channel>, query: String): List<Channel> {
        val terms = normalized(query).split(Regex("\\s+")).filter(String::isNotBlank)
        if (terms.isEmpty()) return items
        return items.filter { item ->
            val text = normalized("${item.name} ${item.category}")
            terms.all(text::contains)
        }
    }
}
