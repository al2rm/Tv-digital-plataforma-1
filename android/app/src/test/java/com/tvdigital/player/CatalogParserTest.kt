package com.tvdigital.player

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CatalogParserTest {
    @Test
    fun parsesCategories() {
        val result = CatalogParser.parseCategories(
            """{"ok":true,"data":[{"name":"Noticias","channelCount":4}]}"""
        )
        assertEquals("Noticias", result.single().name)
        assertEquals(4, result.single().channelCount)
    }

    @Test
    fun parsesChannelPage() {
        val (channels, hasMore) = CatalogParser.parseChannels(
            """{"ok":true,"data":{"items":[{"groupId":"10","name":"Canal","category":"Noticias","logo":"https://cdn/logo.jpg","squareLogo":"https://cdn/square.jpg"}],"pagination":{"hasMore":true}}}"""
        )
        assertEquals("10", channels.single().groupId)
        assertTrue(hasMore)
    }
}
