package com.tvdigital.player

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.tvdigital.player.databinding.ItemChannelBinding

class ChannelAdapter(
    private val onClick: (Channel) -> Unit,
    private val onFavorite: (Channel) -> Unit,
    private val onContentFocus: (Channel) -> Unit = {}
) : RecyclerView.Adapter<ChannelAdapter.ChannelViewHolder>() {
    private val items = mutableListOf<Channel>()

    private var favoriteIds = emptySet<String>()

    fun submitList(channels: List<Channel>, favorites: Set<String>) {
        favoriteIds = favorites
        items.clear()
        items.addAll(channels)
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int) = ChannelViewHolder(
        ItemChannelBinding.inflate(LayoutInflater.from(parent.context), parent, false)
    )

    override fun onBindViewHolder(holder: ChannelViewHolder, position: Int) = holder.bind(items[position])
    override fun getItemCount() = items.size

    inner class ChannelViewHolder(private val binding: ItemChannelBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(channel: Channel) {
            binding.favoriteIndicator.text = if (channel.groupId in favoriteIds) "★" else ""
            RemoteImageLoader.load(binding.channelLogo, channel.logo)
            binding.root.contentDescription = "${channel.name}. Mantén pulsado OK para marcar como favorito"
            binding.root.setOnClickListener { onClick(channel) }
            binding.root.setOnLongClickListener { onFavorite(channel); true }
            binding.root.setOnFocusChangeListener { _, hasFocus -> if (hasFocus) onContentFocus(channel) }
        }
    }
}
