package com.tvdigital.player

import org.junit.Assert.assertEquals
import org.junit.Test

class HistoryCodecTest {
    @Test
    fun recordsMostRecentFirstWithoutDuplicates() {
        val raw = HistoryCodec.record("channel:1\nchannel:2", "channel:2")
        assertEquals(listOf("channel:2", "channel:1"), HistoryCodec.decode(raw))
    }

    @Test
    fun limitsStoredHistory() {
        val raw = HistoryCodec.encode(listOf("a", "b", "c"), limit = 2)
        assertEquals(listOf("a", "b"), HistoryCodec.decode(raw))
    }
}
