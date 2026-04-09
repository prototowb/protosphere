<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Member, Profile, MemberRole, UserStatus } from '@/lib/types'

defineProps<{
  member: Member & { profile: Profile }
  status: UserStatus
  isSelf: boolean
  canChangeRole: boolean
  canKick: boolean
  canBan: boolean
  isOwner: boolean
}>()

const emit = defineEmits<{
  close: []
  sendMessage: []
  changeRole: [role: MemberRole]
  kick: []
  ban: []
}>()
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="emit('close')"
  >
    <div class="w-full max-w-sm rounded-lg bg-bg-secondary shadow-xl overflow-hidden">
      <!-- Header band -->
      <div class="h-16 bg-accent/30" />
      <!-- Avatar overlapping the band -->
      <div class="relative px-5 pb-5">
        <div class="-mt-8 mb-3 flex items-end justify-between">
          <UserAvatar
            :src="member.profile.avatar_url"
            :alt="member.profile.display_name"
            :status="status"
            size="lg"
          />
          <button @click="emit('close')" class="mb-1 rounded p-1 text-text-muted hover:text-text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p class="text-lg font-bold">{{ member.profile.display_name }}</p>
        <div class="mb-1 flex items-center gap-2">
          <p class="text-sm text-text-muted">@{{ member.profile.username }}</p>
          <span class="flex items-center gap-0.5 rounded bg-violet-500/15 px-1.5 py-0.5 text-xs font-medium text-violet-400">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            {{ member.profile.meta_points ?? 0 }}
          </span>
        </div>
        <span class="inline-block rounded px-2 py-0.5 text-xs font-medium"
          :class="{
            'bg-accent/20 text-accent': member.role === 'owner',
            'bg-success/20 text-success': member.role === 'admin',
            'bg-presence-idle/20 text-presence-idle': member.role === 'moderator',
            'bg-bg-tertiary text-text-muted': member.role === 'member',
          }"
        >{{ member.role }}</span>

        <div v-if="member.profile.bio" class="mt-3 border-t border-bg-tertiary pt-3">
          <p class="text-xs font-semibold uppercase text-text-muted">About Me</p>
          <p class="mt-1 text-sm text-text-secondary">{{ member.profile.bio }}</p>
        </div>

        <div v-if="member.profile.pronouns || member.profile.website || member.profile.location" class="mt-2 space-y-1">
          <p v-if="member.profile.pronouns" class="text-xs text-text-muted">{{ member.profile.pronouns }}</p>
          <a v-if="member.profile.website" :href="member.profile.website" target="_blank" rel="noopener noreferrer" class="block text-xs text-accent hover:underline truncate">🔗 {{ member.profile.website }}</a>
          <p v-if="member.profile.location" class="text-xs text-text-secondary">📍 {{ member.profile.location }}</p>
        </div>

        <div v-if="member.profile.status_text" class="mt-2">
          <p class="text-xs text-text-muted">{{ member.profile.status_text }}</p>
        </div>

        <!-- Send Message button (non-self) -->
        <button
          v-if="!isSelf"
          @click="emit('sendMessage')"
          class="mt-3 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Send Message
        </button>

        <!-- Role management -->
        <div v-if="canChangeRole" class="mt-4 border-t border-bg-tertiary pt-4">
          <label class="mb-1 block text-xs font-semibold uppercase text-text-muted">Role</label>
          <select
            :value="member.role"
            @change="emit('changeRole', ($event.target as HTMLSelectElement).value as MemberRole)"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option v-if="isOwner" value="owner">Owner</option>
          </select>
        </div>

        <!-- Kick / Ban buttons -->
        <div v-if="(canKick || canBan) && !isSelf" class="mt-3 flex gap-2">
          <button
            v-if="canKick"
            @click="emit('kick')"
            class="flex-1 rounded bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover"
          >
            Kick
          </button>
          <button
            v-if="canBan"
            @click="emit('ban')"
            class="flex-1 rounded bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20"
          >
            Ban
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
