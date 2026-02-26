<script setup lang="ts">
import { onMounted } from 'vue'
import { useCommunityStore } from '@/stores/community'
import { useCommunity } from '@/composables/useCommunity'

const communityStore = useCommunityStore()
const { fetchCommunity } = useCommunity()

onMounted(() => fetchCommunity())
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg-primary">
    <!-- Top nav -->
    <header class="flex h-16 flex-shrink-0 items-center justify-between border-b border-bg-tertiary px-6">
      <div class="flex items-center gap-3">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-xs font-bold text-white">
          <img
            v-if="communityStore.settings?.logo_url"
            :src="communityStore.settings.logo_url"
            :alt="communityStore.settings.name"
            class="h-full w-full rounded-lg object-cover"
          />
          <span v-else>{{ (communityStore.settings?.name ?? 'P').charAt(0).toUpperCase() }}</span>
        </div>
        <span class="font-semibold">{{ communityStore.settings?.name ?? 'Community' }}</span>
      </div>
      <div class="flex items-center gap-2">
        <router-link
          to="/login"
          class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Sign In
        </router-link>
        <router-link
          to="/register"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Join
        </router-link>
      </div>
    </header>

    <!-- Hero -->
    <main class="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <h1 class="mb-4 text-4xl font-bold text-text-primary">
        {{ communityStore.settings?.name ?? 'Welcome' }}
      </h1>
      <p class="mb-8 max-w-lg text-lg text-text-secondary">
        {{ communityStore.settings?.description || 'A place to connect, share, and build together.' }}
      </p>
      <div class="flex gap-3">
        <router-link
          to="/register"
          class="rounded-lg bg-accent px-6 py-3 font-medium text-white hover:bg-accent-hover"
        >
          Get Started
        </router-link>
        <router-link
          to="/login"
          class="rounded-lg border border-bg-tertiary px-6 py-3 font-medium text-text-secondary hover:border-bg-hover hover:text-text-primary"
        >
          Sign In
        </router-link>
      </div>

      <!-- Rules preview (if any) -->
      <div
        v-if="communityStore.settings?.rules"
        class="mt-16 w-full max-w-lg rounded-lg bg-bg-secondary p-6 text-left"
      >
        <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Community Rules</h2>
        <pre class="whitespace-pre-wrap text-sm text-text-secondary">{{ communityStore.settings.rules }}</pre>
      </div>
    </main>

    <!-- Footer -->
    <footer class="flex-shrink-0 border-t border-bg-tertiary px-6 py-4 text-center text-xs text-text-muted">
      Powered by Protosphere
    </footer>
  </div>
</template>
