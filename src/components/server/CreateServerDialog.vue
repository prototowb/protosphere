<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  create: [name: string, description: string]
  close: []
}>()

const name = ref('')
const description = ref('')
const loading = ref(false)

async function handleSubmit() {
  if (!name.value.trim()) return
  loading.value = true
  emit('create', name.value.trim(), description.value.trim())
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create a Server</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="server-name" class="mb-1 block text-sm text-text-secondary">Server Name</label>
          <input
            id="server-name"
            v-model="name"
            type="text"
            required
            maxlength="100"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="My Awesome Server"
          />
        </div>

        <div>
          <label for="server-desc" class="mb-1 block text-sm text-text-secondary">Description (optional)</label>
          <textarea
            id="server-desc"
            v-model="description"
            maxlength="1000"
            rows="2"
            class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="What's this server about?"
          />
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
            {{ loading ? 'Creating...' : 'Create Server' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
