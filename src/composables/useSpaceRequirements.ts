import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { SpaceIntegrationRequirement, Integration } from '@/lib/types'

const requirementsCache = ref<Record<string, SpaceIntegrationRequirement[]>>({})

export interface MissingRequirement {
  integration: Integration
  fieldKeys: string[]
}

export function useSpaceRequirements() {
  async function fetchRequirements(serverId: string) {
    const reqs = await backend.integrations.listSpaceRequirements(serverId)
    requirementsCache.value[serverId] = reqs
    return reqs
  }

  async function getMissingRequirements(serverId: string, userId: string): Promise<MissingRequirement[]> {
    const reqs = requirementsCache.value[serverId] ?? await fetchRequirements(serverId)
    if (!reqs.length) return []

    const integrations = await backend.integrations.list()
    const userIntegrations = await backend.integrations.listUserIntegrations(userId)
    const connectedIds = new Set(userIntegrations.map((ui) => ui.integration_id))

    // Group requirements by integration
    const byIntegration = new Map<string, string[]>()
    for (const req of reqs) {
      if (!req.required) continue
      const keys = byIntegration.get(req.integration_id) ?? []
      keys.push(req.field_key)
      byIntegration.set(req.integration_id, keys)
    }

    const missing: MissingRequirement[] = []
    for (const [integrationId, fieldKeys] of byIntegration) {
      if (!connectedIds.has(integrationId)) {
        const integration = integrations.find((i) => i.id === integrationId)
        if (integration?.enabled) {
          missing.push({ integration, fieldKeys })
        }
      }
    }
    return missing
  }

  return { requirementsCache, fetchRequirements, getMissingRequirements }
}
