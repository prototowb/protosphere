<script setup lang="ts">
import type { IntegrationFieldType } from '@/lib/types'

defineProps<{
  fieldType: IntegrationFieldType
  label: string
  value: unknown
}>()

interface ActivityEntry { text: string; at: string; xp?: number }
interface ListItem { name: string; progress?: number; xp?: number }
</script>

<template>
  <div class="space-y-1">
    <!-- Number -->
    <template v-if="fieldType === 'number'">
      <p class="text-xs text-text-muted">{{ label }}</p>
      <p class="text-sm font-semibold text-text-primary">{{ typeof value === 'number' ? value.toLocaleString() : value }}</p>
    </template>

    <!-- Text -->
    <template v-else-if="fieldType === 'text'">
      <p class="text-xs text-text-muted">{{ label }}</p>
      <p class="text-sm text-text-secondary">{{ value }}</p>
    </template>

    <!-- Badge -->
    <template v-else-if="fieldType === 'badge'">
      <span class="inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
        {{ value }}
      </span>
    </template>

    <!-- Progress bar -->
    <template v-else-if="fieldType === 'progress_bar'">
      <div class="flex items-center justify-between">
        <p class="text-xs text-text-muted">{{ label }}</p>
        <p class="text-xs font-medium text-text-secondary">{{ value }}%</p>
      </div>
      <div class="h-1.5 rounded-full bg-bg-tertiary overflow-hidden">
        <div
          class="h-full rounded-full bg-accent transition-all"
          :style="{ width: `${Math.min(100, Math.max(0, Number(value) || 0))}%` }"
        />
      </div>
    </template>

    <!-- List -->
    <template v-else-if="fieldType === 'list'">
      <p class="text-xs text-text-muted">{{ label }}</p>
      <div class="space-y-1.5">
        <div
          v-for="(item, idx) in (value as ListItem[])"
          :key="idx"
          class="flex items-center gap-2"
        >
          <div class="flex-1 min-w-0">
            <p class="text-xs text-text-secondary truncate">{{ item.name }}</p>
            <div v-if="item.progress != null" class="mt-0.5 h-1 rounded-full bg-bg-tertiary overflow-hidden">
              <div
                class="h-full rounded-full bg-accent"
                :style="{ width: `${Math.round(item.progress * 100)}%` }"
              />
            </div>
          </div>
          <span v-if="item.xp != null" class="flex-shrink-0 text-xs text-text-muted">{{ item.xp }} XP</span>
        </div>
      </div>
    </template>

    <!-- Activity feed -->
    <template v-else-if="fieldType === 'activity_feed'">
      <p class="text-xs text-text-muted">{{ label }}</p>
      <div class="space-y-1">
        <div
          v-for="(entry, idx) in (value as ActivityEntry[])"
          :key="idx"
          class="flex items-start gap-2 text-xs"
        >
          <span class="flex-shrink-0 text-text-muted">{{ new Date(entry.at).toLocaleDateString() }}</span>
          <span class="text-text-secondary">{{ entry.text }}</span>
          <span v-if="entry.xp" class="ml-auto flex-shrink-0 text-accent">+{{ entry.xp }}</span>
        </div>
      </div>
    </template>
  </div>
</template>
