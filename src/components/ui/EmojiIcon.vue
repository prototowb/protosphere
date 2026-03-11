<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { getEmojiSvg } from '@/lib/emojiMap'

const props = withDefaults(defineProps<{ emoji: string; size?: string }>(), { size: '1.2em' })
const svg = ref('')

async function load() {
  svg.value = await getEmojiSvg(props.emoji)
}

onMounted(load)
watch(() => props.emoji, load)
</script>

<template>
  <span
    class="emoji-icon"
    :style="{ display: 'inline-block', width: size, height: size, verticalAlign: '-0.2em', flexShrink: '0' }"
    v-html="svg || props.emoji"
    aria-hidden="true"
  />
</template>
