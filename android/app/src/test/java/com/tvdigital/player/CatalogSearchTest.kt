package com.tvdigital.player
import org.junit.Assert.assertEquals
import org.junit.Test

class CatalogSearchTest {
    private val items=listOf(
        Channel("channel:1","Ñandutí","Paraguay","","","channel",false,"",""),
        Channel("movie:1","Película familiar","Infantil","","","movie",false,"","")
    )
    @Test fun matchesAccentsCaseAndCategory(){
        assertEquals("channel:1",CatalogSearch.filter(items,"NANDUTI paraguay").single().groupId)
        assertEquals("movie:1",CatalogSearch.filter(items,"PELICULA infantil").single().groupId)
    }
    @Test fun blankReturnsCatalogAndUnknownReturnsEmpty(){
        assertEquals(items,CatalogSearch.filter(items,"  "))
        assertEquals(0,CatalogSearch.filter(items,"inexistente").size)
    }
}
