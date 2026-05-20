import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { Integration, IntegrationFieldSchema, FieldVisibility } from '@/lib/types'

const integrations = ref<Integration[]>([])
const loading = ref(false)
const error = ref('')

export function useIntegrations() {
  async function fetchIntegrations() {
    loading.value = true
    error.value = ''
    try {
      integrations.value = await backend.integrations.list()
    } catch (e: unknown) {
      error.value = e instanceof Error ? e.message : 'Failed to load integrations'
    } finally {
      loading.value = false
    }
  }

  async function getIntegration(id: string) {
    return backend.integrations.get(id)
  }

  async function createIntegration(data: Parameters<typeof backend.integrations.create>[0]) {
    const created = await backend.integrations.create(data)
    integrations.value = [...integrations.value, created]
    return created
  }

  async function updateIntegration(id: string, updates: Parameters<typeof backend.integrations.update>[1]) {
    const updated = await backend.integrations.update(id, updates)
    integrations.value = integrations.value.map((i) => (i.id === id ? updated : i))
    return updated
  }

  async function deleteIntegration(id: string) {
    await backend.integrations.delete(id)
    integrations.value = integrations.value.filter((i) => i.id !== id)
  }

  // ── Field schemas ───────────────────────────────────────────

  async function listFieldSchemas(integrationId: string) {
    return backend.integrations.listFieldSchemas(integrationId)
  }

  async function createFieldSchema(data: {
    integration_id: string
    field_key: string
    label: string
    field_type: IntegrationFieldSchema['field_type']
    default_visibility?: FieldVisibility
    sort_order?: number
  }) {
    return backend.integrations.createFieldSchema(data)
  }

  async function updateFieldSchema(id: string, updates: Parameters<typeof backend.integrations.updateFieldSchema>[1]) {
    return backend.integrations.updateFieldSchema(id, updates)
  }

  async function deleteFieldSchema(id: string) {
    return backend.integrations.deleteFieldSchema(id)
  }

  return {
    integrations,
    loading,
    error,
    fetchIntegrations,
    getIntegration,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    listFieldSchemas,
    createFieldSchema,
    updateFieldSchema,
    deleteFieldSchema,
  }
}
