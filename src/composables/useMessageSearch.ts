import { ref, watch, type Ref } from 'vue'
import type { Profile } from '@/lib/types'

interface SearchableMessage {
  id: string
  content: string
  created_at: string
  profile: Profile
}

export function useMessageSearch<T extends SearchableMessage>(getMessages: () => T[]) {
  const query = ref('')
  const results: Ref<T[]> = ref([])
  const isOpen = ref(false)

  watch(query, (q) => {
    if (!q.trim()) {
      results.value = []
      return
    }
    const lower = q.toLowerCase()
    results.value = getMessages().filter((m) =>
      m.content.toLowerCase().includes(lower),
    )
  })

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
