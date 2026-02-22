<script setup lang="ts">
import type { UserStatus } from '@/lib/types'

defineProps<{
  status: UserStatus
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
} as const

const statusClasses = {
  online: 'bg-presence-online',
  idle: 'bg-presence-idle',
  dnd: 'bg-presence-dnd',
  offline: 'bg-presence-offline',
} as const
</script>

<template>
  <span
    :class="[
      'inline-block rounded-full border-2 border-bg-secondary',
      sizeClasses[size ?? 'md'],
      statusClasses[status],
    ]"
    :title="status"
  />
</template>
