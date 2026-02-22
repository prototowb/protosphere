<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  join: [inviteCode: string, done: (error?: string) => void]
  close: []
}>()

const inviteCode = ref('')
const loading = ref(false)
const error = ref('')

function handleSubmit() {
  if (!inviteCode.value.trim()) return
  loading.value = true
  error.value = ''
  emit('join', inviteCode.value.trim(), (err?: string) => {
    loading.value = false
    if (err) error.value = err
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Join a Server</h2>

      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div>
          <label for="invite-code" class="mb-1 block text-sm text-text-secondary">Invite Code</label>
          <input
            id="invite-code"
            v-model="inviteCode"
            type="text"
            required
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="Enter an invite code"
          />
        </div>

        <p v-if="error" class="text-sm text-red-400">{{ error }}</p>

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
            :disabled="loading || !inviteCode.trim()"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ loading ? 'Joining...' : 'Join Server' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
