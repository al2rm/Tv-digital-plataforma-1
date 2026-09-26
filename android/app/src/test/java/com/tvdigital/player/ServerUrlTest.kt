package com.tvdigital.player
import org.junit.Assert.assertEquals
import org.junit.Test
class ServerUrlTest {
 @Test fun normalizesHttps() { assertEquals("https://tv.example/", AppApiClient.normalizeServer(" https://tv.example ")) }
 @Test(expected=IllegalArgumentException::class) fun rejectsInsecureRelease() { AppApiClient.normalizeServer("http://tv.example/") }
 @Test(expected=IllegalArgumentException::class) fun rejectsEmbeddedCredentials() { AppApiClient.normalizeServer("https://secret@tv.example/") }
 @Test(expected=IllegalArgumentException::class) fun rejectsQuerySecrets() { AppApiClient.normalizeServer("https://tv.example/?key=secret") }
 @Test fun permitsLocalDebug() { assertEquals("http://10.0.2.2:3000/", AppApiClient.normalizeServer("http://10.0.2.2:3000", true)) }
}
