import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DirectMessage, Profile } from '@/lib/types'
import type { DmGroupWithMeta } from '@/lib/backend/types'

export const useDmsStore = defineStore('dms', () => {
  const groups = ref<DmGroupWithMeta[]>([])
  const messagesByGroup = ref<Record<string, (DirectMessage & { profile: Profile })[]>>({})
  const activeDmGroupId = ref<string | null>(null)

  return { groups, messagesByGroup, activeDmGroupId }
})
