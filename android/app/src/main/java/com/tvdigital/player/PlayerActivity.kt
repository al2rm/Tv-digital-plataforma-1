package com.tvdigital.player

import android.app.Activity
import android.os.Bundle
import android.os.Handler
import android.os.Looper
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
    private val playbackHandler = Handler(Looper.getMainLooper())
    private var player: ExoPlayer? = null
    private var candidates = emptyList<PlaybackSession>()
    private var candidateIndex = 0
    private var renderedFirstFrame = false
    private var started = false
    private var requestGeneration = 0
    private var position = 0L
    private var resumePlaying = true
    private val firstFrameTimeout = Runnable {
        if (!started || renderedFirstFrame) return@Runnable
        val detail = if (player?.videoFormat == null) {
            "El canal respondió sin una pista de video compatible."
        } else {
            "El canal tardó demasiado en entregar la imagen."
        }
        tryNextCandidate(detail)
    }
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
                    candidates = session.playbackCandidates()
                    candidateIndex = 0
                    startCandidate()
                }.onFailure { showError(it.message ?: "No se pudo conectar") }
            }
        }
    }

    private fun startCandidate() {
        val session = candidates.getOrNull(candidateIndex)
            ?: return showError("No encontramos un formato reproducible para este canal.")
        releasePlayer()
        renderedFirstFrame = false
        binding.setupPanel.visibility = View.VISIBLE
        binding.loading.visibility = View.VISIBLE
        binding.playButton.isEnabled = false
        binding.statusText.text = if (candidateIndex == 0 && candidates.size > 1) {
            "Conectando por HLS, el formato recomendado…"
        } else if (candidateIndex > 0) {
            "HLS no respondió. Probando la señal TS original…"
        } else {
            "Conectando con el canal…"
        }

        runCatching { TvPlayerFactory.create(this, session) }.onSuccess { created ->
            player = created
            binding.playerView.player = created
            created.addListener(object : Player.Listener {
                override fun onPlaybackStateChanged(playbackState: Int) {
                    when (playbackState) {
                        Player.STATE_BUFFERING -> {
                            binding.loading.visibility = View.VISIBLE
                            binding.statusText.text = "Recibiendo la señal del canal…"
                        }
                        Player.STATE_READY -> {
                            binding.statusText.text = "Señal recibida. Esperando la primera imagen…"
                        }
                        Player.STATE_ENDED -> tryNextCandidate("La transmisión terminó sin mostrar video.")
                    }
                }

                override fun onRenderedFirstFrame() {
                    renderedFirstFrame = true
                    playbackHandler.removeCallbacks(firstFrameTimeout)
                    binding.loading.visibility = View.GONE
                    binding.setupPanel.visibility = View.GONE
                }

                override fun onPlayerError(error: PlaybackException) {
                    tryNextCandidate("El proveedor rechazó o interrumpió la señal (${error.errorCodeName}).")
                }
            })
            created.seekTo(position)
            created.playWhenReady = resumePlaying
            created.prepare()
            playbackHandler.postDelayed(firstFrameTimeout, FIRST_FRAME_TIMEOUT_MS)
        }.onFailure {
            tryNextCandidate(it.message ?: "No se pudo iniciar el reproductor")
        }
    }

    private fun tryNextCandidate(lastError: String) {
        playbackHandler.removeCallbacks(firstFrameTimeout)
        if (candidateIndex + 1 < candidates.size) {
            candidateIndex++
            position = 0
            startCandidate()
        } else {
            showError("$lastError Prueba otro canal o consulta al proveedor.")
        }
    }

    private fun showError(message: String) {
        release(); binding.setupPanel.visibility = View.VISIBLE
        binding.loading.visibility = View.GONE
        binding.statusText.text = message; binding.playButton.isEnabled = true
    }
    private fun releasePlayer() {
        playbackHandler.removeCallbacks(firstFrameTimeout)
        binding.playerView.player = null
        player?.release()
        player = null
    }
    private fun release() {
        releasePlayer()
        candidates = emptyList()
        candidateIndex = 0
        renderedFirstFrame = false
    }
    override fun onSaveInstanceState(out: Bundle) { out.putLong("position", player?.currentPosition ?: position); super.onSaveInstanceState(out) }
    override fun onStop() {
        started = false; requestGeneration++
        player?.let { position = if (it.isCurrentMediaItemLive) 0 else it.currentPosition; resumePlaying = it.playWhenReady }
        release(); super.onStop()
    }
    override fun onDestroy() {
        playbackHandler.removeCallbacksAndMessages(null)
        executor.shutdownNow()
        super.onDestroy()
    }
    companion object {
        const val EXTRA_CONTENT_ID = "contentId"
        private const val FIRST_FRAME_TIMEOUT_MS = 18_000L
    }
}
