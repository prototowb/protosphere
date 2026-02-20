import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { ChannelCategory } from '@/lib/types'

export const useCategoriesStore = defineStore('categories', () => {
  const categories = ref<ChannelCategory[]>([])

  return { categories }
})
