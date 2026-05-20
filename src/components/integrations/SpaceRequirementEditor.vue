<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useIntegrations } from '@/composables/useIntegrations'
import { backend } from '@/lib/backend'
import type { IntegrationFieldSchema, SpaceIntegrationRequirement } from '@/lib/types'

const props = defineProps<{
  serverId: string
}>()

const { integrations, fetchIntegrations, listFieldSchemas } = useIntegrations()
const requirements = ref<SpaceIntegrationRequirement[]>([])
const schemasByIntegration = ref<Record<string, IntegrationFieldSchema[]>>({})
const loading = ref(true)

onMounted(async () => {
  await fetchIntegrations()
  requirements.value = await backend.integrations.listSpaceRequirements(props.serverId)

  // Load field schemas for all enabled integrations
  for (const integration of integrations.value.filter((i) => i.enabled)) {
    schemasByIntegration.value[integration.id] = await listFieldSchemas(integration.id)
  }
  loading.value = false
})

function isRequired(integrationId: string, fieldKey: string): boolean {
  return requirements.value.some((r) => r.integration_id === integrationId && r.field_key === fieldKey && r.required)
}

async function toggleRequirement(integrationId: string, fieldKey: string) {
  const current = isRequired(integrationId, fieldKey)
  if (current) {
    const req = requirements.value.find((r) => r.integration_id === integrationId && r.field_key === fieldKey)
    if (req) {
      await backend.integrations.removeSpaceRequirement(req.id)
      requirements.value = requirements.value.filter((r) => r.id !== req.id)
    }
  } else {
    const req = await backend.integrations.setSpaceRequirement({
      server_id: props.serverId,
      integration_id: integrationId,
      field_key: fieldKey,
      required: true,
    })
    requirements.value = [...requirements.value, req]
  }
}
</script>

<template>
  <div class="space-y-6">
    <p class="text-sm text-text-secondary">
      Require members to share specific integration data in this space. Required fields must be set to public.
    </p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 2" :key="i" class="h-20 animate-pulse rounded-lg bg-bg-tertiary" />
    </div>

    <div v-else-if="integrations.filter((i) => i.enabled).length === 0" class="text-sm text-text-muted">
      No integrations registered. Go to Admin &rarr; Integrations to add one.
    </div>

    <div v-else class="space-y-4">
      <div
        v-for="integration in integrations.filter((i) => i.enabled)"
        :key="integration.id"
        class="rounded-lg border border-bg-tertiary p-4"
      >
        <h4 class="text-sm font-semibold text-text-primary">{{ integration.name }}</h4>

        <div v-if="!schemasByIntegration[integration.id]?.length" class="mt-2 text-xs text-text-muted">
          No fields configured for this integration.
        </div>

        <div v-else class="mt-2 space-y-1">
          <label
            v-for="schema in schemasByIntegration[integration.id]"
            :key="schema.id"
            class="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-hover cursor-pointer"
          >
            <input
              type="checkbox"
              :checked="isRequired(integration.id, schema.field_key)"
              @change="toggleRequirement(integration.id, schema.field_key)"
              class="h-3.5 w-3.5 rounded border-bg-tertiary accent-accent"
            />
            <span class="text-sm text-text-secondary">{{ schema.label }}</span>
            <span class="text-xs text-text-muted">({{ schema.field_type }})</span>
          </label>
        </div>
      </div>
    </div>
  </div>
</template>
