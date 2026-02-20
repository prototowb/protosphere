<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServers } from '@/composables/useServers'
import { backend } from '@/lib/backend'
import type { Server } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const { joinServer } = useServers()

const code = route.params.code as string
const server = ref<Server | null>(null)
const error = ref('')
const loading = ref(true)
const joining = ref(false)

onMounted(async () => {
  try {
    server.value = await backend.servers.getByInviteCode(code)
  } catch {
    error.value = 'Invalid or expired invite code'
  } finally {
    loading.value = false
  }
})

async function handleJoin() {
  joining.value = true
  try {
    await joinServer(code)
    if (server.value) {
      router.push(`/channels/${server.value.id}/${server.value.id}`)
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to join server'
  } finally {
    joining.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8 text-center">
      <template v-if="loading">
        <p class="text-text-secondary">Loading invite...</p>
      </template>

      <template v-else-if="error">
        <h1 class="mb-4 text-2xl font-bold">Invalid Invite</h1>
        <p class="mb-6 text-text-secondary">{{ error }}</p>
        <router-link to="/channels/@me" class="text-accent hover:underline">
          Go home
        </router-link>
      </template>

      <template v-else-if="server">
        <h1 class="mb-2 text-2xl font-bold">You've been invited to</h1>
        <div class="my-6">
          <div class="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-tertiary text-xl font-bold text-text-primary">
            {{ server.name.charAt(0).toUpperCase() }}
          </div>
          <p class="text-lg font-semibold">{{ server.name }}</p>
          <p v-if="server.description" class="mt-1 text-sm text-text-secondary">{{ server.description }}</p>
          <p class="mt-1 text-xs text-text-muted">{{ server.member_count }} member{{ server.member_count !== 1 ? 's' : '' }}</p>
        </div>
        <button
          @click="handleJoin"
          :disabled="joining"
          class="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {{ joining ? 'Joining...' : 'Accept Invite' }}
        </button>
      </template>
    </div>
  </div>
</template>
