<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { isLocalMode } from '@/lib/backend'
import { supabase } from '@/lib/supabase'
const newPassword = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const error = ref('')
const success = ref(false)
const invalidLink = ref(false)

onMounted(() => {
  if (isLocalMode) return
  const hash = window.location.hash
  const params = new URLSearchParams(hash.replace('#', ''))
  const type = params.get('type')
  if (type !== 'recovery') {
    invalidLink.value = true
  }
})

async function handleSubmit() {
  error.value = ''
  if (newPassword.value !== confirmPassword.value) {
    error.value = 'Passwords do not match'
    return
  }
  if (newPassword.value.length < 8) {
    error.value = 'Password must be at least 8 characters'
    return
  }
  loading.value = true
  try {
    if (!supabase) throw new Error('Supabase not configured')
    const { error: err } = await supabase.auth.updateUser({ password: newPassword.value })
    if (err) throw err
    success.value = true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to update password'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8">
      <h1 class="mb-2 text-2xl font-bold">Set New Password</h1>

      <div v-if="isLocalMode" class="rounded bg-bg-tertiary px-4 py-3 text-sm text-text-secondary">
        Password reset is only available in Supabase mode.
      </div>

      <div v-else-if="invalidLink" class="rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
        Invalid or expired reset link. <router-link to="/login" class="underline">Back to login</router-link>
      </div>

      <div v-else-if="success" class="rounded bg-green-500/10 px-4 py-3 text-sm text-green-400">
        Password updated successfully!
        <router-link to="/login" class="ml-1 underline">Sign in</router-link>
      </div>

      <form v-else @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="error" class="rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error }}</div>
        <div>
          <label class="mb-1 block text-sm text-text-secondary">New Password</label>
          <input v-model="newPassword" type="password" required autocomplete="new-password" placeholder="At least 8 characters"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-sm text-text-secondary">Confirm Password</label>
          <input v-model="confirmPassword" type="password" required autocomplete="new-password" placeholder="Repeat your password"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
        </div>
        <button type="submit" :disabled="loading"
          class="w-full rounded bg-accent py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50">
          {{ loading ? 'Updating...' : 'Update Password' }}
        </button>
      </form>
    </div>
  </div>
</template>
