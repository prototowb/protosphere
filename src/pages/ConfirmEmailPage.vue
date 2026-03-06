<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { isLocalMode } from '@/lib/backend'
import { supabase } from '@/lib/supabase'

const status = ref<'loading' | 'success' | 'error' | 'local'>('loading')
const errorMsg = ref('')
const confirmationType = ref('')

onMounted(async () => {
  if (isLocalMode) {
    status.value = 'local'
    return
  }
  const hash = window.location.hash
  const params = new URLSearchParams(hash.replace('#', ''))
  const type = params.get('type')
  confirmationType.value = type ?? ''

  if (type === 'signup' || type === 'email_change') {
    // Supabase auto-handles the token in the URL; just check if session is now set
    if (!supabase) {
      status.value = 'error'
      errorMsg.value = 'Supabase not configured'
      return
    }
    const { data, error } = await supabase.auth.getSession()
    if (error || !data.session) {
      status.value = 'error'
      errorMsg.value = error?.message ?? 'Confirmation failed'
    } else {
      status.value = 'success'
    }
  } else {
    status.value = 'error'
    errorMsg.value = 'Invalid confirmation link'
  }
})
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8 text-center">
      <div v-if="status === 'loading'" class="text-text-secondary">Confirming your email...</div>

      <div v-else-if="status === 'local'" class="text-text-secondary">
        Email confirmation is only required in Supabase mode.
      </div>

      <div v-else-if="status === 'success'">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20 text-green-400">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold">Email Confirmed!</h1>
        <p class="mt-2 text-text-secondary">
          {{ confirmationType === 'email_change' ? 'Your email has been updated.' : 'Your account is now active.' }}
        </p>
        <router-link to="/login" class="mt-4 inline-block rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
          Sign in
        </router-link>
      </div>

      <div v-else-if="status === 'error'">
        <div class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20 text-red-400">
          <svg class="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </div>
        <h1 class="text-xl font-bold">Confirmation Failed</h1>
        <p class="mt-2 text-text-secondary">{{ errorMsg }}</p>
        <router-link to="/login" class="mt-4 inline-block text-sm text-accent hover:underline">Back to login</router-link>
      </div>
    </div>
  </div>
</template>
