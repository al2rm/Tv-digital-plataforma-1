package com.tvdigital.player

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.widget.ImageView
import android.util.LruCache
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors

object RemoteImageLoader {
    private val executor = Executors.newFixedThreadPool(4)
    private val cache = object : LruCache<String, Bitmap>(8 * 1024 * 1024) {
        override fun sizeOf(key: String, value: Bitmap) = value.byteCount
    }

    fun load(imageView: ImageView, url: String, onResult: (Boolean) -> Unit = {}) {
        imageView.tag = url
        imageView.setImageDrawable(null)
        cache.get(url)?.let { imageView.setImageBitmap(it); onResult(true); return }
        if (!(url.startsWith("https://") || (BuildConfig.ALLOW_HTTP_STREAMS && url.startsWith("http://")))) { onResult(false); return }

        executor.execute {
            val bitmap = runCatching {
                val connection = URL(url).openConnection() as HttpURLConnection
                try {
                    connection.connectTimeout = 8_000
                    connection.readTimeout = 10_000
                    connection.instanceFollowRedirects = false
                    if (connection.responseCode !in 200..299) return@runCatching null
                    if(connection.contentLengthLong>2*1024*1024)return@runCatching null
                    val bytes=connection.inputStream.use{input->
                        val output=ByteArrayOutputStream()
                        val chunk=ByteArray(8192)
                        while(output.size()<=2*1024*1024){
                            val count=input.read(chunk)
                            if(count<0)break
                            output.write(chunk,0,count)
                        }
                        output.toByteArray()
                    }
                    if(bytes.size>2*1024*1024)return@runCatching null
                    val bounds=BitmapFactory.Options().apply{inJustDecodeBounds=true}
                    BitmapFactory.decodeByteArray(bytes,0,bytes.size,bounds)
                    if(bounds.outWidth<=0||bounds.outHeight<=0)return@runCatching null
                    val options=BitmapFactory.Options().apply{inSampleSize=1}
                    while(bounds.outWidth/options.inSampleSize>512 || bounds.outHeight/options.inSampleSize>512)options.inSampleSize*=2
                    BitmapFactory.decodeByteArray(bytes,0,bytes.size,options)
                } finally {
                    connection.disconnect()
                }
            }.getOrNull()

            if(bitmap!=null)cache.put(url, bitmap)
            imageView.post {
                if (imageView.tag == url) {imageView.setImageBitmap(bitmap);onResult(bitmap!=null)}
            }
        }
    }
}
