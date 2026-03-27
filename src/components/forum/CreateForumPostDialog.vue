<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ForumPostType } from '@/lib/types'

defineProps<{
  spaceId: string
  sourceMessageId?: string | null
}>()

const emit = defineEmits<{
  confirm: [type: ForumPostType, title: string, body: string]
  cancel: []
}>()

const title = ref('')
const body = ref('')
const type = ref<ForumPostType>('thread')

const canSubmit = computed(() =>
  title.value.trim().length > 0 &&
  (type.value === 'page' || body.value.trim().length > 0)
)

function submit() {
  if (!canSubmit.value) return
  emit('confirm', type.value, title.value.trim(), body.value.trim())
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('cancel')">
    <div class="w-full max-w-lg rounded-lg bg-bg-secondary shadow-xl">
      <!-- Header -->
      <div class="border-b border-bg-tertiary px-6 py-4">
        <h2 class="text-base font-semibold text-text-primary">Create forum post</h2>
        <p class="mt-0.5 text-xs text-text-muted">Pinned permanently — exempt from message expiry.</p>
      </div>

      <div class="p-6">
        <!-- Post type -->
        <div class="mb-4">
          <p class="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Post type</p>
          <div class="flex gap-2">
            <button
              v-for="t in (['thread', 'page'] as ForumPostType[])"
              :key="t"
              @click="type = t"
              class="flex-1 rounded-md border px-3 py-2 text-left transition-colors"
              :class="type === t
                ? 'border-accent bg-accent/10 text-text-primary'
                : 'border-bg-tertiary bg-bg-primary text-text-muted hover:border-accent/50'"
            >
              <p class="text-sm font-medium capitalize">{{ t }}</p>
              <p class="text-xs opacity-70">
                {{ t === 'thread' ? 'Discussion + voting' : 'Block editor document' }}
              </p>
            </button>
          </div>
        </div>

        <!-- Title -->
        <div class="mb-4">
          <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">Title</label>
          <input
            v-model="title"
            type="text"
            placeholder="Post title…"
            maxlength="200"
            autofocus
            class="w-full rounded-md bg-bg-primary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none ring-1 ring-bg-tertiary focus:ring-accent"
            @keydown.escape="emit('cancel')"
          />
        </div>

        <!-- Body (thread type only) -->
        <div v-if="type === 'thread'" class="mb-5">
          <label class="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-muted">Your reply</label>
          <div class="rounded-lg bg-bg-primary ring-1 ring-bg-tertiary focus-within:ring-accent overflow-hidden">
            <textarea
              v-model="body"
              placeholder="Write your opening post…"
              rows="4"
              class="w-full resize-none bg-transparent px-3 py-2.5 text-sm text-text-primary placeholder-text-muted outline-none"
              @keydown.ctrl.enter="submit"
              @keydown.escape="emit('cancel')"
            />
            <div class="flex items-center justify-between border-t border-bg-tertiary px-3 py-1.5">
              <span class="text-[11px] text-text-muted">Ctrl+Enter to submit</span>
              <span class="text-[11px]" :class="body.length > 3800 ? 'text-red-400' : 'text-text-muted'">{{ body.length }} / 4000</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="flex justify-end gap-2 border-t border-bg-tertiary px-6 py-4">
        <button
          @click="emit('cancel')"
          class="rounded-md px-4 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          @click="submit"
          :disabled="!canSubmit"
          class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          Create post
        </button>
      </div>
    </div>
  </div>
</template>
