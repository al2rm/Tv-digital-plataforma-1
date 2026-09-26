package com.tvdigital.player

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.ImageView
import android.util.LruCache
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object RemoteImageLoader {
    private val executor = Executors.newFixedThreadPool(4)
    private val cache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun load(imageView: ImageView, url: String) {
        imageView.tag = url
        imageView.setImageDrawable(null)
        cache.get(url)?.let { imageView.setImageBitmap(it); return }
        if (!url.startsWith("https://")) return

        executor.execute {
            val bitmap = runCatching {
                val connection = URL(url).openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout = 8_000
                    connection.readTimeout = 10_000
                    connection.instanceFollowRedirects = false
                    if (connection.responseCode !in 200..299) return@runCatching null
                    BitmapFactory.decodeStream(connection.inputStream)
                } finally {
                    connection.disconnect()
                }
            }.getOrNull() ?: return@execute

            cache.put(url, bitmap)
            imageView.post {
                if (imageView.tag == url) imageView.setImageBitmap(bitmap)
            }
        }
    }
}
