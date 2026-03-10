<script setup lang="ts">
import type { Attachment } from '@/lib/types'

const props = defineProps<{
  attachments: Attachment[]
}>()

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(mimeType: string): boolean {
  return mimeType.startsWith('image/')
}
</script>

<template>
  <div v-if="props.attachments.length > 0" class="mt-1 flex flex-wrap gap-2">
    <template v-for="(attachment, idx) in props.attachments.slice(0, 5)" :key="idx">
      <!-- Image attachment -->
      <a
        v-if="isImage(attachment.mime_type)"
        :href="attachment.url"
        target="_blank"
        rel="noopener noreferrer"
        class="block"
      >
        <img
          :src="attachment.url"
          :alt="attachment.filename"
          class="max-h-48 max-w-xs rounded-lg object-contain border border-bg-tertiary hover:opacity-90 transition-opacity"
        />
      </a>

      <!-- File attachment -->
      <a
        v-else
        :href="attachment.url"
        :download="attachment.filename"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 rounded-lg border border-bg-tertiary bg-bg-secondary px-3 py-2 text-sm hover:bg-bg-hover transition-colors"
      >
        <!-- File icon -->
        <svg class="h-5 w-5 flex-shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <div class="min-w-0">
          <p class="truncate max-w-[12rem] font-medium text-text-primary">{{ attachment.filename }}</p>
          <p class="text-xs text-text-muted">{{ formatSize(attachment.size) }}</p>
        </div>
        <!-- Download icon -->
        <svg class="h-4 w-4 flex-shrink-0 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
      </a>
    </template>
  </div>
</template>
