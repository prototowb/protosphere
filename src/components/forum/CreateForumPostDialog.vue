<script setup lang="ts">
import { ref } from 'vue'
import type { ForumPostType } from '@/lib/types'

const props = defineProps<{
  spaceId: string
  sourceMessageId?: string | null
}>()

const emit = defineEmits<{
  confirm: [type: ForumPostType, title: string]
  cancel: []
}>()

const title = ref('')
const type = ref<ForumPostType>('meta')
const submitting = ref(false)

function submit() {
  if (!title.value.trim() || submitting.value) return
  submitting.value = true
  emit('confirm', type.value, title.value.trim())
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('cancel')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6 shadow-xl">
      <h2 class="mb-1 text-lg font-semibold text-text-primary">Create Forum Post</h2>
      <p class="mb-5 text-sm text-text-muted">This message will be pinned permanently as a forum post.</p>

      <!-- Post type -->
      <div class="mb-4">
        <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Post type</p>
        <div class="flex gap-3">
          <button
            v-for="t in (['meta', 'page'] as ForumPostType[])"
            :key="t"
            @click="type = t"
            class="flex-1 rounded-md border px-3 py-2.5 text-left transition-colors"
            :class="type === t
              ? 'border-accent bg-accent/10 text-text-primary'
              : 'border-bg-tertiary bg-bg-primary text-text-muted hover:border-accent/50'"
          >
            <p class="text-sm font-medium capitalize">{{ t }}</p>
            <p class="text-xs opacity-70">
              {{ t === 'meta' ? 'Classic forum — discussion + voting' : 'Block editor — structured document' }}
            </p>
          </button>
        </div>
      </div>

      <!-- Title -->
      <div class="mb-5">
        <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">Title</label>
        <input
          v-model="title"
          type="text"
          placeholder="Post title…"
          maxlength="200"
          autofocus
          class="w-full rounded-md bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
          @keydown.enter.prevent="submit"
          @keydown.escape="emit('cancel')"
        />
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2">
        <button
          @click="emit('cancel')"
          class="rounded-md px-4 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="!title.trim() || submitting"
          class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Create
        </button>
      </div>
    </div>
  </div>
</template>
