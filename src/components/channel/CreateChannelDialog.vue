<script setup lang="ts">
import { ref } from 'vue'
import type { ChannelCategory } from '@/lib/types'

defineProps<{
  categories: ChannelCategory[]
}>()

const emit = defineEmits<{
  create: [name: string, categoryId: string | null]
  close: []
}>()

const name = ref('')
const categoryId = ref<string | null>(null)

function submit() {
  if (!name.value.trim()) return
  emit('create', name.value.trim(), categoryId.value)
  name.value = ''
  categoryId.value = null
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create Channel</h2>
      <form @submit.prevent="submit" class="space-y-4">
        <div>
          <label for="channel-name" class="mb-1 block text-sm text-text-secondary">Channel Name</label>
          <input
            id="channel-name"
            v-model="name"
            type="text"
            required
            maxlength="50"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="new-channel"
          />
        </div>
        <div v-if="categories.length > 0">
          <label for="channel-category" class="mb-1 block text-sm text-text-secondary">Category (optional)</label>
          <select
            id="channel-category"
            v-model="categoryId"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          >
            <option :value="null">No category</option>
            <option v-for="cat in categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" @click="emit('close')" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" :disabled="!name.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Create</button>
        </div>
      </form>
    </div>
  </div>
</template>
