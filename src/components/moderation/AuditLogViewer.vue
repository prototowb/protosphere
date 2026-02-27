<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { backend } from '@/lib/backend'
import type { AuditLog } from '@/lib/types'

const props = defineProps<{ serverId: string }>()

const logs = ref<AuditLog[]>([])
const loading = ref(false)
const hasMore = ref(true)
const LIMIT = 50

async function loadMore() {
  if (loading.value || !hasMore.value) return
  loading.value = true
  try {
    const page = await backend.audit_log.list(props.serverId, logs.value.length, LIMIT)
    logs.value.push(...page)
    if (page.length < LIMIT) hasMore.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => loadMore())

const ACTION_LABELS: Record<string, string> = {
  'member.kick': 'Kicked member',
  'member.ban': 'Banned member',
  'member.unban': 'Unbanned member',
  'message.delete': 'Deleted message',
  'message.pin': 'Pinned message',
  'message.unpin': 'Unpinned message',
  'channel.create': 'Created channel',
  'channel.update': 'Updated channel',
  'channel.delete': 'Deleted channel',
  'role.create': 'Created role',
  'role.update': 'Updated role',
  'role.delete': 'Deleted role',
  'role.assign': 'Assigned role',
  'role.remove': 'Removed role',
  'server.update': 'Updated space settings',
  'mute.add': 'Muted member',
  'mute.remove': 'Unmuted member',
}

const ACTION_COLORS: Record<string, string> = {
  'member.kick': 'text-orange-400',
  'member.ban': 'text-danger',
  'member.unban': 'text-green-400',
  'message.delete': 'text-orange-400',
  'mute.add': 'text-orange-400',
  'mute.remove': 'text-green-400',
  'role.assign': 'text-accent',
  'role.remove': 'text-text-muted',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString()
}

function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action
}

function actionColor(action: string) {
  return ACTION_COLORS[action] ?? 'text-text-secondary'
}

function detailsSummary(log: AuditLog): string {
  const d = log.details
  if (!d || Object.keys(d).length === 0) return ''
  if ('reason' in d && d.reason) return `Reason: ${d.reason}`
  if ('name' in d && d.name) return `Name: ${d.name}`
  return ''
}
</script>

<template>
  <div>
    <div v-if="logs.length === 0 && !loading" class="py-8 text-center text-sm text-text-muted">
      No audit log entries yet.
    </div>

    <div class="space-y-1">
      <div
        v-for="log in logs"
        :key="log.id"
        class="flex items-start gap-3 rounded px-3 py-2 text-sm hover:bg-bg-hover"
      >
        <!-- Action badge -->
        <span
          class="mt-0.5 w-36 flex-shrink-0 truncate text-xs font-mono font-medium"
          :class="actionColor(log.action)"
        >
          {{ actionLabel(log.action) }}
        </span>

        <!-- Details -->
        <div class="min-w-0 flex-1">
          <span class="text-text-secondary">
            Target: <code class="font-mono text-xs text-text-muted">{{ log.target_id.slice(0, 8) }}…</code>
          </span>
          <span v-if="detailsSummary(log)" class="ml-2 text-text-muted">{{ detailsSummary(log) }}</span>
        </div>

        <!-- Timestamp -->
        <span class="flex-shrink-0 text-xs text-text-muted">{{ formatDate(log.created_at) }}</span>
      </div>
    </div>

    <div v-if="hasMore" class="mt-4 flex justify-center">
      <button
        @click="loadMore"
        :disabled="loading"
        class="rounded px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover disabled:opacity-50"
      >
        {{ loading ? 'Loading…' : 'Load more' }}
      </button>
    </div>
  </div>
</template>
