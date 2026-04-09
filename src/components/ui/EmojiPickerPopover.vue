<script setup lang="ts">
import EmojiPicker from '@/components/chat/EmojiPicker.vue'

defineProps<{
  open: boolean
  anchor: { top?: number; bottom?: number; right?: number; left?: number } | null
}>()

const emit = defineEmits<{
  select: [emoji: string]
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open && anchor"
      class="fixed z-[9997]"
      :style="{
        top: anchor.top != null ? anchor.top + 'px' : undefined,
        bottom: anchor.bottom != null ? anchor.bottom + 'px' : undefined,
        right: anchor.right != null ? anchor.right + 'px' : undefined,
        left: anchor.left != null ? anchor.left + 'px' : undefined,
      }"
      @click.stop
    >
      <EmojiPicker @select="emit('select', $event)" />
    </div>
    <div
      v-if="open"
      class="fixed inset-0 z-[9996]"
      @click="emit('close')"
    />
  </Teleport>
</template>
