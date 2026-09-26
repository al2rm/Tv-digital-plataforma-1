package com.tvdigital.player

import android.app.Activity
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.tvdigital.player.databinding.ActivityPlayerBinding
import java.util.concurrent.Executors

class PlayerActivity : Activity() {
    private lateinit var binding: ActivityPlayerBinding
    private val executor = Executors.newSingleThreadExecutor()
    private var player: ExoPlayer? = null
    private var started = false
    private var requestGeneration = 0
    private var position = 0L
    private var resumePlaying = true
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        binding = ActivityPlayerBinding.inflate(layoutInflater)
        setContentView(binding.root)
        position = savedInstanceState?.getLong("position") ?: 0
        binding.playButton.setOnClickListener { load() }
    }
    override fun onStart() { super.onStart(); started = true; load() }
    private fun load() {
        val current = ++requestGeneration
        binding.loading.visibility = View.VISIBLE
        binding.setupPanel.visibility = View.VISIBLE
        binding.playButton.isEnabled = false
        binding.statusText.text = "Preparando reproducción…"
        val demo = intent.getBooleanExtra("demo", false)
        val id = intent.getStringExtra(EXTRA_CONTENT_ID).orEmpty()
        executor.execute {
            val result = runCatching {
                if (demo) PlaybackSession.demo()
                else {
                    check(SessionStore.token.isNotBlank()) { "Tu sesión terminó. Vuelve a iniciar sesión." }
                    PlaybackSessionClient(SessionStore.baseUrl).load(id, SessionStore.token)
                }
            }
            runOnUiThread {
                if (!started || isDestroyed || current != requestGeneration) return@runOnUiThread
                binding.loading.visibility = View.GONE
                binding.playButton.isEnabled = true
                result.onSuccess { session ->
                    release()
                    runCatching { TvPlayerFactory.create(this, session) }.onSuccess { created ->
                        player = created; binding.playerView.player = created
                        binding.setupPanel.visibility = View.GONE
                        created.seekTo(position); created.playWhenReady = resumePlaying
                        created.addListener(object : Player.Listener {
                            override fun onPlayerError(error: PlaybackException) { showError("No se pudo reproducir. Comprueba tu conexión y vuelve a intentarlo.") }
                        })
                    }.onFailure { showError(it.message ?: "No se pudo iniciar el reproductor") }
                }.onFailure { showError(it.message ?: "No se pudo conectar") }
            }
        }
    }
    private fun showError(message: String) {
        release(); binding.setupPanel.visibility = View.VISIBLE
        binding.statusText.text = message; binding.playButton.isEnabled = true
    }
    private fun release() { binding.playerView.player = null; player?.release(); player = null }
    override fun onSaveInstanceState(out: Bundle) { out.putLong("position", player?.currentPosition ?: position); super.onSaveInstanceState(out) }
    override fun onStop() {
        started = false; requestGeneration++
        player?.let { position = if (it.isCurrentMediaItemLive) 0 else it.currentPosition; resumePlaying = it.playWhenReady }
        release(); super.onStop()
    }
    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
    companion object { const val EXTRA_CONTENT_ID = "contentId" }
}
