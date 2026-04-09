<script setup lang="ts">
import { formatDateTime } from '@/lib/formatters'
import UserAvatar from '@/components/user/UserAvatar.vue'

defineProps<{
  title: string
  createdAt: string
  updatedAt: string | null
  updatedBy: string | null
  authorName: string
  authorAvatarUrl: string | null
  collaborators: { user_id: string; user: { display_name: string; avatar_url: string | null } }[]
  heroStyle?: { backgroundUrl?: string; textAlign?: string }
  commentCount: number
  canInvite: boolean
  memberSidebarOpen: boolean
}>()

const emit = defineEmits<{
  toggleComments: []
  invite: []
}>()
</script>

<template>
  <div
    class="relative flex flex-col rounded-xl p-8 mb-8"
    :class="heroStyle?.backgroundUrl ? '' : 'bg-gradient-to-br from-sky-500/20 to-bg-tertiary'"
    :style="heroStyle?.backgroundUrl ? `background-image:url(${heroStyle.backgroundUrl});background-size:cover;background-position:center` : ''"
  >
    <div v-if="heroStyle?.backgroundUrl" class="absolute inset-0 rounded-xl bg-black/40" />
    <!-- Post Meta -->
    <div class="relative mb-3 flex items-center gap-2">
      <span class="rounded px-1.5 py-0.5 text-xs font-medium uppercase tracking-wide bg-sky-500/30 text-sky-400">page</span>
      <button
        @click="emit('toggleComments')"
        class="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors"
        :class="memberSidebarOpen ? 'text-white bg-white/20' : 'text-white/70 hover:text-white hover:bg-white/10'"
        title="Toggle comments"
      >
        <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <span class="text-sm">{{ commentCount }}</span>
      </button>
      <button v-if="canInvite" @click="emit('invite')"
      class="ml-auto flex items-center gap-1 rounded bg-white/10 px-2
      py-0.5 text-xs text-white/80 hover:bg-white/20 hover:text-white
      transition-colors">
        <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Invite
      </button>
    </div>
    <!-- Title -->
    <h1 class="relative text-3xl font-bold leading-tight text-white drop-shadow" :class="{ 'text-center': heroStyle?.textAlign === 'center', 'text-right': heroStyle?.textAlign === 'right' }">{{ title }}</h1>
    <!-- Author Meta -->
    <div class="relative mt-3 flex flex-wrap items-center gap-3 text-sm text-white/70">
      <div class="flex items-center gap-2">
        <UserAvatar :src="authorAvatarUrl" :alt="authorName" size="sm" />
        <div class="min-w-0 flex-1 flex flex-col">
          <span class="font-medium text-white/90">{{ authorName }}</span>
          <span class="text-xs">{{ formatDateTime(createdAt) }}</span>
        </div>
        <span v-if="updatedBy" class="text-xs self-end">· edited {{ formatDateTime(updatedAt!) }}</span>
      </div>
      <div v-if="collaborators.length" class="flex items-center gap-1">
        <span class="text-xs text-white/50">+</span>
        <div class="flex -space-x-1.5">
          <UserAvatar v-for="c in collaborators" :key="c.user_id" :src="c.user.avatar_url" :alt="c.user.display_name" size="xs" class="ring-2 ring-bg-primary" :title="c.user.display_name" />
        </div>
      </div>
    </div>
  </div>
</template>
