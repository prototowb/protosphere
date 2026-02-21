<script setup lang="ts">
import PresenceIndicator from './PresenceIndicator.vue'
import type { UserStatus } from '@/lib/types'

const props = defineProps<{
  src?: string | null
  alt?: string
  status?: UserStatus
  size?: 'sm' | 'md' | 'lg'
}>()

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-16 w-16',
} as const

const textSizeClasses = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-xl',
} as const

const indicatorPosition = {
  sm: '-bottom-1 -right-1',
  md: '-bottom-1 -right-1',
  lg: '-bottom-1.5 -right-1.5',
} as const

const initial = (props.alt ?? '?').charAt(0).toUpperCase()
</script>

<template>
  <div class="relative inline-block flex-shrink-0">
    <img
      v-if="src"
      :src="src"
      :alt="alt ?? 'Avatar'"
      :class="['rounded-full object-cover', sizeClasses[size ?? 'md']]"
    />
    <div
      v-else
      :class="[
        'flex items-center justify-center rounded-full bg-accent font-medium text-white',
        sizeClasses[size ?? 'md'],
        textSizeClasses[size ?? 'md'],
      ]"
    >
      {{ initial }}
    </div>
    <PresenceIndicator
      v-if="status"
      :status="status"
      :size="size === 'lg' ? 'md' : 'sm'"
      :class="['absolute', indicatorPosition[size ?? 'md']]"
    />
  </div>
</template>
