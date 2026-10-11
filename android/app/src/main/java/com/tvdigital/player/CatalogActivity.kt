package com.tvdigital.player

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.recyclerview.widget.LinearLayoutManager
import com.tvdigital.player.databinding.ActivityCatalogBinding
import java.util.concurrent.Executors

class CatalogActivity : Activity() {
    private lateinit var binding: ActivityCatalogBinding
    private val executor=Executors.newSingleThreadExecutor()
    private val api by lazy { CatalogApiClient(SessionStore.baseUrl,SessionStore.token) }
    private val sectionAdapter=TvSectionAdapter(::openChannel,::toggleFavorite,::collapseMenu)
    private var channels=emptyList<Channel>()
    private var canPlay=false
    private var generation=0
    private var firstResume=true
    private var mode=Mode.HOME
    private val preferences by lazy { getSharedPreferences("favorites",MODE_PRIVATE) }
    private val favoriteKey get()="${SessionStore.baseUrl}|${SessionStore.userId}"
    private fun favorites()=preferences.getStringSet(favoriteKey,emptySet()).orEmpty().toSet()

    override fun onCreate(savedInstanceState:Bundle?){
        super.onCreate(savedInstanceState)
        if(SessionStore.token.isBlank()&&!SessionStore.restore(this)){logout();return}
        binding=ActivityCatalogBinding.inflate(layoutInflater);setContentView(binding.root)
        binding.channelList.layoutManager=LinearLayoutManager(this)
        binding.channelList.adapter=sectionAdapter
        val menu=mapOf(binding.homeButton to Mode.HOME,binding.favoritesButton to Mode.FAVORITES,binding.moviesButton to Mode.MOVIES,binding.seriesButton to Mode.SERIES,binding.settingsButton to Mode.SETTINGS,binding.aboutButton to Mode.ABOUT)
        menu.forEach{(view,target)->view.setOnClickListener{show(target)};view.setOnFocusChangeListener{_,focused->if(focused)expandMenu()}}
        binding.refreshButton.setOnClickListener{refreshCatalog()}
        binding.logoutButton.setOnClickListener{logout()}
        binding.aboutText.text="TV Digital Pro\nVersión ${BuildConfig.VERSION_NAME}\n\nOK: abrir canal\nMantener OK: agregar o quitar favorito\nAtrás: volver a la pantalla anterior"
        refreshCatalog()
    }

    private fun refreshCatalog(){
        val current=++generation;binding.loading.visibility=View.VISIBLE
        executor.execute{
            val result=runCatching{val account=api.loadAccount(); CatalogRefresh(account,api.loadChannels())}
            runOnUiThread{
                if(isDestroyed||isFinishing||current!=generation)return@runOnUiThread
                result.onSuccess{refresh->
                    canPlay=refresh.account.optBoolean("canPlay")
                    val end=refresh.account.optJSONObject("subscription")?.optString("vencimiento")
                    binding.accountStatus.text=when{end!=null->"Suscripción activa hasta $end";canPlay->"Vista de administrador";else->"Suscripción pendiente"}
                    binding.settingsAccount.text="${SessionStore.name}\n${binding.accountStatus.text}"
                    channels=refresh.items;show(mode)
                }.onFailure(::showError)
            }
        }
    }

    private fun show(target:Mode){
        mode=target
        binding.catalogPanel.visibility=if(target in listOf(Mode.SETTINGS,Mode.ABOUT))View.GONE else View.VISIBLE
        binding.settingsPanel.visibility=if(target==Mode.SETTINGS)View.VISIBLE else View.GONE
        binding.aboutPanel.visibility=if(target==Mode.ABOUT)View.VISIBLE else View.GONE
        if(target in listOf(Mode.SETTINGS,Mode.ABOUT)){binding.loading.visibility=View.GONE;return}
        val ids=favorites()
        val visible=when(target){
            Mode.FAVORITES->channels.filter{it.groupId in ids}
            Mode.MOVIES->channels.filter{it.groupId.startsWith("movie:")}
            Mode.SERIES->emptyList()
            else->channels.filter{it.groupId.startsWith("channel:")}
        }
        val title=when(target){Mode.HOME->"Inicio";Mode.FAVORITES->"Favoritos";Mode.MOVIES->"Películas";Mode.SERIES->"Series";else->""}
        val sections=if(target==Mode.HOME) visible.groupBy{it.category}.map{ChannelSection(it.key,it.value)} else listOf(ChannelSection(title,visible)).filter{it.channels.isNotEmpty()}
        binding.screenTitle.text=title
        binding.catalogStatus.text="${visible.size} ${if(visible.size==1)"contenido" else "contenidos"}"
        binding.emptyState.text=if(target==Mode.SERIES)"Las series aparecerán aquí cuando se agreguen al panel" else "No hay contenido en esta sección"
        binding.emptyState.visibility=if(visible.isEmpty())View.VISIBLE else View.GONE
        binding.loading.visibility=View.GONE
        sectionAdapter.submitList(sections,ids)
    }

    private fun expandMenu(){setMenuWidth(220);binding.homeButton.text="⌂  Inicio";binding.favoritesButton.text="★  Favoritos";binding.moviesButton.text="▶  Películas";binding.seriesButton.text="▦  Series";binding.settingsButton.text="⚙  Configuración";binding.aboutButton.text="ⓘ  Sobre la app"}
    private fun collapseMenu(){setMenuWidth(72);binding.homeButton.text="⌂";binding.favoritesButton.text="★";binding.moviesButton.text="▶";binding.seriesButton.text="▦";binding.settingsButton.text="⚙";binding.aboutButton.text="ⓘ"}
    private fun setMenuWidth(dp:Int){binding.sideMenu.layoutParams=binding.sideMenu.layoutParams.apply{width=(dp*resources.displayMetrics.density).toInt()}}
    private fun toggleFavorite(channel:Channel){val ids=favorites().toMutableSet();val added=ids.add(channel.groupId);if(!added)ids.remove(channel.groupId);preferences.edit().putStringSet(favoriteKey,ids).apply();Toast.makeText(this,if(added)"Agregado a favoritos" else "Quitado de favoritos",Toast.LENGTH_SHORT).show();show(mode)}
    private fun openChannel(channel:Channel){if(!canPlay){Toast.makeText(this,"Contacta al administrador para activar tu suscripción",Toast.LENGTH_LONG).show();return};startActivity(Intent(this,PlayerActivity::class.java).putExtra(PlayerActivity.EXTRA_CONTENT_ID,channel.groupId))}
    private fun showError(error:Throwable){if(error is ApiException&&error.status==401){logout();return};binding.loading.visibility=View.GONE;binding.catalogStatus.text=error.message?:"No se pudo cargar el catálogo"}
    private fun logout(){SessionStore.clear(this);startActivity(Intent(this,LoginActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK));finish()}
    override fun onResume(){super.onResume();if(!::binding.isInitialized)return;if(firstResume)firstResume=false else refreshCatalog()}
    override fun onDestroy(){executor.shutdownNow();super.onDestroy()}
    private enum class Mode{HOME,FAVORITES,MOVIES,SERIES,SETTINGS,ABOUT}
    private data class CatalogRefresh(val account:org.json.JSONObject,val items:List<Channel>)
}
