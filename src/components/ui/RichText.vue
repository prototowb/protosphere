<script setup lang="ts">
import { computed } from 'vue'
import { getEmojiUrl } from '@/lib/emojiMap'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'

const props = defineProps<{ text: string; size?: string }>()

type Segment = { type: 'text'; value: string } | { type: 'emoji'; value: string }

// Matches extended pictographic emoji (covers most standard emoji + ZWJ sequences),
// regional indicator flag pairs, and keycap sequences.
// getEmojiUrl() validates each match has a Twemoji SVG — unrecognised sequences fall back to text.
const EMOJI_RE =
  /\p{Extended_Pictographic}(\u200D\p{Extended_Pictographic})*\uFE0F?|[\u{1F1E0}-\u{1F1FF}]{2}|[0-9#*]\uFE0F\u20E3/gu

const segments = computed<Segment[]>(() => {
  const text = props.text ?? ''
  const result: Segment[] = []
  let lastIndex = 0

  EMOJI_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = EMOJI_RE.exec(text)) !== null) {
    if (!getEmojiUrl(match[0])) continue // not a recognised Twemoji — let it fall through as text

    if (match.index > lastIndex) {
      result.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    result.push({ type: 'emoji', value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    result.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return result
})
</script>

<template>
  <span>
    <template v-for="(seg, i) in segments" :key="i">
      <EmojiIcon v-if="seg.type === 'emoji'" :emoji="seg.value" :size="size ?? '1.1em'" />
      <span v-else>{{ seg.value }}</span>
    </template>
  </span>
</template>
