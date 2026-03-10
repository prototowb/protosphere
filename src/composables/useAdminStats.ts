import { ref } from 'vue'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'

export function useAdminStats() {
  const authStore = useAuthStore()
  const stats = ref({ members: 0, pendingApprovals: 0, openReports: 0, spaces: 0 })
  const loading = ref(false)

  async function loadStats() {
    loading.value = true
    try {
      const userId = authStore.user?.id ?? ''
      const [allProfiles, pending, reports, spaces] = await Promise.all([
        backend.profiles.search('', 'no-match-id').catch(() => []),
        backend.profiles.listPending().catch(() => []),
        backend.reports.list(null, 'pending').catch(() => []),
        backend.servers.list(userId).catch(() => []),
      ])
      stats.value = {
        members: allProfiles.length,
        pendingApprovals: pending.length,
        openReports: reports.length,
        spaces: spaces.length,
      }
    } finally {
      loading.value = false
    }
  }

  return { stats, loading, loadStats }
}
