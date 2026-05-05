<script setup lang="ts">
import { ref } from 'vue'
import type { Integration } from '@/lib/types'

const props = defineProps<{
  integration: Integration
}>()

const emit = defineEmits<{
  connect: [token?: string]
  cancel: []
}>()

const token = ref('')
const connecting = ref(false)

async function handleConnect() {
  connecting.value = true
  try {
    if (props.integration.auth_mode === 'token_exchange') {
      emit('connect', token.value.trim())
    } else {
      emit('connect')
    }
  } finally {
    connecting.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="emit('cancel')">
    <div class="absolute inset-0 bg-black/60" @click="emit('cancel')" />
    <div class="relative z-10 w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="text-lg font-bold text-text-primary">Connect {{ integration.name }}</h2>

      <!-- Same domain cookie: automatic -->
      <template v-if="integration.auth_mode === 'same_domain_cookie'">
        <p class="mt-3 text-sm text-text-secondary">
          This integration uses single sign-on. Your session will be shared automatically.
        </p>
        <div class="mt-5 flex justify-end gap-2">
          <button
            @click="emit('cancel')"
            class="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
          >Cancel</button>
          <button
            @click="handleConnect"
            :disabled="connecting"
            class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >{{ connecting ? 'Connecting...' : 'Connect' }}</button>
        </div>
      </template>

      <!-- Auth bridge (coming soon) -->
      <template v-else-if="integration.auth_mode === 'oauth_redirect'">
        <p class="mt-3 text-sm text-text-secondary">
          This integration uses an auth bridge that is not yet available. The admin has been notified.
        </p>
        <div class="mt-5 flex justify-end">
          <button
            @click="emit('cancel')"
            class="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
          >Close</button>
        </div>
      </template>

      <!-- Token exchange -->
      <template v-else-if="integration.auth_mode === 'token_exchange'">
        <p class="mt-3 text-sm text-text-secondary">
          Paste the connection token from {{ integration.name }} to link your accounts.
        </p>
        <input
          v-model="token"
          type="text"
          placeholder="Paste your connection token..."
          class="mt-3 w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent font-mono"
        />
        <div class="mt-5 flex justify-end gap-2">
          <button
            @click="emit('cancel')"
            class="rounded-md px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
          >Cancel</button>
          <button
            @click="handleConnect"
            :disabled="connecting || !token.trim()"
            class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50"
          >{{ connecting ? 'Connecting...' : 'Connect' }}</button>
        </div>
      </template>
    </div>
  </div>
</template>
