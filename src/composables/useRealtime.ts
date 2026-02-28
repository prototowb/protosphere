/**
 * useRealtime — Supabase Realtime integration for messages, presence, and typing.
 *
 * All functions are no-ops when supabase is null (local mode).
 * Module-level channel refs survive across component re-renders.
 */
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { useMessagesStore } from '@/stores/messages'
import { usePresenceStore } from '@/stores/presence'
import type { Message, Profile, UserStatus } from '@/lib/types'

// ── Module-level channel refs ──────────────────────────────────────────────
let _messagesChannel: RealtimeChannel | null = null
let _presenceChannel: RealtimeChannel | null = null
let _typingChannel: RealtimeChannel | null = null

// Typing state (per-user timer map)
const _typingState = new Map<string, { displayName: string; timer: ReturnType<typeof setTimeout> }>()
let _onTypingUpdate: ((names: string[]) => void) | null = null

// ── Exported module-level helper (called by usePresence.ts) ───────────────
export function trackPresenceStatus(status: UserStatus) {
  if (_presenceChannel) {
    _presenceChannel.track({ status }).catch(() => {})
  }
}

// ── Composable ────────────────────────────────────────────────────────────
export function useRealtime() {
  const messagesStore = useMessagesStore()
  const presenceStore = usePresenceStore()

  // ── Messages ─────────────────────────────────────────────────────────────
  function startMessages(channelId: string) {
    if (!supabase) return
    stopMessages()

    _messagesChannel = supabase
      .channel(`messages:${channelId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        async (payload) => {
          // Fetch the full row with joined profile so we have display_name + avatar
          const { data } = await supabase!
            .from('messages')
            .select('*, profile:profiles(*)')
            .eq('id', (payload.new as { id: string }).id)
            .single()
          if (!data) return
          const list = messagesStore.messagesByChannel[channelId]
          if (list && !list.find((m) => m.id === (data as Message).id)) {
            list.push(data as Message & { profile: Profile })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const list = messagesStore.messagesByChannel[channelId]
          if (!list) return
          const updated = payload.new as Message
          const idx = list.findIndex((m) => m.id === updated.id)
          if (idx !== -1) {
            Object.assign(list[idx]!, {
              content: updated.content,
              edited_at: updated.edited_at,
              is_pinned: updated.is_pinned,
            })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `channel_id=eq.${channelId}` },
        (payload) => {
          const list = messagesStore.messagesByChannel[channelId]
          if (!list) return
          const deleted = payload.old as { id: string }
          messagesStore.messagesByChannel[channelId] = list.filter((m) => m.id !== deleted.id)
        },
      )
      .subscribe()
  }

  function stopMessages() {
    if (_messagesChannel && supabase) {
      supabase.removeChannel(_messagesChannel)
      _messagesChannel = null
    }
  }

  // ── Presence ──────────────────────────────────────────────────────────────
  function startPresence(serverId: string, userId: string, displayName: string, initialStatus: UserStatus) {
    if (!supabase) return
    stopPresence()
    presenceStore.clear()

    _presenceChannel = supabase.channel(`presence:server:${serverId}`, {
      config: { presence: { key: userId } },
    })

    type PresencePayload = { status: UserStatus; displayName: string }

    _presenceChannel
      .on('presence', { event: 'sync' }, () => {
        if (!_presenceChannel) return
        const state = _presenceChannel.presenceState<PresencePayload>()
        for (const [uid, entries] of Object.entries(state)) {
          const entry = (entries as PresencePayload[])[0]
          if (entry) presenceStore.setStatus(uid, entry.status)
        }
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        const entry = (newPresences as unknown as PresencePayload[])[0]
        if (key && entry) presenceStore.setStatus(key, entry.status ?? 'online')
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        if (key) presenceStore.setStatus(key, 'offline')
      })
      .subscribe(async (subscribeStatus) => {
        if (subscribeStatus === 'SUBSCRIBED') {
          await _presenceChannel!.track({ status: initialStatus, displayName })
        }
      })
  }

  function stopPresence() {
    if (_presenceChannel && supabase) {
      supabase.removeChannel(_presenceChannel)
      _presenceChannel = null
    }
  }

  // ── Typing ────────────────────────────────────────────────────────────────
  function startTypingChannel(channelId: string, onUpdate: (names: string[]) => void) {
    if (!supabase) return
    stopTypingChannel()
    _onTypingUpdate = onUpdate
    _typingState.clear()

    type TypingPayload = { userId: string; displayName: string; action: 'typing' | 'stop' }

    _typingChannel = supabase
      .channel(`typing:${channelId}`)
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        const p = payload as TypingPayload
        if (p.action === 'typing') {
          const existing = _typingState.get(p.userId)
          if (existing) clearTimeout(existing.timer)
          const timer = setTimeout(() => {
            _typingState.delete(p.userId)
            _onTypingUpdate?.([..._typingState.values()].map((e) => e.displayName))
          }, 3000)
          _typingState.set(p.userId, { displayName: p.displayName, timer })
        } else {
          const existing = _typingState.get(p.userId)
          if (existing) clearTimeout(existing.timer)
          _typingState.delete(p.userId)
        }
        _onTypingUpdate?.([..._typingState.values()].map((e) => e.displayName))
      })
      .subscribe()
  }

  function broadcastTyping(userId: string, displayName: string) {
    _typingChannel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, displayName, action: 'typing' },
    })
  }

  function broadcastStopTyping(userId: string, displayName: string) {
    _typingChannel?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId, displayName, action: 'stop' },
    })
    _typingState.delete(userId)
  }

  function stopTypingChannel() {
    for (const { timer } of _typingState.values()) clearTimeout(timer)
    _typingState.clear()
    _onTypingUpdate = null
    if (_typingChannel && supabase) {
      supabase.removeChannel(_typingChannel)
      _typingChannel = null
    }
  }

  function stopAll() {
    stopMessages()
    stopPresence()
    stopTypingChannel()
  }

  return {
    startMessages,
    stopMessages,
    startPresence,
    stopPresence,
    startTypingChannel,
    broadcastTyping,
    broadcastStopTyping,
    stopTypingChannel,
    stopAll,
  }
}
