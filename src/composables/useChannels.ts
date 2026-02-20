import { backend } from '@/lib/backend'
import { useChannelsStore } from '@/stores/channels'

export function useChannels() {
  const channelsStore = useChannelsStore()

  async function fetchChannels(serverId: string) {
    channelsStore.channels = await backend.channels.list(serverId)
  }

  async function createChannel(serverId: string, name: string, description?: string, categoryId?: string | null) {
    const channel = await backend.channels.create({
      server_id: serverId,
      name,
      description,
      category_id: categoryId ?? null,
    })
    channelsStore.channels.push(channel)
    return channel
  }

  async function updateChannel(id: string, updates: { name?: string; description?: string; slowmode_seconds?: number; position?: number; category_id?: string | null }) {
    const channel = await backend.channels.update(id, updates)
    const idx = channelsStore.channels.findIndex((c) => c.id === id)
    if (idx !== -1) channelsStore.channels[idx] = channel
    return channel
  }

  async function deleteChannel(id: string) {
    await backend.channels.delete(id)
    channelsStore.channels = channelsStore.channels.filter((c) => c.id !== id)
    if (channelsStore.activeChannelId === id) {
      channelsStore.activeChannelId = null
    }
  }

  return {
    fetchChannels,
    createChannel,
    updateChannel,
    deleteChannel,
  }
}
