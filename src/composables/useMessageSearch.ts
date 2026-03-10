import { ref, watch, type Ref } from 'vue'
import { backend } from '@/lib/backend'
import type { Profile, Message } from '@/lib/types'

interface SearchableMessage {
  id: string
  content: string
  created_at: string
  profile: Profile
}

// Overload 1: server-side channel search — pass a Ref<channelId>
export function useMessageSearch(channelId: Ref<string>): {
  query: Ref<string>
  results: Ref<(Message & { profile: Profile })[]>
  isOpen: Ref<boolean>
  open(): void
  close(): void
}

// Overload 2: client-side filter — pass a message getter function (legacy, for DMs)
export function useMessageSearch<T extends SearchableMessage>(getMessages: () => T[]): {
  query: Ref<string>
  results: Ref<T[]>
  isOpen: Ref<boolean>
  open(): void
  close(): void
}

export function useMessageSearch<T extends SearchableMessage>(
  source: Ref<string> | (() => T[])
) {
  const query = ref('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = ref<any[]>([])
  const isOpen = ref(false)
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  if (typeof source === 'function') {
    // Client-side filter (DMs)
    watch(query, (q) => {
      if (!q.trim()) {
        results.value = []
        return
      }
      const lower = q.toLowerCase()
      results.value = source().filter((m: T) =>
        m.content.toLowerCase().includes(lower)
      )
    })
  } else {
    // Server-side search (channels)
    watch(query, (q) => {
      if (debounceTimer) clearTimeout(debounceTimer)
      if (!q.trim()) {
        results.value = []
        return
      }
      debounceTimer = setTimeout(async () => {
        if (source.value) {
          results.value = await backend.messages.search(source.value, q)
        }
      }, 300)
    })
  }

  function open() {
    isOpen.value = true
    query.value = ''
    results.value = []
  }

  function close() {
    isOpen.value = false
    query.value = ''
    results.value = []
  }

  return { query, results, isOpen, open, close }
}
