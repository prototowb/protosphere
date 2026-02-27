<script setup lang="ts">
import { ref } from 'vue'
import type { ReportCategory } from '@/lib/types'

const props = defineProps<{
  type: 'message' | 'user'
  targetId: string
  serverId?: string | null
}>()

const emit = defineEmits<{
  report: [data: { category: ReportCategory; description: string }]
  close: []
}>()

const category = ref<ReportCategory>('other')
const description = ref('')
const loading = ref(false)

const CATEGORIES: { value: ReportCategory; label: string; desc: string }[] = [
  { value: 'spam', label: 'Spam', desc: 'Unsolicited or repetitive content' },
  { value: 'harassment', label: 'Harassment', desc: 'Bullying, threats, or targeted abuse' },
  { value: 'nsfw', label: 'Inappropriate Content', desc: 'Content not suitable for this community' },
  { value: 'misinformation', label: 'Misinformation', desc: 'False or misleading information' },
  { value: 'other', label: 'Other', desc: 'Something else not listed above' },
]

function handleSubmit() {
  loading.value = true
  emit('report', { category: category.value, description: description.value.trim() })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-1 text-xl font-bold">
        Report {{ props.type === 'message' ? 'Message' : 'User' }}
      </h2>
      <p class="mb-4 text-sm text-text-muted">
        Reports are reviewed by moderators and kept confidential.
      </p>

      <div class="mb-4 space-y-2">
        <label
          v-for="opt in CATEGORIES"
          :key="opt.value"
          class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
          :class="category === opt.value ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:border-bg-hover'"
        >
          <input v-model="category" type="radio" :value="opt.value" class="mt-0.5 flex-shrink-0 accent-accent" />
          <div>
            <p class="text-sm font-medium">{{ opt.label }}</p>
            <p class="text-xs text-text-muted">{{ opt.desc }}</p>
          </div>
        </label>
      </div>

      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-text-secondary">
          Additional details <span class="text-text-muted">(optional)</span>
        </label>
        <textarea
          v-model="description"
          maxlength="500"
          rows="3"
          class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
          placeholder="Describe the issue..."
        />
      </div>

      <div class="flex justify-end gap-2">
        <button
          @click="emit('close')"
          class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="loading"
          class="rounded bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {{ loading ? 'Submitting…' : 'Submit Report' }}
        </button>
      </div>
    </div>
  </div>
</template>
