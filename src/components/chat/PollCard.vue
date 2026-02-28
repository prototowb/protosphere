<script setup lang="ts">
import type { PollWithResults } from '@/lib/types'

const props = defineProps<{
  pollResult: PollWithResults
  userId: string
  canClose: boolean
}>()

const emit = defineEmits<{
  vote: [optionId: string]
  close: []
}>()

function votePercent(voteCount: number): number {
  if (props.pollResult.total_votes === 0) return 0
  return Math.round((voteCount / props.pollResult.total_votes) * 100)
}
</script>

<template>
  <div class="rounded-lg border border-bg-tertiary bg-bg-primary p-4">
    <!-- Header -->
    <div class="mb-3 flex items-start justify-between gap-2">
      <p class="text-sm font-semibold text-text-primary leading-snug">{{ pollResult.poll.question }}</p>
      <span
        v-if="pollResult.poll.closed_at"
        class="flex-shrink-0 rounded bg-bg-tertiary px-2 py-0.5 text-xs text-text-muted"
      >
        Closed
      </span>
    </div>

    <!-- Options -->
    <div class="space-y-2 mb-3">
      <button
        v-for="opt in pollResult.options"
        :key="opt.id"
        @click="!pollResult.poll.closed_at && emit('vote', opt.id)"
        :disabled="!!pollResult.poll.closed_at"
        class="relative w-full overflow-hidden rounded border text-left transition-colors"
        :class="pollResult.myVote === opt.id
          ? 'border-accent bg-accent/10'
          : 'border-bg-tertiary bg-bg-secondary hover:border-accent/40 disabled:cursor-default'"
      >
        <!-- Progress bar background -->
        <div
          class="absolute inset-y-0 left-0 bg-accent/10 transition-all"
          :class="pollResult.myVote === opt.id ? 'bg-accent/20' : ''"
          :style="{ width: votePercent(opt.vote_count) + '%' }"
        />
        <div class="relative flex items-center justify-between px-3 py-2">
          <span class="text-xs font-medium text-text-primary">{{ opt.text }}</span>
          <span class="text-xs text-text-muted">{{ votePercent(opt.vote_count) }}%</span>
        </div>
      </button>
    </div>

    <!-- Footer -->
    <div class="flex items-center justify-between text-xs text-text-muted">
      <span>{{ pollResult.total_votes }} {{ pollResult.total_votes === 1 ? 'vote' : 'votes' }}</span>
      <button
        v-if="canClose && !pollResult.poll.closed_at"
        @click="emit('close')"
        class="hover:text-text-secondary"
      >
        Close poll
      </button>
    </div>
  </div>
</template>
