package com.tvdigital.player

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.view.inputmethod.EditorInfo
import android.widget.ArrayAdapter
import android.widget.AdapterView
import android.widget.Toast
import androidx.recyclerview.widget.GridLayoutManager
import com.tvdigital.player.databinding.ActivityCatalogBinding
import java.util.concurrent.Executors

class CatalogActivity : Activity() {
    private lateinit var binding: ActivityCatalogBinding
    private val executor = Executors.newSingleThreadExecutor()
    private val api by lazy { CatalogApiClient(SessionStore.baseUrl, SessionStore.token) }
    private val channelAdapter = ChannelAdapter(::openChannel, ::toggleFavorite)
    private var categories = emptyList<Category>()
    private var channels = emptyList<Channel>()
    private var spinnerInitialized = false
    private var favoritesOnly = false
    private var canPlay = false
    private var generation = 0
    private val preferences by lazy { getSharedPreferences("favorites", MODE_PRIVATE) }
    private val favoriteKey get() = "${SessionStore.baseUrl}|${SessionStore.userId}"
    private fun favorites() = preferences.getStringSet(favoriteKey, emptySet()).orEmpty().toSet()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (SessionStore.token.isBlank()) { logout(); return }
        binding = ActivityCatalogBinding.inflate(layoutInflater)
        setContentView(binding.root)
        binding.channelList.layoutManager = GridLayoutManager(this, if (resources.configuration.screenWidthDp >= 600) 4 else 2)
        binding.channelList.adapter = channelAdapter
        binding.searchButton.setOnClickListener { loadChannels() }
        binding.searchInput.setOnEditorActionListener { _, action, _ ->
            if (action == EditorInfo.IME_ACTION_SEARCH) { loadChannels(); true } else false
        }
        binding.logoutButton.setOnClickListener { logout() }
        binding.favoritesButton.setOnClickListener {
            favoritesOnly = !favoritesOnly
            binding.favoritesButton.text = if (favoritesOnly) "Ver todo" else "Ver favoritos"
            showChannels()
        }
        executor.execute {
            val result = runCatching { Triple(api.loadAccount(), api.loadCategories(), api.loadChannels()) }
            runOnUiThread {
                if (isDestroyed || isFinishing) return@runOnUiThread
                result.onSuccess { (account, groups, items) ->
                    canPlay = account.optBoolean("canPlay")
                    val end = account.optJSONObject("subscription")?.optString("vencimiento")
                    binding.accountStatus.text = "${SessionStore.name} · " + when {
                        end != null -> "Vence: $end"
                        canPlay -> "Vista de administrador"
                        else -> "Sin suscripción activa"
                    }
                    categories = groups; channels = items
                    binding.categorySpinner.adapter = ArrayAdapter(this, android.R.layout.simple_spinner_dropdown_item, listOf("Todas las categorías") + groups.map { it.name })
                    binding.categorySpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                        override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                        override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                            if (spinnerInitialized) loadChannels() else spinnerInitialized = true
                        }
                    }
                    showChannels()
                }.onFailure(::showError)
            }
        }
    }
    private fun loadChannels() {
        val current = ++generation
        val selected = binding.categorySpinner.selectedItemPosition
        val category = categories.getOrNull(selected - 1)?.name.orEmpty()
        val search = binding.searchInput.text.toString()
        binding.loading.visibility = View.VISIBLE
        executor.execute {
            val result = runCatching { api.loadChannels(category, search) }
            runOnUiThread {
                if (isDestroyed || isFinishing || current != generation) return@runOnUiThread
                result.onSuccess { channels = it; showChannels() }.onFailure(::showError)
            }
        }
    }
    private fun showChannels() {
        val ids = favorites()
        val shown = if (favoritesOnly) channels.filter { it.groupId in ids } else channels
        channelAdapter.submitList(shown, ids)
        binding.loading.visibility = View.GONE
        binding.emptyState.visibility = if (shown.isEmpty()) View.VISIBLE else View.GONE
        binding.catalogStatus.text = "${shown.size} contenidos disponibles"
    }
    private fun toggleFavorite(channel: Channel) {
        val ids = favorites().toMutableSet()
        if (!ids.add(channel.groupId)) ids.remove(channel.groupId)
        preferences.edit().putStringSet(favoriteKey, ids).apply()
        showChannels()
    }
    private fun openChannel(channel: Channel) {
        if (!canPlay) { Toast.makeText(this, "Contacta al administrador para activar tu suscripción", Toast.LENGTH_LONG).show(); return }
        startActivity(Intent(this, PlayerActivity::class.java).putExtra(PlayerActivity.EXTRA_CONTENT_ID, channel.groupId))
    }
    private fun showError(error: Throwable) {
        if (error is ApiException && error.status == 401) { logout(); return }
        binding.loading.visibility = View.GONE
        binding.catalogStatus.text = error.message ?: "No se pudo cargar el catálogo"
    }
    private fun logout() {
        SessionStore.clear()
        startActivity(Intent(this, LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        finish()
    }
    override fun onDestroy() { executor.shutdownNow(); super.onDestroy() }
}
