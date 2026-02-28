import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { Channel } from '@/lib/types'

export function useThreads() {
  const threads = ref<Channel[]>([])

  async function fetchThreadsForChannel(channelId: string) {
    threads.value = await backend.threads.listByChannel(channelId)
  }

  async function createThread(
    serverId: string,
    parentChannelId: string,
    parentMessageId: string,
    name: string,
  ): Promise<Channel> {
    const thread = await backend.threads.create(serverId, parentChannelId, parentMessageId, name)
    threads.value.push(thread)
    return thread
  }

  return { threads, fetchThreadsForChannel, createThread }
}
