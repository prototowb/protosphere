<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useUserIntegrations } from '@/composables/useUserIntegrations'
import IntegrationFieldRenderer from './IntegrationFieldRenderer.vue'
import type { PublicIntegrationData } from '@/lib/backend/types'

const props = defineProps<{
  userId: string
}>()

const { getPublicUserData } = useUserIntegrations()
const data = ref<PublicIntegrationData[]>([])
const loading = ref(true)

onMounted(async () => {
  try {
    data.value = await getPublicUserData(props.userId)
  } catch {
    // Silently fail — integration data is non-critical
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- Loading skeleton -->
  <div v-if="loading" class="mt-3 border-t border-bg-tertiary pt-3 space-y-2 animate-pulse">
    <div class="flex items-center gap-1.5">
      <div class="h-3.5 w-3.5 rounded bg-bg-tertiary" />
      <div class="h-3 w-20 rounded bg-bg-tertiary" />
    </div>
    <div class="flex gap-3">
      <div class="h-8 w-16 rounded bg-bg-tertiary" />
      <div class="h-8 w-16 rounded bg-bg-tertiary" />
    </div>
  </div>

  <!-- Only render if there's actual data to show -->
  <template v-else-if="data.length > 0">
    <div
      v-for="entry in data"
      :key="entry.integration.id"
      class="mt-3 border-t border-bg-tertiary pt-3"
    >
      <div class="mb-2 flex items-center gap-1.5">
        <img
          v-if="entry.integration.icon_url"
          :src="entry.integration.icon_url"
          :alt="entry.integration.name"
          class="h-3.5 w-3.5 rounded"
        />
        <svg v-else class="h-3.5 w-3.5 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span class="text-xs font-medium text-text-muted">{{ entry.integration.name }}</span>
      </div>

      <!-- Compact grid for number/badge fields, full width for others -->
      <div class="space-y-2">
        <!-- Number + badge fields as compact row -->
        <div
          v-if="entry.fields.filter((f) => f.field_type === 'number' || f.field_type === 'badge').length > 0"
          class="flex flex-wrap gap-3"
        >
          <div
            v-for="field in entry.fields.filter((f) => f.field_type === 'number' || f.field_type === 'badge')"
            :key="field.id"
          >
            <IntegrationFieldRenderer
              :field-type="field.field_type"
              :label="field.label"
              :value="field.value"
            />
          </div>
        </div>

        <!-- Other field types stacked -->
        <template
          v-for="field in entry.fields.filter((f) => f.field_type !== 'number' && f.field_type !== 'badge')"
          :key="field.id"
        >
          <IntegrationFieldRenderer
            :field-type="field.field_type"
            :label="field.label"
            :value="field.value"
          />
        </template>
      </div>
    </div>
  </template>
</template>
