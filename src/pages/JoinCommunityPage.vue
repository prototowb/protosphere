<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const toastStore = useToastStore()

const status = ref<'validating' | 'valid' | 'invalid' | 'used' | 'success'>('validating')
const errorMsg = ref('')
const loading = ref(false)

onMounted(async () => {
  const token = route.params.token as string
  const invite = await backend.community_invites.validate(token)
  if (!invite) {
    status.value = 'invalid'
  } else {
    status.value = 'valid'
  }
})

async function handleJoin() {
  if (!authStore.user?.id) {
    router.push({ name: 'register', query: { inviteToken: route.params.token as string } })
    return
  }
  loading.value = true
  try {
    const token = route.params.token as string
    await backend.community_invites.use(token, authStore.user.id)
    status.value = 'success'
    toastStore.show('Welcome to the community!', 'success')
    setTimeout(() => router.push('/channels/@me'), 1500)
  } catch (e: unknown) {
    errorMsg.value = e instanceof Error ? e.message : 'Failed to join'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8 text-center">

      <!-- Validating -->
      <div v-if="status === 'validating'" class="text-text-secondary">
        Checking invite link...
      </div>

      <!-- Invalid -->
      <div v-else-if="status === 'invalid'">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold">Invalid Invite</h1>
        <p class="mt-2 text-text-secondary">This invite link is invalid, expired, or has already been used.</p>
        <router-link to="/" class="mt-4 inline-block text-sm text-accent hover:underline">Go home</router-link>
      </div>

      <!-- Success -->
      <div v-else-if="status === 'success'">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold">You're in!</h1>
        <p class="mt-2 text-text-secondary">Redirecting you to the community...</p>
      </div>

      <!-- Valid invite -->
      <div v-else>
        <div class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent/20 text-accent text-2xl font-bold">
          PS
        </div>
        <h1 class="text-xl font-bold">You're invited!</h1>
        <p class="mt-2 text-text-secondary">You've been invited to join the community.</p>
        <div v-if="errorMsg" class="mt-3 rounded bg-red-500/10 px-3 py-2 text-sm text-red-400">{{ errorMsg }}</div>
        <button
          @click="handleJoin"
          :disabled="loading"
          class="mt-6 w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {{ loading ? 'Joining...' : authStore.isAuthenticated ? 'Accept Invite' : 'Register to Join' }}
        </button>
        <p v-if="!authStore.isAuthenticated" class="mt-3 text-sm text-text-muted">
          Already have an account?
          <router-link :to="{ name: 'login', query: { redirect: `/join/${route.params.token}` } }" class="text-accent hover:underline">
            Sign in
          </router-link>
        </p>
      </div>

    </div>
  </div>
</template>
