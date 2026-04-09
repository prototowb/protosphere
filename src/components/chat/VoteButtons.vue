<script setup lang="ts">
const props = withDefaults(defineProps<{
  score: number
  userVote: 1 | -1 | null
  size?: 'sm' | 'md'
  showLabel?: boolean
}>(), { size: 'sm', showLabel: false })

const emit = defineEmits<{
  vote: [value: 1 | -1]
}>()
</script>

<template>
  <div class="flex items-center gap-1">
    <button
      @click="emit('vote', 1)"
      :class="[
        'flex items-center rounded transition-colors',
        props.size === 'md' ? 'gap-1 px-1.5 py-1.5 text-sm font-medium' : 'gap-0.5 px-1 py-0.5 text-xs font-medium',
        props.userVote === 1
          ? 'bg-emerald-500/20 text-emerald-400'
          : props.size === 'md'
            ? 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-emerald-400'
            : 'text-text-muted hover:bg-bg-hover hover:text-emerald-400',
      ]"
    >
      <svg :class="props.size === 'md' ? 'h-4 w-4' : 'h-3 w-3'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8H4z"/></svg>
    </button>
    <span
      :class="[
        'text-center font-semibold tabular-nums',
        props.size === 'md' ? 'font-bold' : 'min-w-[1.25rem] text-xs',
        props.score > 0 ? 'text-emerald-400' : props.score < 0 ? 'text-red-400' : 'text-text-muted',
      ]"
    >{{ props.score }}</span>
    <span v-if="props.showLabel" class="text-sm font-semibold text-violet-400">meta</span>
    <button
      @click="emit('vote', -1)"
      :class="[
        'flex items-center rounded transition-colors',
        props.size === 'md' ? 'gap-1 px-1.5 py-1.5 text-sm font-medium' : 'gap-0.5 px-1 py-0.5 text-xs font-medium',
        props.userVote === -1
          ? 'bg-red-500/20 text-red-400'
          : props.size === 'md'
            ? 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-red-400'
            : 'text-text-muted hover:bg-bg-hover hover:text-red-400',
      ]"
    >
      <svg :class="props.size === 'md' ? 'h-4 w-4' : 'h-3 w-3'" viewBox="0 0 24 24" fill="currentColor"><path d="M12 20l-8-8h16z"/></svg>
    </button>
  </div>
</template>
