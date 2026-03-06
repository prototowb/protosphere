<script setup lang="ts">
import { useRouter } from 'vue-router'
const router = useRouter()
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
    <div class="text-8xl font-black text-text-muted opacity-30">404</div>
    <h1 class="text-2xl font-bold">Page Not Found</h1>
    <p class="text-text-secondary">The page you're looking for doesn't exist or has been moved.</p>
    <button
      @click="router.push('/channels/@me')"
      class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
    >
      Go Home
    </button>
  </div>
</template>
