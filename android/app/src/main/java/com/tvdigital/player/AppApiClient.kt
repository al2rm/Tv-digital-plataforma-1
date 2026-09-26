package com.tvdigital.player

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URI

class ApiException(val status: Int, message: String) : IOException(message)
class AppApiClient(private val baseUrl: String, private val token: String = "") {
    fun request(path: String, payload: JSONObject? = null): JSONObject {
        val connection = URI(baseUrl).resolve(path).toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            if (token.isNotBlank()) connection.setRequestProperty("Authorization", "Bearer $token")
            if (payload != null) {
                connection.requestMethod = "POST"
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json")
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val raw = (if (status in 200..299) connection.inputStream else connection.errorStream)
                ?.bufferedReader()?.use { it.readText() }.orEmpty()
            val root = runCatching { JSONObject(raw) }.getOrNull()
            if (status !in 200..299 || root?.optBoolean("ok") != true) {
                throw ApiException(status, root?.optString("message")?.takeIf { it.isNotBlank() }
                    ?: "No se pudo conectar al servicio (HTTP $status). Revisa la dirección del servidor.")
            }
            return root
        } finally { connection.disconnect() }
    }
    companion object {
        fun normalizeServer(input: String, debug: Boolean = false): String {
            val url = runCatching { URI(input.trim()) }.getOrNull()
            require(url != null && !url.host.isNullOrBlank() && url.userInfo == null && url.query == null && url.fragment == null) { "Escribe una dirección de servidor válida" }
            require(url.scheme == "https" || (debug && url.scheme == "http")) { "El servidor debe usar HTTPS" }
            return url.toString().trimEnd('/') + "/"
        }
    }
}
