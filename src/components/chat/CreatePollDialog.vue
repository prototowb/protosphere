<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  create: [data: { question: string; options: string[] }]
  close: []
}>()

const question = ref('')
const options = ref(['', ''])
const loading = ref(false)

function addOption() {
  if (options.value.length < 6) options.value.push('')
}

function removeOption(i: number) {
  if (options.value.length > 2) options.value.splice(i, 1)
}

function handleSubmit() {
  const q = question.value.trim()
  const opts = options.value.map((o) => o.trim()).filter(Boolean)
  if (!q || opts.length < 2) return
  loading.value = true
  emit('create', { question: q, options: opts })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create Poll</h2>

      <div class="mb-4">
        <label class="mb-1 block text-sm font-medium text-text-secondary">Question</label>
        <input
          v-model="question"
          type="text"
          maxlength="500"
          placeholder="Ask a question…"
          class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
        />
      </div>

      <div class="mb-4">
        <label class="mb-2 block text-sm font-medium text-text-secondary">Options</label>
        <div class="space-y-2">
          <div v-for="(_, i) in options" :key="i" class="flex gap-2">
            <input
              v-model="options[i]"
              type="text"
              maxlength="200"
              :placeholder="`Option ${i + 1}`"
              class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
            />
            <button
              v-if="options.length > 2"
              type="button"
              @click="removeOption(i)"
              class="rounded px-2 py-2 text-text-muted hover:text-danger"
            >
              <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <button
          v-if="options.length < 6"
          type="button"
          @click="addOption"
          class="mt-2 text-sm text-accent hover:text-accent-hover"
        >
          + Add option
        </button>
      </div>

      <div class="flex justify-end gap-2">
        <button @click="emit('close')" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
          Cancel
        </button>
        <button
          @click="handleSubmit"
          :disabled="loading || !question.trim() || options.filter(o => o.trim()).length < 2"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {{ loading ? 'Creating…' : 'Create Poll' }}
        </button>
      </div>
    </div>
  </div>
</template>
