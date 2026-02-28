import { ref } from 'vue'
import { backend } from '@/lib/backend'
import type { AppEvent, EventRsvp, RsvpStatus } from '@/lib/types'

export function useEvents() {
  const events = ref<AppEvent[]>([])
  const rsvpsByEvent = ref<Record<string, EventRsvp[]>>({})
  const loading = ref(false)

  async function fetchEvents(serverId: string) {
    loading.value = true
    try {
      events.value = await backend.events.list(serverId)
    } finally {
      loading.value = false
    }
  }

  async function createEvent(data: Parameters<typeof backend.events.create>[0]) {
    const event = await backend.events.create(data)
    events.value.push(event)
    return event
  }

  async function rsvp(eventId: string, userId: string, status: RsvpStatus) {
    const result = await backend.events.rsvp(eventId, userId, status)
    const list = rsvpsByEvent.value[eventId] ?? []
    const idx = list.findIndex((r) => r.user_id === userId)
    if (idx !== -1) list[idx] = result
    else list.push(result)
    rsvpsByEvent.value[eventId] = list
  }

  async function loadRsvps(eventId: string) {
    rsvpsByEvent.value[eventId] = await backend.events.getRsvps(eventId)
  }

  return { events, rsvpsByEvent, loading, fetchEvents, createEvent, rsvp, loadRsvps }
}
