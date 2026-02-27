<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { backend } from '@/lib/backend'
import type { Report, Profile } from '@/lib/types'
import type { ReportStatus } from '@/lib/types'

type EnrichedReport = Report & { reporter_profile: Profile; reviewer_profile: Profile | null }

const reports = ref<EnrichedReport[]>([])
const loading = ref(false)
const hasMore = ref(true)
const LIMIT = 20
const filterStatus = ref<ReportStatus>('pending')

async function load(reset = false) {
  if (loading.value || (!hasMore.value && !reset)) return
  loading.value = true
  try {
    const page = await backend.reports.list(null, filterStatus.value, reset ? 0 : reports.value.length, LIMIT)
    if (reset) {
      reports.value = page
    } else {
      reports.value.push(...page)
    }
    hasMore.value = page.length === LIMIT
  } finally {
    loading.value = false
  }
}

async function changeFilter(status: ReportStatus) {
  filterStatus.value = status
  hasMore.value = true
  await load(true)
}

async function updateStatus(id: string, status: 'resolved' | 'dismissed') {
  await backend.reports.update(id, { status })
  reports.value = reports.value.filter((r) => r.id !== id)
}

onMounted(() => load(true))

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

const CATEGORY_LABELS: Record<string, string> = {
  spam: 'Spam',
  harassment: 'Harassment',
  nsfw: 'Inappropriate Content',
  misinformation: 'Misinformation',
  other: 'Other',
}
</script>

<template>
  <div class="min-h-screen bg-bg-primary p-8">
    <div class="mx-auto max-w-3xl">
      <h1 class="mb-1 text-2xl font-bold">Mod Queue</h1>
      <p class="mb-6 text-sm text-text-muted">Review and action user reports</p>

      <!-- Filter tabs -->
      <div class="mb-6 flex gap-1 border-b border-bg-tertiary">
        <button
          v-for="status in (['pending', 'reviewing', 'resolved', 'dismissed'] as const)"
          :key="status"
          @click="changeFilter(status)"
          class="px-4 py-2 text-sm capitalize transition-colors"
          :class="filterStatus === status ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'"
        >
          {{ status }}
        </button>
      </div>

      <div v-if="reports.length === 0 && !loading" class="py-12 text-center text-sm text-text-muted">
        No {{ filterStatus }} reports.
      </div>

      <div class="space-y-3">
        <div
          v-for="report in reports"
          :key="report.id"
          class="rounded-lg bg-bg-secondary p-4"
        >
          <div class="mb-2 flex items-start justify-between gap-4">
            <div class="flex items-center gap-2">
              <span class="rounded bg-bg-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary">
                {{ CATEGORY_LABELS[report.category] ?? report.category }}
              </span>
              <span class="text-xs text-text-muted">{{ report.reported_type }}</span>
            </div>
            <span class="flex-shrink-0 text-xs text-text-muted">{{ formatDate(report.created_at) }}</span>
          </div>

          <p v-if="report.description" class="mb-2 text-sm text-text-secondary">
            "{{ report.description }}"
          </p>

          <div class="mb-3 text-xs text-text-muted">
            Reported by
            <span class="font-medium text-text-secondary">{{ report.reporter_profile.display_name }}</span>
            ·
            Target: <code class="font-mono text-text-muted">{{ report.reported_id.slice(0, 8) }}…</code>
          </div>

          <div v-if="filterStatus === 'pending' || filterStatus === 'reviewing'" class="flex gap-2">
            <button
              @click="updateStatus(report.id, 'resolved')"
              class="rounded bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30"
            >
              Resolve
            </button>
            <button
              @click="updateStatus(report.id, 'dismissed')"
              class="rounded bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-muted hover:bg-bg-hover"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>

      <div v-if="hasMore" class="mt-6 flex justify-center">
        <button
          @click="load()"
          :disabled="loading"
          class="rounded px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
        >
          {{ loading ? 'Loading…' : 'Load more' }}
        </button>
      </div>
      <div v-if="loading && reports.length === 0" class="mt-6 text-center text-sm text-text-muted">Loading…</div>
    </div>
  </div>
</template>
