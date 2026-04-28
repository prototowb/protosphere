import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { UserIntegration, UserFieldVisibility, FieldVisibility } from '@/lib/types'
import type { PublicIntegrationData } from '@/lib/backend/types'

const myIntegrations = ref<UserIntegration[]>([])
const myVisibility = ref<UserFieldVisibility[]>([])
const loading = ref(false)

export function useUserIntegrations() {
  async function fetchMyIntegrations(userId: string) {
    loading.value = true
    try {
      myIntegrations.value = await backend.integrations.listUserIntegrations(userId)
      myVisibility.value = await backend.integrations.getFieldVisibility(userId)
    } finally {
      loading.value = false
    }
  }

  async function connect(userId: string, integrationId: string, token?: string) {
    const ui = await backend.integrations.connect(userId, integrationId, token)
    myIntegrations.value = [...myIntegrations.value.filter((i) => i.integration_id !== integrationId), ui]
    return ui
  }

  async function disconnect(userId: string, integrationId: string) {
    await backend.integrations.disconnect(userId, integrationId)
    myIntegrations.value = myIntegrations.value.filter((i) => i.integration_id !== integrationId)
  }

  async function syncData(userIntegrationId: string) {
    const updated = await backend.integrations.syncData(userIntegrationId)
    myIntegrations.value = myIntegrations.value.map((i) => (i.id === userIntegrationId ? updated : i))
    return updated
  }

  async function setFieldVisibility(userId: string, fieldSchemaId: string, visibility: FieldVisibility) {
    const result = await backend.integrations.setFieldVisibility(userId, fieldSchemaId, visibility)
    myVisibility.value = [
      ...myVisibility.value.filter((v) => v.field_schema_id !== fieldSchemaId),
      result,
    ]
    return result
  }

  function isConnected(integrationId: string) {
    return myIntegrations.value.some((i) => i.integration_id === integrationId)
  }

  function getVisibility(fieldSchemaId: string, defaultVisibility: FieldVisibility): FieldVisibility {
    return myVisibility.value.find((v) => v.field_schema_id === fieldSchemaId)?.visibility ?? defaultVisibility
  }

  // ── Public profile data (for viewing another user) ──────────

  async function getPublicUserData(userId: string): Promise<PublicIntegrationData[]> {
    return backend.integrations.getPublicUserData(userId)
  }

  return {
    myIntegrations,
    myVisibility,
    loading,
    fetchMyIntegrations,
    connect,
    disconnect,
    syncData,
    setFieldVisibility,
    isConnected,
    getVisibility,
    getPublicUserData,
  }
}
