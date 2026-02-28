<script setup lang="ts">
import { ref } from 'vue'
import type { AppEvent, EventRsvp, RsvpStatus, Channel } from '@/lib/types'

const props = defineProps<{
  events: AppEvent[]
  rsvpsByEvent: Record<string, EventRsvp[]>
  userId: string
  serverId: string
  channels: Channel[]
  canCreate: boolean
}>()

const emit = defineEmits<{
  close: []
  create: [data: { server_id: string; channel_id: string | null; title: string; description: string; start_at: string; end_at: string | null }]
  rsvp: [data: { eventId: string; status: RsvpStatus }]
  loadRsvps: [eventId: string]
}>()

const showCreateForm = ref(false)
const newTitle = ref('')
const newDescription = ref('')
const newStartAt = ref('')
const newEndAt = ref('')
const newChannelId = ref<string | null>(null)
const creating = ref(false)

function handleCreate() {
  if (!newTitle.value.trim() || !newStartAt.value) return
  creating.value = true
  emit('create', {
    server_id: props.serverId,
    channel_id: newChannelId.value,
    title: newTitle.value.trim(),
    description: newDescription.value.trim(),
    start_at: new Date(newStartAt.value).toISOString(),
    end_at: newEndAt.value ? new Date(newEndAt.value).toISOString() : null,
  })
  showCreateForm.value = false
  newTitle.value = ''
  newDescription.value = ''
  newStartAt.value = ''
  newEndAt.value = ''
  newChannelId.value = null
  creating.value = false
}

function formatEventDate(iso: string) {
  return new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function myRsvp(eventId: string): RsvpStatus | null {
  return props.rsvpsByEvent[eventId]?.find((r) => r.user_id === props.userId)?.status ?? null
}

function rsvpCount(eventId: string, status: RsvpStatus): number {
  return props.rsvpsByEvent[eventId]?.filter((r) => r.status === status).length ?? 0
}

function handleRsvp(eventId: string, status: RsvpStatus) {
  if (!props.rsvpsByEvent[eventId]) emit('loadRsvps', eventId)
  emit('rsvp', { eventId, status })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
      <h3 class="text-sm font-semibold">Events</h3>
      <div class="flex items-center gap-1">
        <button
          v-if="canCreate"
          @click="showCreateForm = !showCreateForm"
          :class="showCreateForm ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
          class="rounded p-1 text-xs"
          title="Create Event"
        >
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>
        <button @click="emit('close')" class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
          <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
    </div>

    <!-- Create form -->
    <div v-if="showCreateForm" class="border-b border-bg-tertiary p-4 space-y-3">
      <div>
        <label class="mb-1 block text-xs font-medium text-text-muted">Title *</label>
        <input v-model="newTitle" type="text" maxlength="200" placeholder="Event title" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-text-muted">Description</label>
        <textarea v-model="newDescription" rows="2" maxlength="1000" class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
      </div>
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">Start *</label>
          <input v-model="newStartAt" type="datetime-local" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-text-muted">End (optional)</label>
          <input v-model="newEndAt" type="datetime-local" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent" />
        </div>
      </div>
      <div v-if="channels.length > 0">
        <label class="mb-1 block text-xs font-medium text-text-muted">Channel (optional)</label>
        <select v-model="newChannelId" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent">
          <option :value="null">None</option>
          <option v-for="ch in channels" :key="ch.id" :value="ch.id">#{{ ch.name }}</option>
        </select>
      </div>
      <div class="flex justify-end gap-2">
        <button @click="showCreateForm = false" class="rounded px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary">Cancel</button>
        <button @click="handleCreate" :disabled="creating || !newTitle.trim() || !newStartAt" class="rounded bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover disabled:opacity-50">Create</button>
      </div>
    </div>

    <!-- Events list -->
    <div class="flex-1 overflow-y-auto p-4">
      <p v-if="events.length === 0" class="py-6 text-center text-sm text-text-muted">No upcoming events.</p>

      <div class="space-y-3">
        <div
          v-for="event in events"
          :key="event.id"
          class="rounded-lg border border-bg-tertiary bg-bg-primary p-3"
        >
          <p class="mb-0.5 text-sm font-semibold text-text-primary">{{ event.title }}</p>
          <p class="mb-1 text-xs text-accent">{{ formatEventDate(event.start_at) }}</p>
          <p v-if="event.description" class="mb-2 line-clamp-2 text-xs text-text-secondary">{{ event.description }}</p>

          <!-- RSVP buttons -->
          <div class="flex gap-1.5">
            <button
              v-for="status in (['going', 'maybe', 'not_going'] as const)"
              :key="status"
              @click="handleRsvp(event.id, status)"
              class="rounded px-2.5 py-1 text-xs font-medium transition-colors"
              :class="myRsvp(event.id) === status
                ? status === 'going' ? 'bg-green-600/20 text-green-400'
                  : status === 'maybe' ? 'bg-presence-idle/20 text-presence-idle'
                  : 'bg-danger/20 text-danger'
                : 'bg-bg-secondary text-text-muted hover:bg-bg-hover hover:text-text-secondary'"
            >
              {{ status === 'not_going' ? 'Can\'t go' : status === 'maybe' ? 'Maybe' : 'Going' }}
            </button>
          </div>
          <p v-if="rsvpsByEvent[event.id]" class="mt-1.5 text-xs text-text-muted">
            {{ rsvpCount(event.id, 'going') }} going · {{ rsvpCount(event.id, 'maybe') }} maybe
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
