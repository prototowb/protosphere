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
  <!--
    Only the SVG fetched from our own /emoji/ assets is rendered as HTML. The
    fallback (non-emoji or unknown input — e.g. a reaction string read from the
    database) is rendered as TEXT: it is user-controlled and must never reach
    v-html.
  -->
  <span
    v-if="svg"
    class="emoji-icon"
    :title="tooltip"
    :style="{ display: 'inline-block', width: size, height: size, verticalAlign: '-0.2em', flexShrink: '0' }"
    v-html="svg"
    aria-hidden="true"
  />
  <span
    v-else
    class="emoji-icon"
    :title="tooltip"
    :style="{ display: 'inline-block', minWidth: size, height: size, verticalAlign: '-0.2em', flexShrink: '0' }"
    aria-hidden="true"
  >{{ props.emoji }}</span>
</template>
