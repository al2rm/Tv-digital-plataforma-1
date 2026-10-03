package com.tvdigital.player

object HistoryCodec {
    private const val SEPARATOR = "\n"

    fun decode(raw: String?): List<String> = raw.orEmpty()
        .split(SEPARATOR)
        .map(String::trim)
        .filter { it.isNotEmpty() && !it.contains(SEPARATOR) }
        .distinct()

    fun record(raw: String?, contentId: String, limit: Int = 50): String {
        val cleanId = contentId.trim()
        require(cleanId.isNotEmpty() && !cleanId.contains(SEPARATOR)) { "ID de contenido inválido" }
        return encode(listOf(cleanId) + decode(raw).filterNot { it == cleanId }, limit)
    }

    fun encode(ids: List<String>, limit: Int = 50): String = ids
        .map(String::trim)
        .filter { it.isNotEmpty() && !it.contains(SEPARATOR) }
        .distinct()
        .take(limit.coerceAtLeast(1))
        .joinToString(SEPARATOR)
}
