<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'

const emit = defineEmits<{
  select: [emoji: string]
}>()

const container = ref<HTMLElement | null>(null)
let picker: HTMLElement | null = null

onMounted(async () => {
  const [{ Picker }, { default: data }] = await Promise.all([
    import('emoji-mart'),
    import('@emoji-mart/data'),
  ])
  picker = new (Picker as any)({
    data,
    theme: 'dark',
    previewPosition: 'none',
    skinTonePosition: 'search',
    onEmojiSelect: (e: { native: string }) => emit('select', e.native),
  }) as HTMLElement
  container.value?.appendChild(picker)
})

onBeforeUnmount(() => {
  if (picker && container.value?.contains(picker)) {
    container.value.removeChild(picker)
  }
  picker = null
})
</script>

<template>
  <div ref="container" class="emoji-picker-host" />
</template>

<style>
/*
  emoji-mart renders a <em-emoji-picker> custom element (shadow DOM).
  Custom properties pierce the shadow boundary, so this is how we theme it.
*/
.emoji-picker-host em-emoji-picker {
  /* background layers — RGB triples consumed as rgba(var, alpha) */
  --em-rgb-background: 15, 23, 42;       /* bg-secondary (slate-900) */
  --em-rgb-input: 30, 41, 59;            /* bg-tertiary (slate-800) */
  --em-rgb-color: 248, 250, 252;         /* text-primary (slate-50)  */
  --em-rgb-accent: 99, 102, 241;         /* accent (indigo-500)      */

  /* border / hover */
  --em-color-border: rgba(148, 163, 184, 0.12);
  --em-color-border-over: rgba(148, 163, 184, 0.2);
  --em-color-background-over: rgba(248, 250, 252, 0.06);

  /* size */
  width: 352px;
  max-height: 440px;
  border-radius: 0.75rem;

  /* shadow to separate from page */
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
}
</style>
