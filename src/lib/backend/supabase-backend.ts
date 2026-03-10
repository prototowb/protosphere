import type { Profile, Server, Channel, ChannelCategory, Member, Message, Attachment, Reaction, Ban, DirectMessageGroup, DirectMessage, Role, UserRole, ChannelRoleOverride, CommunitySettings, AuditLog, Report, Mute, AutomodRule, Poll, PollOption, PollVote, AppEvent, EventRsvp, CommunityInvite, NotificationPreference, DmNotificationPreference } from '@/lib/types'
import type { Backend } from './types'
import { supabase } from '@/lib/supabase'
import type { SupabaseClient } from '@supabase/supabase-js'
import { serializePermissions, PermissionPresets, Permission } from '@/lib/permissions'

export function createSupabaseBackend(): Backend {
  const client = supabase as SupabaseClient

  return {
    auth: {
      async login(email: string, password: string) {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (error) throw error
      },

      async register(email: string, password: string, username: string) {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: { data: { username } },
        })
        if (error) throw error
        // session is null when email confirmation is required
        return { needsConfirmation: data.session === null }
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

      async logoutGlobal() {
        const { error } = await client.auth.signOut({ scope: 'global' })
        if (error) throw error
      },

      async resetPassword(email: string) {
        const { error } = await client.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        })
        if (error) throw error
      },

      async updatePassword(newPassword: string) {
        const { error } = await client.auth.updateUser({ password: newPassword })
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

      async listPending() {
        const { data, error } = await client
          .from('profiles')
          .select('*')
          .eq('account_status', 'pending')
          .order('created_at', { ascending: true })
        if (error) throw error
        return data as Profile[]
      },

      async approve(userId: string) {
        const { error } = await client
          .from('profiles')
          .update({ account_status: 'active' })
          .eq('id', userId)
        if (error) throw error
      },

      async reject(userId: string) {
        const { error } = await client
          .from('profiles')
          .update({ account_status: 'rejected' })
          .eq('id', userId)
        if (error) throw error
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
        const server = data as Server

        // Auto-join owner as 'owner' role (required for RLS to allow subsequent reads)
        await client.from('members').insert({ server_id: server.id, user_id: ownerId, role: 'owner' })

        // Auto-create default #general channel
        await client.from('channels').insert({
          server_id: server.id,
          name: 'general',
          description: 'General discussion',
          type: 'text',
          position: 0,
          is_default: true,
          slowmode_seconds: 0,
        })

        // Seed system roles
        const { data: seededRoles } = await client.from('roles').insert([
          { server_id: server.id, name: 'Owner', color: '#f97316', position: 0, permissions: serializePermissions(Permission.ADMINISTRATOR), is_default: false, is_system: true },
          { server_id: server.id, name: 'Admin', color: '#3b82f6', position: 10, permissions: serializePermissions(PermissionPresets.ADMIN), is_default: false, is_system: true },
          { server_id: server.id, name: 'Moderator', color: '#a855f7', position: 20, permissions: serializePermissions(PermissionPresets.MODERATOR), is_default: false, is_system: true },
          { server_id: server.id, name: 'Member', color: null, position: 30, permissions: serializePermissions(PermissionPresets.MEMBER), is_default: true, is_system: true },
        ]).select()

        // Assign Owner role to creator
        if (seededRoles) {
          const ownerRole = (seededRoles as Role[]).find((r) => r.name === 'Owner')
          if (ownerRole) {
            await client.from('user_roles').insert({ user_id: ownerId, role_id: ownerRole.id })
          }
        }

        return server
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
          .is('parent_message_id', null)
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
          .select('*, profile:profiles!user_id(*)')
          .eq('server_id', serverId)
        if (error) throw error
        return data as (Member & { profile: Profile })[]
      },

      async join(serverId: string, userId: string) {
        // Insert without .select() to avoid RETURNING * triggering the SELECT
        // RLS policy before is_server_member() sees the new row.
        const { error } = await client
          .from('members')
          .insert({ server_id: serverId, user_id: userId, role: 'member' })
        if (error) throw error

        // Assign default role
        const { data: defaultRole } = await client
          .from('roles')
          .select('id')
          .eq('server_id', serverId)
          .eq('is_default', true)
          .single()
        if (defaultRole) {
          await client.from('user_roles').insert({ user_id: userId, role_id: (defaultRole as Role).id })
        }

        // Fetch the member row in a separate query (now the user is a member)
        const { data, error: fetchError } = await client
          .from('members')
          .select()
          .eq('server_id', serverId)
          .eq('user_id', userId)
          .single()
        if (fetchError) throw fetchError
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
      async list(channelId: string, before?: string, limit = 50) {
        let query = client
          .from('messages')
          .select('*, profile:profiles!author_id(*)')
          .eq('channel_id', channelId)
          .order('created_at', { ascending: false })
          .limit(limit + 1)
        if (before) query = query.lt('created_at', before)
        const { data, error } = await query
        if (error) throw error
        const hasMore = data.length > limit
        const messages = (hasMore ? data.slice(0, limit) : data).reverse()
        return { messages: messages as (Message & { profile: Profile })[], hasMore }
      },

      async send(channelId: string, authorId: string, content: string, replyToId?: string | null, attachments: Attachment[] = []) {
        const { data, error } = await client
          .from('messages')
          .insert({ channel_id: channelId, author_id: authorId, content, reply_to_id: replyToId ?? null, attachments })
          .select('*, profile:profiles!author_id(*)')
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
          .select('*, profile:profiles!author_id(*)')
          .eq('channel_id', channelId)
          .eq('is_pinned', true)
          .order('created_at')
        if (error) throw error
        return data as (Message & { profile: Profile })[]
      },

      async upload(file: File, userId: string) {
        const path = `${userId}/${Date.now()}-${file.name}`
        const { error } = await client.storage.from('attachments').upload(path, file)
        if (error) throw error
        const { data } = client.storage.from('attachments').getPublicUrl(path)
        return { path, publicUrl: data.publicUrl }
      },

      async search(channelId: string, query: string, limit = 25) {
        const { data, error } = await client
          .from('messages')
          .select('*, profile:profiles!author_id(*)')
          .eq('channel_id', channelId)
          .textSearch('search_tsv', query, { type: 'websearch' })
          .order('created_at', { ascending: false })
          .limit(limit)
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
          .select('*, profile:profiles!user_id(*)')
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

        // Create new group — pre-generate the UUID so we can insert members
        // BEFORE selecting the group back. The dm_groups_select policy requires
        // the user to be in direct_message_members, so we must add members first
        // or the INSERT...RETURNING will be blocked by RLS (42501).
        const groupId = crypto.randomUUID()
        const { error: createError } = await client
          .from('direct_message_groups')
          .insert({ id: groupId, is_group: false })
        if (createError) throw createError
        await client.from('direct_message_members').insert([
          { dm_group_id: groupId, user_id: userId },
          { dm_group_id: groupId, user_id: otherUserId },
        ])
        const { data: group, error: fetchError } = await client
          .from('direct_message_groups')
          .select('*')
          .eq('id', groupId)
          .single()
        if (fetchError) throw fetchError
        return group as DirectMessageGroup
      },

      async listMessages(dmGroupId: string) {
        const { data, error } = await client
          .from('direct_messages')
          .select('*, profile:profiles!author_id(*)')
          .eq('dm_group_id', dmGroupId)
          .order('created_at')
        if (error) throw error
        return data as (DirectMessage & { profile: Profile })[]
      },

      async sendMessage(dmGroupId: string, authorId: string, content: string, replyToId?: string | null) {
        const { data, error } = await client
          .from('direct_messages')
          .insert({ dm_group_id: dmGroupId, author_id: authorId, content, reply_to_id: replyToId ?? null })
          .select('*, profile:profiles!author_id(*)')
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

    roles: {
      async list(serverId: string) {
        const { data, error } = await client
          .from('roles')
          .select('*')
          .eq('server_id', serverId)
          .order('position')
        if (error) throw error
        return (data ?? []).map((r: Record<string, unknown>) => ({ ...r, permissions: String(r.permissions) }) as Role)
      },

      async create(input) {
        const { data, error } = await client.from('roles').insert(input).select().single()
        if (error) throw error
        const r = data as Record<string, unknown>
        return { ...r, permissions: String(r.permissions) } as Role
      },

      async update(id, updates) {
        const { data, error } = await client.from('roles').update(updates).eq('id', id).select().single()
        if (error) throw error
        const r = data as Record<string, unknown>
        return { ...r, permissions: String(r.permissions) } as Role
      },

      async delete(id) {
        const { error } = await client.from('roles').delete().eq('id', id)
        if (error) throw error
      },

      async listUserRoles(serverId: string, userId: string) {
        const { data, error } = await client
          .from('user_roles')
          .select('roles(*)')
          .eq('user_id', userId)
        if (error) throw error
        return (data ?? [])
          .map((row: Record<string, unknown>) => {
            const r = row.roles as Record<string, unknown>
            return { ...r, permissions: String(r.permissions) } as Role
          })
          .filter((r) => r.server_id === serverId)
      },

      async assignRole(userId: string, roleId: string) {
        const { data, error } = await client
          .from('user_roles')
          .insert({ user_id: userId, role_id: roleId })
          .select()
          .single()
        if (error) throw error
        return data as UserRole
      },

      async removeRole(userId: string, roleId: string) {
        const { error } = await client
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role_id', roleId)
        if (error) throw error
      },

      async listChannelOverrides(channelId: string) {
        const { data, error } = await client
          .from('channel_role_overrides')
          .select('*')
          .eq('channel_id', channelId)
        if (error) throw error
        return (data ?? []).map((o: Record<string, unknown>) => ({
          ...o,
          allow: String(o.allow),
          deny: String(o.deny),
        }) as ChannelRoleOverride)
      },

      async setChannelOverride(channelId: string, roleId: string, allow: string, deny: string) {
        const { data, error } = await client
          .from('channel_role_overrides')
          .upsert({ channel_id: channelId, role_id: roleId, allow, deny })
          .select()
          .single()
        if (error) throw error
        const o = data as Record<string, unknown>
        return { ...o, allow: String(o.allow), deny: String(o.deny) } as ChannelRoleOverride
      },

      async deleteChannelOverride(channelId: string, roleId: string) {
        const { error } = await client
          .from('channel_role_overrides')
          .delete()
          .eq('channel_id', channelId)
          .eq('role_id', roleId)
        if (error) throw error
      },
    },

    community: {
      async get() {
        const { data, error } = await client
          .from('community_settings')
          .select('*')
          .limit(1)
          .single()
        if (error) throw error
        return data as CommunitySettings
      },

      async update(updates) {
        const { data: existing } = await client.from('community_settings').select('id').limit(1).single()
        if (!existing) throw new Error('Community settings not found')
        const { data, error } = await client
          .from('community_settings')
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq('id', (existing as { id: string }).id)
          .select()
          .single()
        if (error) throw error
        return data as CommunitySettings
      },
    },

    audit_log: {
      async log(serverId, actorId, action, targetType, targetId, details = {}) {
        const { data, error } = await client.from('audit_log').insert({ server_id: serverId, actor_id: actorId, action, target_type: targetType, target_id: targetId, details }).select().single()
        if (error) throw error
        return data as AuditLog
      },

      async list(serverId, offset = 0, limit = 50) {
        let query = client.from('audit_log').select('*')
        if (serverId) query = query.eq('server_id', serverId)
        const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
        if (error) throw error
        return data as AuditLog[]
      },
    },

    reports: {
      async list(serverId, status, offset = 0, limit = 50) {
        let query = client.from('reports').select('*, reporter_profile:reporter_id(id,username,display_name,avatar_url), reviewer_profile:reviewed_by(id,username,display_name,avatar_url)')
        if (serverId) query = query.eq('server_id', serverId)
        if (status) query = query.eq('status', status)
        const { data, error } = await query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
        if (error) throw error
        return (data as any[]).map((r) => ({ ...r, reporter_profile: r.reporter_profile as Profile, reviewer_profile: r.reviewer_profile as Profile | null }))
      },

      async create(data) {
        const { data: report, error } = await client.from('reports').insert(data).select().single()
        if (error) throw error
        return report as Report
      },

      async update(id, updates) {
        const resolved_at = updates.status === 'resolved' || updates.status === 'dismissed' ? new Date().toISOString() : undefined
        const { data, error } = await client.from('reports').update({ ...updates, ...(resolved_at ? { resolved_at } : {}) }).eq('id', id).select().single()
        if (error) throw error
        return data as Report
      },
    },

    mutes: {
      async list(serverId) {
        const now = new Date().toISOString()
        const { data, error } = await client
          .from('mutes')
          .select('*, user_profile:user_id(id,username,display_name,avatar_url), muted_by_profile:muted_by(id,username,display_name,avatar_url)')
          .eq('server_id', serverId)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
        if (error) throw error
        return (data as any[]).map((m) => ({ ...m, user_profile: m.user_profile as Profile, muted_by_profile: m.muted_by_profile as Profile }))
      },

      async add(serverId, userId, mutedBy, reason = '', expiresAt = null) {
        const { data, error } = await client.from('mutes').upsert({ server_id: serverId, user_id: userId, muted_by: mutedBy, reason, expires_at: expiresAt }).select().single()
        if (error) throw error
        return data as Mute
      },

      async remove(serverId, userId) {
        const { error } = await client.from('mutes').delete().eq('server_id', serverId).eq('user_id', userId)
        if (error) throw error
      },

      async check(serverId, userId) {
        const now = new Date().toISOString()
        const { data, error } = await client
          .from('mutes')
          .select('*')
          .eq('server_id', serverId)
          .eq('user_id', userId)
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .single()
        if (error && error.code !== 'PGRST116') throw error
        return data ? (data as Mute) : null
      },
    },

    automod_rules: {
      async list(serverId) {
        const { data, error } = await client.from('automod_rules').select('*').eq('server_id', serverId).order('name')
        if (error) throw error
        return data as AutomodRule[]
      },

      async create(data) {
        const { data: rule, error } = await client.from('automod_rules').insert(data).select().single()
        if (error) throw error
        return rule as AutomodRule
      },

      async update(id, updates) {
        const { data, error } = await client.from('automod_rules').update(updates).eq('id', id).select().single()
        if (error) throw error
        return data as AutomodRule
      },

      async delete(id) {
        const { error } = await client.from('automod_rules').delete().eq('id', id)
        if (error) throw error
      },
    },

    threads: {
      async create(serverId, parentChannelId, parentMessageId, name) {
        const { data, error } = await client
          .from('channels')
          .insert({ server_id: serverId, name, description: '', type: 'text', position: 0, is_default: false, slowmode_seconds: 0, parent_message_id: parentMessageId, parent_channel_id: parentChannelId })
          .select()
          .single()
        if (error) throw error
        return data as Channel
      },

      async listByChannel(channelId) {
        const { data, error } = await client
          .from('channels')
          .select('*')
          .eq('parent_channel_id', channelId)
        if (error) throw error
        return data as Channel[]
      },
    },

    polls: {
      async create(channelId, question, optionTexts, createdBy) {
        const { data: poll, error: pe } = await client
          .from('polls')
          .insert({ channel_id: channelId, question, created_by: createdBy })
          .select()
          .single()
        if (pe) throw pe
        const optionRows = optionTexts.map((text, i) => ({ poll_id: (poll as Poll).id, text, position: i }))
        const { data: options, error: oe } = await client.from('poll_options').insert(optionRows).select()
        if (oe) throw oe
        return { ...(poll as Poll), options: options as PollOption[] }
      },

      async vote(pollId, optionId, userId) {
        const { data, error } = await client
          .from('poll_votes')
          .upsert({ poll_id: pollId, user_id: userId, option_id: optionId })
          .select()
          .single()
        if (error) throw error
        return data as PollVote
      },

      async getResults(pollId, userId) {
        const [{ data: poll, error: pe }, { data: options, error: oe }, { data: votes, error: ve }] = await Promise.all([
          client.from('polls').select('*').eq('id', pollId).single(),
          client.from('poll_options').select('*').eq('poll_id', pollId).order('position'),
          client.from('poll_votes').select('*').eq('poll_id', pollId),
        ])
        if (pe) throw pe
        if (oe) throw oe
        if (ve) throw ve
        const typedVotes = votes as PollVote[]
        const myVote = typedVotes.find((v) => v.user_id === userId)?.option_id ?? null
        return {
          poll: poll as Poll,
          options: (options as PollOption[]).map((o) => ({ ...o, vote_count: typedVotes.filter((v) => v.option_id === o.id).length })),
          myVote,
          total_votes: typedVotes.length,
        }
      },

      async close(pollId) {
        const { data, error } = await client
          .from('polls')
          .update({ closed_at: new Date().toISOString() })
          .eq('id', pollId)
          .select()
          .single()
        if (error) throw error
        return data as Poll
      },

      async listByChannel(channelId) {
        const { data: polls, error: pe } = await client
          .from('polls').select('*').eq('channel_id', channelId).order('created_at')
        if (pe) throw pe
        const pollIds = (polls as Poll[]).map((p) => p.id)
        if (pollIds.length === 0) return []
        const [{ data: options }, { data: votes }] = await Promise.all([
          client.from('poll_options').select('*').in('poll_id', pollIds).order('position'),
          client.from('poll_votes').select('*').in('poll_id', pollIds),
        ])
        return (polls as Poll[]).map((poll) => {
          const pollOptions = (options as PollOption[]).filter((o) => o.poll_id === poll.id)
          const pollVotes = (votes as PollVote[]).filter((v) => v.poll_id === poll.id)
          return {
            poll,
            options: pollOptions.map((o) => ({ ...o, vote_count: pollVotes.filter((v) => v.option_id === o.id).length })),
            myVote: null,
            total_votes: pollVotes.length,
          }
        })
      },
    },

    events: {
      async list(serverId) {
        const { data, error } = await client.from('events').select('*').eq('server_id', serverId).order('start_at')
        if (error) throw error
        return data as AppEvent[]
      },

      async create(data) {
        const { data: event, error } = await client.from('events').insert(data).select().single()
        if (error) throw error
        return event as AppEvent
      },

      async rsvp(eventId, userId, status) {
        const { data, error } = await client
          .from('event_rsvps')
          .upsert({ event_id: eventId, user_id: userId, status })
          .select()
          .single()
        if (error) throw error
        return data as EventRsvp
      },

      async getRsvps(eventId) {
        const { data, error } = await client.from('event_rsvps').select('*').eq('event_id', eventId)
        if (error) throw error
        return data as EventRsvp[]
      },
    },

    community_invites: {
      async create(data) {
        const token = crypto.randomUUID().replace(/-/g, '').substring(0, 16)
        const { data: row, error } = await client
          .from('community_invites')
          .insert({
            token,
            created_by: data.created_by,
            usage: data.usage ?? 'single_use',
            max_uses: data.max_uses ?? null,
            expires_at: data.expires_at ?? null,
          })
          .select()
          .single()
        if (error) throw error
        return row as CommunityInvite
      },

      async validate(token) {
        const { data, error } = await client
          .from('community_invites')
          .select('*')
          .eq('token', token)
          .single()
        if (error || !data) return null
        const inv = data as CommunityInvite
        if (inv.expires_at && new Date(inv.expires_at) < new Date()) return null
        if (inv.max_uses !== null && inv.use_count >= inv.max_uses) return null
        return inv
      },

      async use(token, _userId) {
        await client.rpc('use_community_invite', { p_token: token })
      },

      async list(createdBy) {
        const { data, error } = await client
          .from('community_invites')
          .select('*')
          .eq('created_by', createdBy)
          .order('created_at', { ascending: false })
        if (error) throw error
        return data as CommunityInvite[]
      },

      async revoke(id) {
        const { error } = await client.from('community_invites').delete().eq('id', id)
        if (error) throw error
      },
    },

    notification_preferences: {
      async get(userId, channelId) {
        const { data } = await client
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('channel_id', channelId)
          .maybeSingle()
        return (data as NotificationPreference | null) ?? null
      },

      async set(userId, channelId, level) {
        const { data, error } = await client
          .from('notification_preferences')
          .upsert({ user_id: userId, channel_id: channelId, level })
          .select()
          .single()
        if (error) throw error
        return data as NotificationPreference
      },

      async listForUser(userId) {
        const { data, error } = await client
          .from('notification_preferences')
          .select('*')
          .eq('user_id', userId)
        if (error) throw error
        return data as NotificationPreference[]
      },
    },

    dm_notification_preferences: {
      async get(userId: string, groupId: string) {
        const { data } = await client
          .from('dm_notification_preferences')
          .select('*')
          .eq('user_id', userId)
          .eq('group_id', groupId)
          .maybeSingle()
        return (data as DmNotificationPreference | null) ?? null
      },

      async set(userId: string, groupId: string, muted: boolean) {
        const { error } = await client
          .from('dm_notification_preferences')
          .upsert({ user_id: userId, group_id: groupId, muted })
        if (error) throw error
      },
    },
  }
}
