package com.tvdigital.player

object ResumePolicy {
    fun supports(contentId: String) = contentId.startsWith("movie:") || contentId.startsWith("episode:")
    fun position(contentId: String, positionMs: Long, durationMs: Long, completed: Boolean): Long {
        if (!supports(contentId) || completed || positionMs < 5_000L) return 0
        if (durationMs > 0 && positionMs >= durationMs - 5_000L) return 0
        return positionMs.coerceAtLeast(0)
    }
}
