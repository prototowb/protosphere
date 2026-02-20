<script setup lang="ts">
import type { UserStatus } from '@/lib/types'

defineProps<{
  status: UserStatus
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4',
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
