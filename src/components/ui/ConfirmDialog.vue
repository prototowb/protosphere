<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

const props = withDefaults(defineProps<{
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
  requireInput?: string
  inputPlaceholder?: string
}>(), {
  confirmLabel: 'Confirm',
  danger: false,
})

const emit = defineEmits<{
  confirm: [inputValue: string]
  cancel: []
}>()

const inputValue = ref('')
const inputEl = ref<HTMLInputElement | null>(null)

const canConfirm = computed(() => {
  if (props.requireInput) return inputValue.value === props.requireInput
  return true
})

function handleConfirm() {
  if (!canConfirm.value) return
  emit('confirm', inputValue.value)
}

onMounted(() => {
  inputEl.value?.focus()
})
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('cancel')">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-2 text-xl font-bold">{{ title }}</h2>
      <p class="mb-4 text-sm text-text-secondary">{{ message }}</p>

      <div v-if="requireInput || inputPlaceholder" class="mb-4">
        <input
          ref="inputEl"
          v-model="inputValue"
          type="text"
          :placeholder="inputPlaceholder ?? requireInput"
          class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          @keydown.enter.prevent="handleConfirm"
        />
        <p v-if="requireInput" class="mt-1 text-xs text-text-muted">
          Type <span class="font-semibold text-text-primary">{{ requireInput }}</span> to confirm
        </p>
      </div>

      <div class="flex justify-end gap-2">
        <button
          @click="emit('cancel')"
          class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          @click="handleConfirm"
          :disabled="!canConfirm"
          class="rounded px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          :class="danger ? 'bg-danger hover:bg-danger/80' : 'bg-accent hover:bg-accent-hover'"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
