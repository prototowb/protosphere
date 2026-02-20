import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { Member, Profile } from '@/lib/types'

export function useMembers() {
  const members = ref<(Member & { profile: Profile })[]>([])
  const loading = ref(false)

  async function fetchMembers(serverId: string) {
    loading.value = true
    try {
      members.value = await backend.members.list(serverId)
    } finally {
      loading.value = false
    }
  }

  async function updateRole(serverId: string, userId: string, role: Member['role']) {
    await backend.members.updateRole(serverId, userId, role)
    const member = members.value.find(
      (m) => m.server_id === serverId && m.user_id === userId,
    )
    if (member) {
      member.role = role
    }
  }

  return {
    members,
    loading,
    fetchMembers,
    updateRole,
  }
}
