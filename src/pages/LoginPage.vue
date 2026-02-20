<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '@/composables/useAuth'
import { isLocalMode } from '@/lib/backend'

const router = useRouter()
const route = useRoute()
const { login, loginWithOAuth, resetPassword } = useAuth()

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const resetSent = ref(false)
const showResetForm = ref(false)

async function handleLogin() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    const redirect = (route.query.redirect as string) || '/channels/@me'
    router.push(redirect)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Login failed'
  } finally {
    loading.value = false
  }
}

async function handleOAuth(provider: 'github' | 'google') {
  if (isLocalMode) return
  error.value = ''
  try {
    await loginWithOAuth(provider)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'OAuth login failed'
  }
}

async function handleResetPassword() {
  error.value = ''
  loading.value = true
  try {
    await resetPassword(email.value)
    resetSent.value = true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Password reset failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8">
      <div class="mb-2 flex items-center gap-2">
        <h1 class="text-2xl font-bold">Welcome back</h1>
        <span
          v-if="isLocalMode"
          class="rounded bg-accent/20 px-2 py-0.5 text-xs text-accent"
        >
          Local mode
        </span>
      </div>
      <p class="mb-6 text-text-secondary">Sign in to your account</p>

      <!-- Error display -->
      <div v-if="error" class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {{ error }}
      </div>

      <!-- Password reset form -->
      <template v-if="showResetForm && !isLocalMode">
        <div v-if="resetSent" class="mb-4 rounded bg-green-500/10 px-4 py-3 text-sm text-green-400">
          Check your email for a password reset link.
        </div>
        <form v-else @submit.prevent="handleResetPassword" class="space-y-4">
          <div>
            <label for="reset-email" class="mb-1 block text-sm text-text-secondary">Email</label>
            <input
              id="reset-email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ loading ? 'Sending...' : 'Send reset link' }}
          </button>
        </form>
        <button
          @click="showResetForm = false; resetSent = false"
          class="mt-4 text-sm text-accent hover:underline"
        >
          Back to login
        </button>
      </template>

      <!-- Login form -->
      <template v-else>
        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label for="email" class="mb-1 block text-sm text-text-secondary">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label for="password" class="mb-1 block text-sm text-text-secondary">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              autocomplete="current-password"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="Enter your password"
            />
          </div>
          <button
            type="submit"
            :disabled="loading"
            class="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ loading ? 'Signing in...' : 'Sign in' }}
          </button>
        </form>

        <template v-if="!isLocalMode">
          <div class="my-4 flex items-center gap-3">
            <div class="h-px flex-1 bg-bg-tertiary"></div>
            <span class="text-xs text-text-muted">OR</span>
            <div class="h-px flex-1 bg-bg-tertiary"></div>
          </div>

          <!-- OAuth buttons -->
          <div class="space-y-2">
            <button
              @click="handleOAuth('github')"
              class="flex w-full items-center justify-center gap-2 rounded border border-bg-tertiary bg-bg-primary py-2 text-sm text-text-primary hover:bg-bg-tertiary"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              Continue with GitHub
            </button>
            <button
              @click="handleOAuth('google')"
              class="flex w-full items-center justify-center gap-2 rounded border border-bg-tertiary bg-bg-primary py-2 text-sm text-text-primary hover:bg-bg-tertiary"
            >
              <svg class="h-5 w-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        </template>

        <div class="mt-4 flex items-center justify-between text-sm">
          <button
            v-if="!isLocalMode"
            @click="showResetForm = true"
            class="text-text-secondary hover:text-text-primary"
          >
            Forgot password?
          </button>
          <span v-else></span>
          <router-link to="/register" class="text-accent hover:underline">
            Create an account
          </router-link>
        </div>
      </template>
    </div>
  </div>
</template>
