<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import type { Member, Profile, UserStatus } from '@/lib/types'

export type MemberWithProfile = Member & { profile: Profile }
export interface RoleGroup {
  role: string
  label: string
  members: MemberWithProfile[]
}

defineProps<{
  roleGroups: RoleGroup[]
  selectedUserId?: string | null
  getEffectiveStatus: (member: MemberWithProfile) => UserStatus
}>()

const emit = defineEmits<{
  selectMember: [member: MemberWithProfile]
  contextmenu: [event: MouseEvent, member: MemberWithProfile]
}>()
</script>

<template>
  <div class="h-full overflow-y-auto p-4">
    <div v-for="group in roleGroups" :key="group.role" class="mb-3">
      <h3 class="mb-1 text-xs font-semibold uppercase text-text-muted">
        {{ group.label }} — {{ group.members.length }}
      </h3>
      <div class="space-y-0.5">
        <button
          v-for="member in group.members"
          :key="member.user_id"
          @click="emit('selectMember', member)"
          @contextmenu.prevent="emit('contextmenu', $event, member)"
          class="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-hover text-left"
          :class="selectedUserId === member.user_id ? 'bg-bg-hover' : ''"
        >
          <UserAvatar
            :src="member.profile.avatar_url"
            :alt="member.profile.display_name"
            :status="getEffectiveStatus(member)"
            size="sm"
          />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium">{{ member.profile.display_name }}</p>
            <p v-if="member.profile.status_text" class="truncate text-xs text-text-muted">{{ member.profile.status_text }}</p>
          </div>
        </button>
      </div>
    </div>
  </div>
</template>
