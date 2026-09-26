package com.tvdigital.player

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.WindowManager
import com.tvdigital.player.databinding.ActivityLoginBinding
import org.json.JSONObject
import java.util.concurrent.Executors

class LoginActivity : Activity() {
    private lateinit var binding: ActivityLoginBinding
    private val executor = Executors.newSingleThreadExecutor()
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        binding = ActivityLoginBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.serverInput.setText(getPreferences(MODE_PRIVATE).getString("server", BuildConfig.BACKEND_BASE_URL).orEmpty().replace("https://example.invalid/", ""))
        binding.loginButton.setOnClickListener { login() }
        binding.demoButton.setOnClickListener { startActivity(Intent(this, PlayerActivity::class.java).putExtra("demo", true)) }
    }
    private fun login() {
        val base = runCatching { AppApiClient.normalizeServer(binding.serverInput.text.toString(), BuildConfig.DEBUG) }
            .getOrElse { binding.statusText.text = it.message; return }
        val email = binding.emailInput.text.toString().trim()
        val password = binding.passwordInput.text.toString()
        if (email.isBlank() || password.isBlank()) { binding.statusText.text = "Completa tu correo y contraseña"; return }
        binding.loginButton.isEnabled = false
        binding.statusText.text = "Conectando…"
        executor.execute {
            val result = runCatching { AppApiClient(base).request("api/auth/login", JSONObject().put("email", email).put("password", password)).getJSONObject("data") }
            runOnUiThread {
                if (isDestroyed || isFinishing) return@runOnUiThread
                binding.loginButton.isEnabled = true
                result.onSuccess { data ->
                    SessionStore.baseUrl = base
                    SessionStore.token = data.getString("token")
                    SessionStore.userId = data.getJSONObject("user").get("id").toString()
                    SessionStore.name = data.getJSONObject("user").getString("nombre")
                    getPreferences(MODE_PRIVATE).edit().putString("server", base).apply()
                    binding.passwordInput.text.clear()
                    startActivity(Intent(this, CatalogActivity::class.java))
                    finish()
                }.onFailure { binding.statusText.text = it.message ?: "No se pudo iniciar sesión" }
            }
        }
    }
    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
