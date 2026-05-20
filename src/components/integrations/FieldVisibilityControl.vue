<script setup lang="ts">
import type { FieldVisibility } from '@/lib/types'

defineProps<{
  label: string
  fieldKey: string
  visibility: FieldVisibility
}>()

defineEmits<{
  change: [visibility: FieldVisibility]
}>()

const options: { value: FieldVisibility; label: string }[] = [
  { value: 'public', label: 'Public' },
  { value: 'private', label: 'Only me' },
  { value: 'hidden', label: 'Hidden' },
]
</script>

<template>
  <div class="flex items-center justify-between gap-3 py-1.5">
    <div class="min-w-0">
      <p class="text-sm text-text-primary truncate">{{ label }}</p>
      <p class="text-xs text-text-muted">{{ fieldKey }}</p>
    </div>
    <select
      :value="visibility"
      @change="$emit('change', ($event.target as HTMLSelectElement).value as FieldVisibility)"
      class="rounded border border-bg-tertiary bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
    >
      <option v-for="opt in options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
    </select>
  </div>
</template>
