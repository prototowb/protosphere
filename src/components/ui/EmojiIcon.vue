<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { getEmojiSvg } from '@/lib/emojiMap'
import { emojiDataLoaded, getEmojiId } from '@/lib/emojiNames'

const props = withDefaults(defineProps<{ emoji: string; size?: string }>(), { size: '1.2em' })
const svg = ref('')

async function load() {
  svg.value = await getEmojiSvg(props.emoji)
}

onMounted(load)
watch(() => props.emoji, load)

const tooltip = computed(() => {
  if (!emojiDataLoaded.value) return undefined
  const id = getEmojiId(props.emoji)
  return id ? `:${id}:` : undefined
})
</script>

<template>
  <span
    class="emoji-icon"
    :title="tooltip"
    :style="{ display: 'inline-block', width: size, height: size, verticalAlign: '-0.2em', flexShrink: '0' }"
    v-html="svg || props.emoji"
    aria-hidden="true"
  />
</template>
