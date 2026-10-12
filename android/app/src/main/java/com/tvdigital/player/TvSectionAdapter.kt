package com.tvdigital.player

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.tvdigital.player.databinding.ItemChannelSectionBinding

data class ChannelSection(val title: String, val channels: List<Channel>)

class TvSectionAdapter(
    private val onClick: (Channel) -> Unit,
    private val onFavorite: (Channel) -> Unit,
    private val onContentFocus: (Channel) -> Unit
) : RecyclerView.Adapter<TvSectionAdapter.Holder>() {
    private var sections = emptyList<ChannelSection>()
    private var favorites = emptySet<String>()
    fun submitList(value: List<ChannelSection>, favoriteIds: Set<String>) { sections=value; favorites=favoriteIds; notifyDataSetChanged() }
    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
        val binding=ItemChannelSectionBinding.inflate(LayoutInflater.from(parent.context),parent,false)
        binding.sectionChannels.layoutManager=LinearLayoutManager(parent.context,RecyclerView.HORIZONTAL,false)
        return Holder(binding)
    }
    override fun onBindViewHolder(holder: Holder, position: Int)=holder.bind(sections[position])
    override fun getItemCount()=sections.size
    inner class Holder(private val binding: ItemChannelSectionBinding):RecyclerView.ViewHolder(binding.root){
        fun bind(section:ChannelSection){binding.sectionTitle.text=section.title; val adapter=ChannelAdapter(onClick,onFavorite,onContentFocus); binding.sectionChannels.adapter=adapter; adapter.submitList(section.channels,favorites)}
    }
}
