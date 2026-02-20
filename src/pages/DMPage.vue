<script setup lang="ts">
import AppShell from '@/components/layout/AppShell.vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<template>
  <AppShell>
    <template #sidebar-header>
      <div class="flex h-12 items-center border-b border-bg-tertiary px-4">
        <h2 class="truncate font-semibold">Direct Messages</h2>
      </div>
    </template>

    <template #sidebar-content>
      <div class="space-y-1">
        <button
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <line x1="19" y1="8" x2="19" y2="14"/>
            <line x1="22" y1="11" x2="16" y2="11"/>
          </svg>
          Friends
        </button>
      </div>
      <div class="mt-4 px-2">
        <p class="text-xs font-semibold uppercase text-text-muted">Direct Messages</p>
        <p class="mt-2 text-center text-xs text-text-muted">No conversations yet</p>
      </div>
    </template>

    <template #top-bar>
      <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
        <svg class="h-5 w-5 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span class="font-semibold text-text-primary">Friends</span>
      </header>
    </template>

    <!-- Welcome screen -->
    <div class="flex h-full flex-col items-center justify-center p-8 text-center">
      <div class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-accent/20">
        <svg class="h-10 w-10 text-accent" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
        </svg>
      </div>
      <h2 class="mb-2 text-xl font-bold">Welcome, {{ authStore.user?.email?.split('@')[0] ?? 'friend' }}!</h2>
      <p class="max-w-md text-text-secondary">
        This is your home base. Once you join servers and start conversations, they'll appear here.
      </p>
    </div>

    <template #members>
      <!-- Hide member sidebar on DM home -->
      <div></div>
    </template>
  </AppShell>
</template>
