<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-8 text-center">
      <h1 class="mb-6 text-2xl font-bold">Server Invite</h1>
      <p class="text-text-secondary">Invite code: {{ route.params.code }}</p>
    </div>
  </div>
</template>
