<script setup lang="ts">
import { ref } from 'vue'
import type { SpaceVisibility } from '@/lib/types'

const emit = defineEmits<{
  create: [name: string, description: string, visibility: SpaceVisibility]
  close: []
}>()

const name = ref('')
const description = ref('')
const visibility = ref<SpaceVisibility>('public')
const loading = ref(false)

async function handleSubmit() {
  if (!name.value.trim()) return
  loading.value = true
  emit('create', name.value.trim(), description.value.trim(), visibility.value)
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create a Space</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="space-name" class="mb-1 block text-sm text-text-secondary">Space Name</label>
          <input
            id="space-name"
            v-model="name"
            type="text"
            required
            maxlength="100"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="My Awesome Space"
          />
        </div>

        <div>
          <label for="space-desc" class="mb-1 block text-sm text-text-secondary">Description (optional)</label>
          <textarea
            id="space-desc"
            v-model="description"
            maxlength="1000"
            rows="2"
            class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="What's this space about?"
          />
        </div>

        <div>
          <label class="mb-1 block text-sm text-text-secondary">Visibility</label>
          <div class="grid grid-cols-3 gap-2">
            <label
              v-for="opt in [
                { value: 'public', label: 'Public', desc: 'Anyone can join' },
                { value: 'restricted', label: 'Restricted', desc: 'Visible, invite only' },
                { value: 'private', label: 'Private', desc: 'Members only' },
              ]"
              :key="opt.value"
              class="cursor-pointer rounded border p-2 text-center transition-colors"
              :class="visibility === opt.value ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:border-bg-hover'"
            >
              <input v-model="visibility" type="radio" :value="opt.value" class="sr-only" />
              <p class="text-sm font-medium">{{ opt.label }}</p>
              <p class="text-[11px] text-text-muted">{{ opt.desc }}</p>
            </label>
          </div>
        </div>

        <div class="flex justify-end gap-2">
          <button
            type="button"
            @click="emit('close')"
            class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            :disabled="loading || !name.trim()"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ loading ? 'Creating...' : 'Create Space' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
