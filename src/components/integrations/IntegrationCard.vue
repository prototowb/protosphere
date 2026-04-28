<script setup lang="ts">
import type { Integration } from '@/lib/types'

defineProps<{
  integration: Integration
  connected?: boolean
}>()

defineEmits<{
  click: []
}>()

const authModeLabels: Record<string, string> = {
  same_domain_cookie: 'SSO (Cookie)',
  oauth_redirect: 'OAuth',
  token_exchange: 'Token',
}
</script>

<template>
  <button
    class="w-full rounded-lg border border-bg-tertiary bg-bg-secondary p-4 text-left transition-colors hover:border-bg-hover hover:bg-bg-hover"
    @click="$emit('click')"
  >
    <div class="flex items-start gap-3">
      <!-- Icon -->
      <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-accent/15">
        <img v-if="integration.icon_url" :src="integration.icon_url" :alt="integration.name" class="h-6 w-6 rounded" />
        <svg v-else class="h-5 w-5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold text-text-primary truncate">{{ integration.name }}</h3>
          <span
            v-if="connected"
            class="flex-shrink-0 rounded-full bg-green-500/15 px-1.5 py-0.5 text-[10px] font-medium text-green-400"
          >Connected</span>
          <span
            v-if="!integration.enabled"
            class="flex-shrink-0 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-medium text-red-400"
          >Disabled</span>
        </div>
        <p v-if="integration.description" class="mt-0.5 text-xs text-text-muted line-clamp-2">{{ integration.description }}</p>
        <div class="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted">
          <span class="rounded bg-bg-tertiary px-1.5 py-0.5">{{ authModeLabels[integration.auth_mode] ?? integration.auth_mode }}</span>
          <span class="truncate">{{ integration.slug }}</span>
        </div>
      </div>
    </div>
  </button>
</template>
