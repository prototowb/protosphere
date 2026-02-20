import type { Profile, Server, Channel, Member, Message } from '@/lib/types'
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
    },
  }
}
