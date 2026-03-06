<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
defineProps<{ error?: string }>()
function reload() { window.location.reload() }
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
    <div class="text-8xl font-black text-red-500 opacity-30">!</div>
    <h1 class="text-2xl font-bold">Something went wrong</h1>
    <p v-if="error" class="max-w-md text-sm text-text-muted font-mono bg-bg-secondary rounded px-3 py-2">{{ error }}</p>
    <p v-else class="text-text-secondary">An unexpected error occurred. Please try again.</p>
    <div class="flex gap-3">
      <button @click="reload" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover">
        Reload
      </button>
      <button @click="router.push('/channels/@me')" class="rounded border border-bg-tertiary px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover">
        Go Home
      </button>
    </div>
  </div>
</template>
