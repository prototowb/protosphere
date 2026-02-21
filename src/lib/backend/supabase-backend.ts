import type { Profile, Server, Channel, ChannelCategory, Member, Message, Reaction, Ban, DirectMessageGroup, DirectMessage } from '@/lib/types'
import type { Backend } from './types'
import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createSupabaseBackend(): Backend {
  const client = supabase as SupabaseClient

  return {
    auth: {
      async login(email: string, password: string) {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw error
      },

      async register(email: string, password: string, username: string) {
        const { error } = await client.auth.signUp({
          email,
          password,
          options: { data: { username } },
        })
        if (error) throw error
      },

      async loginWithOAuth(provider: string) {
        const { error } = await client.auth.signInWithOAuth({
          provider: provider as 'github' | 'google',
          options: { redirectTo: `${window.location.origin}/channels/@me` },
        })
        if (error) throw error
      },

      async logout() {
        const { error } = await client.auth.signOut()
        if (error) throw error
      },

      async resetPassword(email: string) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/settings`,
        })
        if (error) throw error
      },

      init(onSession) {
        client.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            onSession({
              user: { id: session.user.id, email: session.user.email ?? '' },
              access_token: session.access_token,
            })
          } else {
            onSession(null)
          }
        })

        client.auth.onAuthStateChange((_event, session) => {
          if (session) {
            onSession({
              user: { id: session.user.id, email: session.user.email ?? '' },
              access_token: session.access_token,
            })
          } else {
            onSession(null)
          }
        })
      },
    },

    profiles: {
      async get(id: string) {
        const { data, error } = await client.from('profiles').select('*').eq('id', id).single()
        if (error) throw error
        return data as Profile
      },

      async update(id: string, updates: Partial<Profile>) {
        const { data, error } = await client
          .from('profiles')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Profile
      },

      async uploadAvatar(userId: string, file: File) {
        const fileExt = file.name.split('.').pop()
        const filePath = `${userId}/avatar.${fileExt}`
        const { error: uploadError } = await client.storage
          .from('avatars')
          .upload(filePath, file, { upsert: true })
        if (uploadError) throw uploadError
        const { data } = client.storage.from('avatars').getPublicUrl(filePath)
        return data.publicUrl
      },

      async search(query: string, excludeUserId: string) {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .neq('id', excludeUserId)
          .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
          .limit(20)
        if (error) throw error
        return data as Profile[]
      },
    },

    servers: {
      async list(userId: string) {
        const { data, error } = await client
          .from('members')
          .select('server_id, servers(*)')
          .eq('user_id', userId)
        if (error) throw error
        return (data ?? []).map((row: Record<string, unknown>) => row.servers as Server)
      },

      async get(id: string) {
        const { data, error } = await client.from('servers').select('*').eq('id', id).single()
        if (error) throw error
        return data as Server
      },

      async create(input, ownerId) {
        const { data, error } = await client
          .from('servers')
          .insert({ ...input, owner_id: ownerId })
          .select()
          .single()
        if (error) throw error
        return data as Server
      },

      async update(id, updates) {
        const { data, error } = await client
          .from('servers')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Server
      },

      async delete(id) {
        const { error } = await client.from('servers').delete().eq('id', id)
        if (error) throw error
      },

      async getByInviteCode(code) {
        const { data, error } = await client
          .from('servers')
          .select('*')
          .eq('invite_code', code)
          .single()
        if (error) throw error
        return data as Server
      },

      async regenerateInviteCode(id) {
        const code = Math.random().toString(36).substring(2, 10)
        const { error } = await client
          .from('servers')
          .update({ invite_code: code })
          .eq('id', id)
        if (error) throw error
        return code
      },
    },

    channels: {
      async list(serverId: string) {
        const { data, error } = await client
          .from('channels')
          .select('*')
          .eq('server_id', serverId)
          .order('position')
        if (error) throw error
        return data as Channel[]
      },

      async get(id: string) {
        const { data, error } = await client.from('channels').select('*').eq('id', id).single()
        if (error) throw error
        return data as Channel
      },

      async create(input) {
        const { data, error } = await client.from('channels').insert(input).select().single()
        if (error) throw error
        return data as Channel
      },

      async update(id, updates) {
        const { data, error } = await client
          .from('channels')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Channel
      },

      async delete(id) {
        const { error } = await client.from('channels').delete().eq('id', id)
        if (error) throw error
      },
    },

    members: {
      async list(serverId: string) {
        const { data, error } = await client
          .from('members')
          .select('*, profile:profiles(*)')
          .eq('server_id', serverId)
        if (error) throw error
        return data as (Member & { profile: Profile })[]
      },

      async join(serverId: string, userId: string) {
        const { data, error } = await client
          .from('members')
          .insert({ server_id: serverId, user_id: userId, role: 'member' })
          .select()
          .single()
        if (error) throw error
        return data as Member
      },

      async leave(serverId: string, userId: string) {
        const { error } = await client
          .from('members')
          .delete()
          .eq('server_id', serverId)
          .eq('user_id', userId)
        if (error) throw error
      },

      async updateRole(serverId: string, userId: string, role) {
        const { data, error } = await client
          .from('members')
          .update({ role })
          .eq('server_id', serverId)
          .eq('user_id', userId)
          .select()
          .single()
        if (error) throw error
        return data as Member
      },
    },

    messages: {
      async list(channelId: string) {
        const { data, error } = await client
          .from('messages')
          .select('*, profile:profiles(*)')
          .eq('channel_id', channelId)
          .order('created_at')
        if (error) throw error
        return data as (Message & { profile: Profile })[]
      },

      async send(channelId: string, authorId: string, content: string, replyToId?: string | null) {
        const { data, error } = await client
          .from('messages')
          .insert({ channel_id: channelId, author_id: authorId, content, reply_to_id: replyToId ?? null })
          .select('*, profile:profiles(*)')
          .single()
        if (error) throw error
        return data as Message & { profile: Profile }
      },

      async edit(id: string, content: string) {
        const { data, error } = await client
          .from('messages')
          .update({ content, edited_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Message
      },

      async delete(id: string) {
        const { error } = await client.from('messages').delete().eq('id', id)
        if (error) throw error
      },

      async pin(id: string) {
        const { data, error } = await client
          .from('messages')
          .update({ is_pinned: true })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Message
      },

      async unpin(id: string) {
        const { data, error } = await client
          .from('messages')
          .update({ is_pinned: false })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as Message
      },

      async listPinned(channelId: string) {
        const { data, error } = await client
          .from('messages')
          .select('*, profile:profiles(*)')
          .eq('channel_id', channelId)
          .eq('is_pinned', true)
          .order('created_at')
        if (error) throw error
        return data as (Message & { profile: Profile })[]
      },
    },

    categories: {
      async list(serverId: string) {
        const { data, error } = await client
          .from('channel_categories')
          .select('*')
          .eq('server_id', serverId)
          .order('position')
        if (error) throw error
        return data as ChannelCategory[]
      },

      async create(input) {
        const { data, error } = await client
          .from('channel_categories')
          .insert({ ...input, name: input.name.toUpperCase() })
          .select()
          .single()
        if (error) throw error
        return data as ChannelCategory
      },

      async update(id, updates) {
        const { data, error } = await client
          .from('channel_categories')
          .update(updates)
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as ChannelCategory
      },

      async delete(id) {
        // Unassign channels first
        await client.from('channels').update({ category_id: null }).eq('category_id', id)
        const { error } = await client.from('channel_categories').delete().eq('id', id)
        if (error) throw error
      },
    },

    reactions: {
      async listByChannel(channelId: string) {
        const { data, error } = await client
          .from('reactions')
          .select('*, messages!inner(channel_id)')
          .eq('messages.channel_id', channelId)
        if (error) throw error
        return data as Reaction[]
      },

      async add(messageId: string, userId: string, emoji: string) {
        const { data, error } = await client
          .from('reactions')
          .insert({ message_id: messageId, user_id: userId, emoji })
          .select()
          .single()
        if (error) throw error
        return data as Reaction
      },

      async remove(messageId: string, userId: string, emoji: string) {
        const { error } = await client
          .from('reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .eq('emoji', emoji)
        if (error) throw error
      },
    },

    bans: {
      async list(serverId: string) {
        const { data, error } = await client
          .from('bans')
          .select('*, profile:profiles(*)')
          .eq('server_id', serverId)
        if (error) throw error
        return data as (Ban & { profile: Profile })[]
      },

      async add(serverId: string, userId: string, bannedBy: string, reason = '') {
        await client.from('members').delete().eq('server_id', serverId).eq('user_id', userId)
        const { data, error } = await client
          .from('bans')
          .insert({ server_id: serverId, user_id: userId, banned_by: bannedBy, reason })
          .select()
          .single()
        if (error) throw error
        return data as Ban
      },

      async remove(serverId: string, userId: string) {
        const { error } = await client
          .from('bans')
          .delete()
          .eq('server_id', serverId)
          .eq('user_id', userId)
        if (error) throw error
      },

      async check(serverId: string, userId: string) {
        const { data } = await client
          .from('bans')
          .select('user_id')
          .eq('server_id', serverId)
          .eq('user_id', userId)
          .maybeSingle()
        return !!data
      },
    },

    dm: {
      async listGroups(userId: string) {
        const { data, error } = await client
          .from('direct_message_members')
          .select('dm_group_id, direct_message_groups(*)')
          .eq('user_id', userId)
        if (error) throw error
        // For each group, fetch other member's profile and last message
        const result = []
        for (const row of (data ?? [])) {
          const group = (row as Record<string, unknown>).direct_message_groups as DirectMessageGroup
          const { data: members } = await client
            .from('direct_message_members')
            .select('user_id, profiles(*)')
            .eq('dm_group_id', group.id)
            .neq('user_id', userId)
            .single()
          const { data: lastMsg } = await client
            .from('direct_messages')
            .select('*')
            .eq('dm_group_id', group.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (members) {
            result.push({
              ...group,
              otherUser: (members as Record<string, unknown>).profiles as Profile,
              lastMessage: lastMsg as DirectMessage | null,
            })
          }
        }
        return result
      },

      async getOrCreate(userId: string, otherUserId: string) {
        // Find existing group
        const { data: myGroups } = await client
          .from('direct_message_members')
          .select('dm_group_id')
          .eq('user_id', userId)
        const myGroupIds = (myGroups ?? []).map((r: Record<string, unknown>) => r.dm_group_id as string)

        if (myGroupIds.length > 0) {
          const { data: shared } = await client
            .from('direct_message_members')
            .select('dm_group_id, direct_message_groups!inner(is_group)')
            .eq('user_id', otherUserId)
            .in('dm_group_id', myGroupIds)
          const existing = (shared ?? []).find(
            (r: Record<string, unknown>) =>
              !(r.direct_message_groups as DirectMessageGroup).is_group,
          )
          if (existing) {
            const { data: group } = await client
              .from('direct_message_groups')
              .select('*')
              .eq('id', (existing as Record<string, unknown>).dm_group_id)
              .single()
            return group as DirectMessageGroup
          }
        }

        // Create new group
        const { data: group, error } = await client
          .from('direct_message_groups')
          .insert({ is_group: false })
          .select()
          .single()
        if (error) throw error
        await client.from('direct_message_members').insert([
          { dm_group_id: group.id, user_id: userId },
          { dm_group_id: group.id, user_id: otherUserId },
        ])
        return group as DirectMessageGroup
      },

      async listMessages(dmGroupId: string) {
        const { data, error } = await client
          .from('direct_messages')
          .select('*, profile:profiles(*)')
          .eq('dm_group_id', dmGroupId)
          .order('created_at')
        if (error) throw error
        return data as (DirectMessage & { profile: Profile })[]
      },

      async sendMessage(dmGroupId: string, authorId: string, content: string, replyToId?: string | null) {
        const { data, error } = await client
          .from('direct_messages')
          .insert({ dm_group_id: dmGroupId, author_id: authorId, content, reply_to_id: replyToId ?? null })
          .select('*, profile:profiles(*)')
          .single()
        if (error) throw error
        return data as DirectMessage & { profile: Profile }
      },

      async editMessage(id: string, content: string) {
        const { data, error } = await client
          .from('direct_messages')
          .update({ content, edited_at: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()
        if (error) throw error
        return data as DirectMessage
      },

      async deleteMessage(id: string) {
        const { error } = await client.from('direct_messages').delete().eq('id', id)
        if (error) throw error
      },
    },
  }
}
