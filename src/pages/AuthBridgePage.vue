<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { backend, isLocalMode } from '@/lib/backend'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/auth'
import type { AuthBridgeResult } from '@/lib/types'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const state = ref<'loading' | 'onboarding' | 'error'>('loading')
const error = ref('')
const bridgeResult = ref<Extract<AuthBridgeResult, { status: 'new_user' }> | null>(null)

const username = ref('')
const usernameError = ref('')
const submitting = ref(false)

onMounted(async () => {
  const token = route.query.token as string | undefined
  if (!token) {
    error.value = 'Missing token parameter'
    state.value = 'error'
    return
  }

  try {
    const result = await backend.bridge.validate(token)

    if (result.status === 'logged_in') {
      // Existing user — establish session and redirect
      if (!isLocalMode && supabase) {
        await supabase.auth.setSession({
          access_token: result.session.access_token,
          refresh_token: result.session.refresh_token,
        })
      }
      // In local mode, session is already set by the backend
      router.replace('/channels/@me')
    } else {
      // New user — show onboarding form
      bridgeResult.value = result
      username.value = result.suggested_username
      state.value = 'onboarding'
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Bridge validation failed'
    state.value = 'error'
  }
})

function validateUsername(value: string): string {
  if (value.length < 3) return 'Username must be at least 3 characters'
  if (value.length > 32) return 'Username must be 32 characters or fewer'
  if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Only letters, numbers, and underscores'
  return ''
}

async function handleComplete() {
  if (!bridgeResult.value) return

  usernameError.value = validateUsername(username.value)
  if (usernameError.value) return

  submitting.value = true
  error.value = ''

  try {
    const result = await backend.bridge.completeRegistration({
      temp_token: bridgeResult.value.temp_token,
      username: username.value,
    })

    if (!isLocalMode && supabase) {
      await supabase.auth.setSession({
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      })
    }

    // Wait briefly for auth state to propagate
    await new Promise((r) => setTimeout(r, 100))

    if (authStore.isAuthenticated) {
      router.replace('/channels/@me')
    } else {
      // Fallback: redirect to login
      router.replace('/login')
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Account creation failed'
    submitting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8">

      <!-- Loading state -->
      <template v-if="state === 'loading'">
        <div class="flex flex-col items-center gap-4 py-8">
          <div class="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p class="text-text-secondary">Verifying your credentials...</p>
        </div>
      </template>

      <!-- Onboarding state -->
      <template v-else-if="state === 'onboarding' && bridgeResult">
        <h1 class="mb-1 text-2xl font-bold">Welcome to the community</h1>
        <p class="mb-6 text-sm text-text-secondary">
          You're joining from <span class="font-medium text-text-primary">{{ bridgeResult.integration_slug }}</span>. Pick a username to get started.
        </p>

        <div v-if="error" class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {{ error }}
        </div>

        <form @submit.prevent="handleComplete" class="space-y-4">
          <div>
            <label for="bridge-username" class="mb-1 block text-sm text-text-secondary">Username</label>
            <input
              id="bridge-username"
              v-model="username"
              type="text"
              autocomplete="username"
              maxlength="32"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              @input="usernameError = ''"
            />
            <p v-if="usernameError" class="mt-1 text-xs text-red-400">{{ usernameError }}</p>
          </div>

          <div class="rounded bg-bg-primary px-3 py-2 text-sm text-text-secondary">
            <p><span class="text-text-tertiary">Email:</span> {{ bridgeResult.email }}</p>
            <p v-if="bridgeResult.display_name">
              <span class="text-text-tertiary">Display name:</span> {{ bridgeResult.display_name }}
            </p>
          </div>

          <button
            type="submit"
            :disabled="submitting || !username.trim()"
            class="w-full rounded bg-accent py-2 font-medium text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
          >
            {{ submitting ? 'Creating account...' : 'Join community' }}
          </button>
        </form>
      </template>

      <!-- Error state -->
      <template v-else-if="state === 'error'">
        <h1 class="mb-2 text-xl font-bold">Unable to sign in</h1>
        <div class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {{ error }}
        </div>
        <p class="mb-4 text-sm text-text-secondary">
          You can try logging in with your existing account or create a new one.
        </p>
        <div class="flex gap-2">
          <router-link
            to="/login"
            class="rounded bg-bg-tertiary px-4 py-2 text-sm text-text-primary transition-colors hover:bg-bg-hover"
          >
            Log in
          </router-link>
          <router-link
            to="/register"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover"
          >
            Register
          </router-link>
        </div>
      </template>

    </div>
  </div>
</template>
