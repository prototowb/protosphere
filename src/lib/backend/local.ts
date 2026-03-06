import type { Profile, Server, Channel, ChannelCategory, Member, Message, Reaction, Ban, DirectMessageGroup, DirectMessageMember, DirectMessage, Role, UserRole, ChannelRoleOverride, CommunitySettings, AuditLog, Report, Mute, AutomodRule, Poll, PollOption, PollVote, AppEvent, EventRsvp, CommunityInvite, NotificationPreference } from '@/lib/types'
import type { AuthSession, Backend } from './types'
import { serializePermissions, PermissionPresets, Permission } from '@/lib/permissions'

const KEYS = {
  users: 'protosphere_users',
  session: 'protosphere_session',
  profiles: 'protosphere_profiles',
  servers: 'protosphere_servers',
  channels: 'protosphere_channels',
  members: 'protosphere_members',
  messages: 'protosphere_messages',
  reactions: 'protosphere_reactions',
  categories: 'protosphere_categories',
  bans: 'protosphere_bans',
  dm_groups: 'protosphere_dm_groups',
  dm_members: 'protosphere_dm_members',
  dm_messages: 'protosphere_dm_messages',
  roles: 'protosphere_roles',
  user_roles: 'protosphere_user_roles',
  channel_overrides: 'protosphere_channel_overrides',
  community: 'protosphere_community',
  audit_log: 'protosphere_audit_log',
  reports: 'protosphere_reports',
  mutes: 'protosphere_mutes',
  automod_rules: 'protosphere_automod_rules',
  polls: 'protosphere_polls',
  poll_options: 'protosphere_poll_options',
  poll_votes: 'protosphere_poll_votes',
  events: 'protosphere_events',
  event_rsvps: 'protosphere_event_rsvps',
  community_invites: 'protosphere_community_invites',
  notification_prefs: 'protosphere_notification_prefs',
} as const

interface StoredUser {
  id: string
  email: string
  password: string
  username: string
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value))
}

function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 10)
}

export function createLocalBackend(): Backend {
  let sessionCallback: ((session: AuthSession | null) => void) | null = null

  function setSession(session: AuthSession | null) {
    if (session) {
      writeJson(KEYS.session, session)
    } else {
      localStorage.removeItem(KEYS.session)
    }
    sessionCallback?.(session)
  }

  return {
    auth: {
      async login(email: string, password: string) {
        const users = readJson<StoredUser[]>(KEYS.users, [])
        const user = users.find((u) => u.email === email)
        if (!user || user.password !== password) {
          throw new Error('Invalid email or password')
        }
        setSession({
          user: { id: user.id, email: user.email },
          access_token: `local_${user.id}`,
        })
      },

      async register(email: string, password: string, username: string) {
        const users = readJson<StoredUser[]>(KEYS.users, [])

        if (users.some((u) => u.email === email)) {
          throw new Error('Email already registered')
        }
        if (users.some((u) => u.username === username)) {
          throw new Error('Username already taken')
        }

        const id = crypto.randomUUID()
        const newUser: StoredUser = { id, email, password, username }
        users.push(newUser)
        writeJson(KEYS.users, users)

        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const now = new Date().toISOString()
        profiles[id] = {
          id,
          username,
          display_name: username,
          avatar_url: null,
          status: 'online',
          status_text: '',
          bio: '',
          pronouns: '',
          website: '',
          location: '',
          display_banner_url: null,
          account_status: 'active',
          created_at: now,
          updated_at: now,
        }
        writeJson(KEYS.profiles, profiles)

        setSession({
          user: { id, email },
          access_token: `local_${id}`,
        })
        return { needsConfirmation: false }
      },

      async loginWithOAuth(_provider: string) {
        throw new Error('OAuth is not available in local mode. Set up Supabase to use OAuth.')
      },

      async logout() {
        setSession(null)
      },

      async resetPassword(_email: string) {
        // No-op in local mode
      },

      async updatePassword(_newPassword: string) {
        // No-op in local mode — passwords stored as plaintext for dev only
      },

      init(onSession) {
        sessionCallback = onSession
        const session = readJson<AuthSession | null>(KEYS.session, null)
        onSession(session)
      },
    },

    profiles: {
      async get(id: string) {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const profile = profiles[id]
        if (!profile) throw new Error('Profile not found')
        return profile
      },

      async update(id: string, updates: Partial<Profile>) {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const profile = profiles[id]
        if (!profile) throw new Error('Profile not found')

        const updated = { ...profile, ...updates, updated_at: new Date().toISOString() }
        profiles[id] = updated
        writeJson(KEYS.profiles, profiles)
        return updated
      },

      async uploadAvatar(_userId: string, file: File) {
        return new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = () => reject(new Error('Failed to read file'))
          reader.readAsDataURL(file)
        })
      },

      async listPending() {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        return Object.values(profiles).filter((p) => p.account_status === 'pending')
      },

      async approve(userId: string) {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const profile = profiles[userId]
        if (profile) {
          profile.account_status = 'active'
          writeJson(KEYS.profiles, profiles)
        }
      },

      async reject(userId: string) {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        delete profiles[userId]
        writeJson(KEYS.profiles, profiles)
      },

      async search(query: string, excludeUserId: string) {
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const q = query.toLowerCase()
        return Object.values(profiles).filter(
          (p) => p.id !== excludeUserId && (
            p.username.toLowerCase().includes(q) ||
            p.display_name.toLowerCase().includes(q)
          ),
        )
      },
    },

    servers: {
      async list(userId: string) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const members = readJson<Member[]>(KEYS.members, [])
        const memberServerIds = new Set(
          members.filter((m) => m.user_id === userId).map((m) => m.server_id),
        )
        return servers.filter((s) => memberServerIds.has(s.id))
      },

      async get(id: string) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.id === id)
        if (!server) throw new Error('Server not found')
        return server
      },

      async create(data, ownerId) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const members = readJson<Member[]>(KEYS.members, [])

        const server: Server = {
          id: crypto.randomUUID(),
          name: data.name,
          description: data.description ?? '',
          icon_url: data.icon_url ?? null,
          owner_id: ownerId,
          invite_code: generateInviteCode(),
          is_public: false,
          member_count: 1,
          visibility: data.visibility ?? 'public',
          space_type: data.space_type ?? 'general',
          sort_order: servers.length,
          created_at: new Date().toISOString(),
        }
        servers.push(server)
        writeJson(KEYS.servers, servers)

        // Auto-join owner
        const member: Member = {
          server_id: server.id,
          user_id: ownerId,
          role: 'owner',
          nickname: null,
          joined_at: new Date().toISOString(),
        }
        members.push(member)
        writeJson(KEYS.members, members)

        // Auto-create #general channel
        const channels = readJson<Channel[]>(KEYS.channels, [])
        channels.push({
          id: crypto.randomUUID(),
          server_id: server.id,
          name: 'general',
          description: 'General discussion',
          type: 'text',
          position: 0,
          is_default: true,
          slowmode_seconds: 0,
          category_id: null,
          parent_message_id: null,
          parent_channel_id: null,
          created_at: new Date().toISOString(),
        })
        writeJson(KEYS.channels, channels)

        // Seed system roles
        const now2 = new Date().toISOString()
        const ownerRoleId = crypto.randomUUID()
        const newRoles: Role[] = [
          { id: ownerRoleId, server_id: server.id, name: 'Owner', color: '#f97316', icon: null, position: 0, permissions: serializePermissions(Permission.ADMINISTRATOR), is_default: false, is_system: true, created_at: now2 },
          { id: crypto.randomUUID(), server_id: server.id, name: 'Admin', color: '#3b82f6', icon: null, position: 10, permissions: serializePermissions(PermissionPresets.ADMIN), is_default: false, is_system: true, created_at: now2 },
          { id: crypto.randomUUID(), server_id: server.id, name: 'Moderator', color: '#a855f7', icon: null, position: 20, permissions: serializePermissions(PermissionPresets.MODERATOR), is_default: false, is_system: true, created_at: now2 },
          { id: crypto.randomUUID(), server_id: server.id, name: 'Member', color: null, icon: null, position: 30, permissions: serializePermissions(PermissionPresets.MEMBER), is_default: true, is_system: true, created_at: now2 },
        ]
        const existingRoles = readJson<Role[]>(KEYS.roles, [])
        writeJson(KEYS.roles, [...existingRoles, ...newRoles])

        // Assign Owner role to the creator
        const existingUserRoles = readJson<UserRole[]>(KEYS.user_roles, [])
        existingUserRoles.push({ user_id: ownerId, role_id: ownerRoleId, assigned_at: now2 })
        writeJson(KEYS.user_roles, existingUserRoles)

        return server
      },

      async update(id, updates) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.id === id)
        if (!server) throw new Error('Server not found')

        Object.assign(server, updates)
        writeJson(KEYS.servers, servers)
        return server
      },

      async delete(id) {
        let servers = readJson<Server[]>(KEYS.servers, [])
        let members = readJson<Member[]>(KEYS.members, [])
        let channels = readJson<Channel[]>(KEYS.channels, [])

        servers = servers.filter((s) => s.id !== id)
        members = members.filter((m) => m.server_id !== id)
        channels = channels.filter((c) => c.server_id !== id)

        writeJson(KEYS.servers, servers)
        writeJson(KEYS.members, members)
        writeJson(KEYS.channels, channels)
      },

      async getByInviteCode(code) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.invite_code === code)
        if (!server) throw new Error('Invalid invite code')
        return server
      },

      async regenerateInviteCode(id) {
        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.id === id)
        if (!server) throw new Error('Server not found')

        const code = generateInviteCode()
        server.invite_code = code
        writeJson(KEYS.servers, servers)
        return code
      },
    },

    channels: {
      async list(serverId: string) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        return channels
          .filter((c) => c.server_id === serverId && c.parent_message_id === null)
          .sort((a, b) => a.position - b.position)
      },

      async get(id: string) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        const channel = channels.find((c) => c.id === id)
        if (!channel) throw new Error('Channel not found')
        return channel
      },

      async create(data) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        const existing = channels.filter((c) => c.server_id === data.server_id)

        const channel: Channel = {
          id: crypto.randomUUID(),
          server_id: data.server_id,
          name: data.name.toLowerCase().replace(/\s+/g, '-'),
          description: data.description ?? '',
          type: 'text',
          position: existing.length,
          is_default: data.is_default ?? false,
          slowmode_seconds: 0,
          category_id: data.category_id ?? null,
          parent_message_id: null,
          parent_channel_id: null,
          created_at: new Date().toISOString(),
        }
        channels.push(channel)
        writeJson(KEYS.channels, channels)
        return channel
      },

      async update(id, updates) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        const channel = channels.find((c) => c.id === id)
        if (!channel) throw new Error('Channel not found')

        Object.assign(channel, updates)
        writeJson(KEYS.channels, channels)
        return channel
      },

      async delete(id) {
        let channels = readJson<Channel[]>(KEYS.channels, [])
        channels = channels.filter((c) => c.id !== id)
        writeJson(KEYS.channels, channels)
      },
    },

    members: {
      async list(serverId: string) {
        const members = readJson<Member[]>(KEYS.members, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const result: (Member & { profile: Profile })[] = []
        for (const m of members) {
          if (m.server_id !== serverId) continue
          const profile = profiles[m.user_id]
          if (profile) result.push({ ...m, profile })
        }
        return result
      },

      async join(serverId: string, userId: string) {
        const bans = readJson<Ban[]>(KEYS.bans, [])
        if (bans.some((b) => b.server_id === serverId && b.user_id === userId)) {
          throw new Error('You are banned from this server')
        }
        const members = readJson<Member[]>(KEYS.members, [])
        const existing = members.find(
          (m) => m.server_id === serverId && m.user_id === userId,
        )
        if (existing) return existing

        const member: Member = {
          server_id: serverId,
          user_id: userId,
          role: 'member',
          nickname: null,
          joined_at: new Date().toISOString(),
        }
        members.push(member)
        writeJson(KEYS.members, members)

        // Increment member count
        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.id === serverId)
        if (server) {
          server.member_count += 1
          writeJson(KEYS.servers, servers)
        }

        // Assign default role
        const allRoles = readJson<Role[]>(KEYS.roles, [])
        const defaultRole = allRoles.find((r) => r.server_id === serverId && r.is_default)
        if (defaultRole) {
          const userRoles = readJson<UserRole[]>(KEYS.user_roles, [])
          if (!userRoles.some((ur) => ur.user_id === userId && ur.role_id === defaultRole.id)) {
            userRoles.push({ user_id: userId, role_id: defaultRole.id, assigned_at: new Date().toISOString() })
            writeJson(KEYS.user_roles, userRoles)
          }
        }

        return member
      },

      async leave(serverId: string, userId: string) {
        let members = readJson<Member[]>(KEYS.members, [])
        members = members.filter(
          (m) => !(m.server_id === serverId && m.user_id === userId),
        )
        writeJson(KEYS.members, members)

        const servers = readJson<Server[]>(KEYS.servers, [])
        const server = servers.find((s) => s.id === serverId)
        if (server) {
          server.member_count = Math.max(0, server.member_count - 1)
          writeJson(KEYS.servers, servers)
        }
      },

      async updateRole(serverId: string, userId: string, role) {
        const members = readJson<Member[]>(KEYS.members, [])
        const member = members.find(
          (m) => m.server_id === serverId && m.user_id === userId,
        )
        if (!member) throw new Error('Member not found')

        const updated: Member = { ...member, role }
        Object.assign(member, updated)
        writeJson(KEYS.members, members)
        return updated
      },
    },

    messages: {
      async list(channelId: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const result: (Message & { profile: Profile })[] = []
        for (const m of messages) {
          if (m.channel_id !== channelId) continue
          const profile = profiles[m.author_id]
          if (profile) result.push({ ...m, profile })
        }
        return result
      },

      async send(channelId: string, authorId: string, content: string, replyToId?: string | null) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const profile = profiles[authorId]
        if (!profile) throw new Error('Profile not found')

        const message: Message = {
          id: crypto.randomUUID(),
          channel_id: channelId,
          author_id: authorId,
          content,
          edited_at: null,
          reply_to_id: replyToId ?? null,
          attachments: [],
          is_pinned: false,
          created_at: new Date().toISOString(),
        }
        messages.push(message)
        writeJson(KEYS.messages, messages)
        return { ...message, profile }
      },

      async edit(id: string, content: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const message = messages.find((m) => m.id === id)
        if (!message) throw new Error('Message not found')
        message.content = content
        message.edited_at = new Date().toISOString()
        writeJson(KEYS.messages, messages)
        return message
      },

      async delete(id: string) {
        let messages = readJson<Message[]>(KEYS.messages, [])
        messages = messages.filter((m) => m.id !== id)
        writeJson(KEYS.messages, messages)
      },

      async pin(id: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const message = messages.find((m) => m.id === id)
        if (!message) throw new Error('Message not found')
        message.is_pinned = true
        writeJson(KEYS.messages, messages)
        return message
      },

      async unpin(id: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const message = messages.find((m) => m.id === id)
        if (!message) throw new Error('Message not found')
        message.is_pinned = false
        writeJson(KEYS.messages, messages)
        return message
      },

      async listPinned(channelId: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const result: (Message & { profile: Profile })[] = []
        for (const m of messages) {
          if (m.channel_id !== channelId || !m.is_pinned) continue
          const profile = profiles[m.author_id]
          if (profile) result.push({ ...m, profile })
        }
        return result
      },
    },

    categories: {
      async list(serverId: string) {
        const categories = readJson<ChannelCategory[]>(KEYS.categories, [])
        return categories
          .filter((c) => c.server_id === serverId)
          .sort((a, b) => a.position - b.position)
      },

      async create(data) {
        const categories = readJson<ChannelCategory[]>(KEYS.categories, [])
        const existing = categories.filter((c) => c.server_id === data.server_id)
        const category: ChannelCategory = {
          id: crypto.randomUUID(),
          server_id: data.server_id,
          name: data.name.toUpperCase(),
          position: existing.length,
          created_at: new Date().toISOString(),
        }
        categories.push(category)
        writeJson(KEYS.categories, categories)
        return category
      },

      async update(id, updates) {
        const categories = readJson<ChannelCategory[]>(KEYS.categories, [])
        const category = categories.find((c) => c.id === id)
        if (!category) throw new Error('Category not found')
        Object.assign(category, updates)
        writeJson(KEYS.categories, categories)
        return category
      },

      async delete(id) {
        // Unassign channels in this category
        const channels = readJson<Channel[]>(KEYS.channels, [])
        for (const ch of channels) {
          if (ch.category_id === id) ch.category_id = null
        }
        writeJson(KEYS.channels, channels)

        let categories = readJson<ChannelCategory[]>(KEYS.categories, [])
        categories = categories.filter((c) => c.id !== id)
        writeJson(KEYS.categories, categories)
      },
    },

    reactions: {
      async listByChannel(channelId: string) {
        const messages = readJson<Message[]>(KEYS.messages, [])
        const messageIds = new Set(
          messages.filter((m) => m.channel_id === channelId).map((m) => m.id),
        )
        const reactions = readJson<Reaction[]>(KEYS.reactions, [])
        return reactions.filter((r) => messageIds.has(r.message_id))
      },

      async add(messageId: string, userId: string, emoji: string) {
        const reactions = readJson<Reaction[]>(KEYS.reactions, [])
        const existing = reactions.find(
          (r) => r.message_id === messageId && r.user_id === userId && r.emoji === emoji,
        )
        if (existing) return existing
        const reaction: Reaction = {
          message_id: messageId,
          user_id: userId,
          emoji,
          created_at: new Date().toISOString(),
        }
        reactions.push(reaction)
        writeJson(KEYS.reactions, reactions)
        return reaction
      },

      async remove(messageId: string, userId: string, emoji: string) {
        let reactions = readJson<Reaction[]>(KEYS.reactions, [])
        reactions = reactions.filter(
          (r) => !(r.message_id === messageId && r.user_id === userId && r.emoji === emoji),
        )
        writeJson(KEYS.reactions, reactions)
      },
    },

    bans: {
      async list(serverId: string) {
        const bans = readJson<Ban[]>(KEYS.bans, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const result: (Ban & { profile: Profile })[] = []
        for (const b of bans) {
          if (b.server_id !== serverId) continue
          const profile = profiles[b.user_id]
          if (profile) result.push({ ...b, profile })
        }
        return result
      },

      async add(serverId: string, userId: string, bannedBy: string, reason = '') {
        // Kick from server first
        let members = readJson<Member[]>(KEYS.members, [])
        members = members.filter((m) => !(m.server_id === serverId && m.user_id === userId))
        writeJson(KEYS.members, members)

        const bans = readJson<Ban[]>(KEYS.bans, [])
        const existing = bans.find((b) => b.server_id === serverId && b.user_id === userId)
        if (existing) return existing

        const ban: Ban = {
          server_id: serverId,
          user_id: userId,
          banned_by: bannedBy,
          reason,
          created_at: new Date().toISOString(),
        }
        bans.push(ban)
        writeJson(KEYS.bans, bans)
        return ban
      },

      async remove(serverId: string, userId: string) {
        let bans = readJson<Ban[]>(KEYS.bans, [])
        bans = bans.filter((b) => !(b.server_id === serverId && b.user_id === userId))
        writeJson(KEYS.bans, bans)
      },

      async check(serverId: string, userId: string) {
        const bans = readJson<Ban[]>(KEYS.bans, [])
        return bans.some((b) => b.server_id === serverId && b.user_id === userId)
      },
    },

    dm: {
      async listGroups(userId: string) {
        const groups = readJson<DirectMessageGroup[]>(KEYS.dm_groups, [])
        const dmMembers = readJson<DirectMessageMember[]>(KEYS.dm_members, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const dmMessages = readJson<DirectMessage[]>(KEYS.dm_messages, [])

        const myGroupIds = new Set(
          dmMembers.filter((m) => m.user_id === userId).map((m) => m.dm_group_id),
        )

        const result = []
        for (const group of groups) {
          if (!myGroupIds.has(group.id)) continue
          const otherMember = dmMembers.find(
            (m) => m.dm_group_id === group.id && m.user_id !== userId,
          )
          if (!otherMember) continue
          const otherUser = profiles[otherMember.user_id]
          if (!otherUser) continue

          const groupMessages = dmMessages
            .filter((m) => m.dm_group_id === group.id)
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
          const lastMessage = groupMessages[groupMessages.length - 1] ?? null

          result.push({ ...group, otherUser, lastMessage })
        }

        return result.sort((a, b) => {
          const aTime = a.lastMessage?.created_at ?? a.created_at
          const bTime = b.lastMessage?.created_at ?? b.created_at
          return bTime.localeCompare(aTime)
        })
      },

      async getOrCreate(userId: string, otherUserId: string) {
        const groups = readJson<DirectMessageGroup[]>(KEYS.dm_groups, [])
        const dmMembers = readJson<DirectMessageMember[]>(KEYS.dm_members, [])

        // Find existing 1:1 group between the two users
        const myGroupIds = new Set(
          dmMembers.filter((m) => m.user_id === userId).map((m) => m.dm_group_id),
        )
        const otherGroupIds = new Set(
          dmMembers.filter((m) => m.user_id === otherUserId).map((m) => m.dm_group_id),
        )
        for (const id of myGroupIds) {
          const group = groups.find((g) => g.id === id && !g.is_group)
          if (group && otherGroupIds.has(id)) return group
        }

        // Create new 1:1 group
        const now = new Date().toISOString()
        const group: DirectMessageGroup = {
          id: crypto.randomUUID(),
          name: null,
          is_group: false,
          created_at: now,
        }
        groups.push(group)
        writeJson(KEYS.dm_groups, groups)

        dmMembers.push(
          { dm_group_id: group.id, user_id: userId, joined_at: now },
          { dm_group_id: group.id, user_id: otherUserId, joined_at: now },
        )
        writeJson(KEYS.dm_members, dmMembers)

        return group
      },

      async listMessages(dmGroupId: string) {
        const messages = readJson<DirectMessage[]>(KEYS.dm_messages, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const result: (DirectMessage & { profile: Profile })[] = []
        for (const m of messages) {
          if (m.dm_group_id !== dmGroupId) continue
          const profile = profiles[m.author_id]
          if (profile) result.push({ ...m, profile })
        }
        return result.sort((a, b) => a.created_at.localeCompare(b.created_at))
      },

      async sendMessage(dmGroupId: string, authorId: string, content: string, replyToId?: string | null) {
        const messages = readJson<DirectMessage[]>(KEYS.dm_messages, [])
        const profiles = readJson<Record<string, Profile>>(KEYS.profiles, {})
        const profile = profiles[authorId]
        if (!profile) throw new Error('Profile not found')

        const message: DirectMessage = {
          id: crypto.randomUUID(),
          dm_group_id: dmGroupId,
          author_id: authorId,
          content,
          edited_at: null,
          reply_to_id: replyToId ?? null,
          attachments: [],
          created_at: new Date().toISOString(),
        }
        messages.push(message)
        writeJson(KEYS.dm_messages, messages)
        return { ...message, profile }
      },

      async editMessage(id: string, content: string) {
        const messages = readJson<DirectMessage[]>(KEYS.dm_messages, [])
        const message = messages.find((m) => m.id === id)
        if (!message) throw new Error('Message not found')
        message.content = content
        message.edited_at = new Date().toISOString()
        writeJson(KEYS.dm_messages, messages)
        return message
      },

      async deleteMessage(id: string) {
        let messages = readJson<DirectMessage[]>(KEYS.dm_messages, [])
        messages = messages.filter((m) => m.id !== id)
        writeJson(KEYS.dm_messages, messages)
      },
    },

    roles: {
      async list(serverId: string) {
        const roles = readJson<Role[]>(KEYS.roles, [])
        return roles.filter((r) => r.server_id === serverId).sort((a, b) => a.position - b.position)
      },

      async create(data) {
        const roles = readJson<Role[]>(KEYS.roles, [])
        const serverRoles = roles.filter((r) => r.server_id === data.server_id)
        const role: Role = {
          id: crypto.randomUUID(),
          server_id: data.server_id,
          name: data.name,
          color: data.color ?? null,
          icon: data.icon ?? null,
          position: data.position ?? serverRoles.length * 10,
          permissions: data.permissions ?? '0',
          is_default: data.is_default ?? false,
          is_system: false,
          created_at: new Date().toISOString(),
        }
        roles.push(role)
        writeJson(KEYS.roles, roles)
        return role
      },

      async update(id, updates) {
        const roles = readJson<Role[]>(KEYS.roles, [])
        const role = roles.find((r) => r.id === id)
        if (!role) throw new Error('Role not found')
        Object.assign(role, updates)
        writeJson(KEYS.roles, roles)
        return role
      },

      async delete(id) {
        // Remove user_roles assignments first
        let userRoles = readJson<UserRole[]>(KEYS.user_roles, [])
        userRoles = userRoles.filter((ur) => ur.role_id !== id)
        writeJson(KEYS.user_roles, userRoles)

        let channelOverrides = readJson<ChannelRoleOverride[]>(KEYS.channel_overrides, [])
        channelOverrides = channelOverrides.filter((co) => co.role_id !== id)
        writeJson(KEYS.channel_overrides, channelOverrides)

        let roles = readJson<Role[]>(KEYS.roles, [])
        roles = roles.filter((r) => r.id !== id)
        writeJson(KEYS.roles, roles)
      },

      async listUserRoles(serverId: string, userId: string) {
        const allRoles = readJson<Role[]>(KEYS.roles, [])
        const userRoles = readJson<UserRole[]>(KEYS.user_roles, [])
        const userRoleIds = new Set(userRoles.filter((ur) => ur.user_id === userId).map((ur) => ur.role_id))
        return allRoles.filter((r) => r.server_id === serverId && userRoleIds.has(r.id))
      },

      async assignRole(userId: string, roleId: string) {
        const userRoles = readJson<UserRole[]>(KEYS.user_roles, [])
        const existing = userRoles.find((ur) => ur.user_id === userId && ur.role_id === roleId)
        if (existing) return existing
        const assignment: UserRole = { user_id: userId, role_id: roleId, assigned_at: new Date().toISOString() }
        userRoles.push(assignment)
        writeJson(KEYS.user_roles, userRoles)
        return assignment
      },

      async removeRole(userId: string, roleId: string) {
        let userRoles = readJson<UserRole[]>(KEYS.user_roles, [])
        userRoles = userRoles.filter((ur) => !(ur.user_id === userId && ur.role_id === roleId))
        writeJson(KEYS.user_roles, userRoles)
      },

      async listChannelOverrides(channelId: string) {
        const overrides = readJson<ChannelRoleOverride[]>(KEYS.channel_overrides, [])
        return overrides.filter((o) => o.channel_id === channelId)
      },

      async setChannelOverride(channelId: string, roleId: string, allow: string, deny: string) {
        const overrides = readJson<ChannelRoleOverride[]>(KEYS.channel_overrides, [])
        const existing = overrides.find((o) => o.channel_id === channelId && o.role_id === roleId)
        if (existing) {
          existing.allow = allow
          existing.deny = deny
          writeJson(KEYS.channel_overrides, overrides)
          return existing
        }
        const override: ChannelRoleOverride = { channel_id: channelId, role_id: roleId, allow, deny }
        overrides.push(override)
        writeJson(KEYS.channel_overrides, overrides)
        return override
      },

      async deleteChannelOverride(channelId: string, roleId: string) {
        let overrides = readJson<ChannelRoleOverride[]>(KEYS.channel_overrides, [])
        overrides = overrides.filter((o) => !(o.channel_id === channelId && o.role_id === roleId))
        writeJson(KEYS.channel_overrides, overrides)
      },
    },

    community: {
      async get() {
        const stored = readJson<CommunitySettings | null>(KEYS.community, null)
        if (stored) return stored
        const defaults: CommunitySettings = {
          id: 'local',
          name: 'My Community',
          description: '',
          logo_url: null,
          banner_url: null,
          registration_mode: 'open',
          rules: '',
          welcome_message: '',
          setup_complete: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        writeJson(KEYS.community, defaults)
        return defaults
      },

      async update(updates) {
        const stored = readJson<CommunitySettings | null>(KEYS.community, null)
        const now = new Date().toISOString()
        const current: CommunitySettings = stored ?? {
          id: 'local', name: 'My Community', description: '', logo_url: null,
          banner_url: null, registration_mode: 'open', rules: '', welcome_message: '',
          setup_complete: false, created_at: now, updated_at: now,
        }
        const updated: CommunitySettings = { ...current, ...updates, updated_at: now }
        writeJson(KEYS.community, updated)
        return updated
      },
    },

    audit_log: {
      async log(serverId, actorId, action, targetType, targetId, details = {}) {
        const logs = readJson<AuditLog[]>(KEYS.audit_log, [])
        const entry: AuditLog = {
          id: crypto.randomUUID(),
          server_id: serverId,
          actor_id: actorId,
          action,
          target_type: targetType,
          target_id: targetId,
          details,
          created_at: new Date().toISOString(),
        }
        logs.push(entry)
        writeJson(KEYS.audit_log, logs)
        return entry
      },

      async list(serverId, offset = 0, limit = 50) {
        const logs = readJson<AuditLog[]>(KEYS.audit_log, [])
        let filtered = logs
        if (serverId) filtered = filtered.filter((l) => l.server_id === serverId)
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(offset, offset + limit)
      },
    },

    reports: {
      async list(serverId, status, offset = 0, limit = 50) {
        const reports = readJson<Report[]>(KEYS.reports, [])
        const profiles = readJson<Profile[]>(KEYS.profiles, [])
        let filtered = reports
        if (serverId) filtered = filtered.filter((r) => r.server_id === serverId)
        if (status) filtered = filtered.filter((r) => r.status === status)
        return filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(offset, offset + limit).map((r) => ({
          ...r,
          reporter_profile: profiles.find((p) => p.id === r.reporter_id) as Profile,
          reviewer_profile: r.reviewed_by ? (profiles.find((p) => p.id === r.reviewed_by) ?? null) : null,
        }))
      },

      async create(data) {
        const reports = readJson<Report[]>(KEYS.reports, [])
        const report: Report = {
          id: crypto.randomUUID(),
          reporter_id: data.reporter_id,
          reported_type: data.reported_type,
          reported_id: data.reported_id,
          server_id: data.server_id ?? null,
          category: data.category,
          description: data.description,
          status: 'pending',
          reviewed_by: null,
          resolution: '',
          created_at: new Date().toISOString(),
          resolved_at: null,
        }
        reports.push(report)
        writeJson(KEYS.reports, reports)
        return report
      },

      async update(id, updates) {
        const reports = readJson<Report[]>(KEYS.reports, [])
        const idx = reports.findIndex((r) => r.id === id)
        if (idx === -1) throw new Error('Report not found')
        const current = reports[idx]!  // Non-null assertion: idx is definitely in range
        const updated: Report = {
          id: current.id,
          reporter_id: current.reporter_id,
          reported_type: current.reported_type,
          reported_id: current.reported_id,
          server_id: current.server_id,
          category: current.category,
          description: current.description,
          status: (updates.status ?? current.status) as 'pending' | 'reviewing' | 'resolved' | 'dismissed',
          reviewed_by: updates.reviewed_by !== undefined ? updates.reviewed_by : current.reviewed_by,
          resolution: updates.resolution ?? current.resolution,
          created_at: current.created_at,
          resolved_at: updates.status === 'resolved' || updates.status === 'dismissed' ? new Date().toISOString() : current.resolved_at,
        }
        reports[idx] = updated
        writeJson(KEYS.reports, reports)
        return updated
      },
    },

    mutes: {
      async list(serverId) {
        const mutes = readJson<Mute[]>(KEYS.mutes, [])
        const profiles = readJson<Profile[]>(KEYS.profiles, [])
        return mutes
          .filter((m) => m.server_id === serverId && (!m.expires_at || new Date(m.expires_at) > new Date()))
          .map((m) => ({
            ...m,
            user_profile: profiles.find((p) => p.id === m.user_id) as Profile,
            muted_by_profile: profiles.find((p) => p.id === m.muted_by) as Profile,
          }))
      },

      async add(serverId, userId, mutedBy, reason = '', expiresAt = null) {
        const mutes = readJson<Mute[]>(KEYS.mutes, [])
        const mute: Mute = {
          server_id: serverId,
          user_id: userId,
          muted_by: mutedBy,
          reason,
          expires_at: expiresAt,
          created_at: new Date().toISOString(),
        }
        const idx = mutes.findIndex((m) => m.server_id === serverId && m.user_id === userId)
        if (idx !== -1) mutes[idx] = mute
        else mutes.push(mute)
        writeJson(KEYS.mutes, mutes)
        return mute
      },

      async remove(serverId, userId) {
        const mutes = readJson<Mute[]>(KEYS.mutes, [])
        const filtered = mutes.filter((m) => !(m.server_id === serverId && m.user_id === userId))
        writeJson(KEYS.mutes, filtered)
      },

      async check(serverId, userId) {
        const mutes = readJson<Mute[]>(KEYS.mutes, [])
        const mute = mutes.find((m) => m.server_id === serverId && m.user_id === userId && (!m.expires_at || new Date(m.expires_at) > new Date()))
        return mute ?? null
      },
    },

    automod_rules: {
      async list(serverId) {
        const rules = readJson<AutomodRule[]>(KEYS.automod_rules, [])
        return rules.filter((r) => r.server_id === serverId).sort((a, b) => a.name.localeCompare(b.name))
      },

      async create(data) {
        const rules = readJson<AutomodRule[]>(KEYS.automod_rules, [])
        const rule: AutomodRule = {
          id: crypto.randomUUID(),
          server_id: data.server_id,
          name: data.name,
          rule_type: data.rule_type,
          config: data.config ?? {},
          action: data.action ?? 'flag',
          enabled: data.enabled ?? true,
          created_at: new Date().toISOString(),
        }
        rules.push(rule)
        writeJson(KEYS.automod_rules, rules)
        return rule
      },

      async update(id, updates) {
        const rules = readJson<AutomodRule[]>(KEYS.automod_rules, [])
        const idx = rules.findIndex((r) => r.id === id)
        if (idx === -1) throw new Error('Rule not found')
        const current = rules[idx]!  // Non-null assertion: idx is definitely in range
        const updated: AutomodRule = {
          id: current.id,
          server_id: current.server_id,
          name: updates.name ?? current.name,
          rule_type: updates.rule_type ?? current.rule_type,
          config: updates.config ?? current.config,
          action: updates.action ?? current.action,
          enabled: updates.enabled ?? current.enabled,
          created_at: current.created_at,
        }
        rules[idx] = updated
        writeJson(KEYS.automod_rules, rules)
        return updated
      },

      async delete(id) {
        const rules = readJson<AutomodRule[]>(KEYS.automod_rules, [])
        const filtered = rules.filter((r) => r.id !== id)
        writeJson(KEYS.automod_rules, filtered)
      },
    },

    threads: {
      async create(serverId, parentChannelId, parentMessageId, name) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        const thread: Channel = {
          id: crypto.randomUUID(),
          server_id: serverId,
          name,
          description: '',
          type: 'text',
          position: 0,
          is_default: false,
          slowmode_seconds: 0,
          category_id: null,
          parent_message_id: parentMessageId,
          parent_channel_id: parentChannelId,
          created_at: new Date().toISOString(),
        }
        channels.push(thread)
        writeJson(KEYS.channels, channels)
        return thread
      },

      async listByChannel(channelId) {
        const channels = readJson<Channel[]>(KEYS.channels, [])
        return channels.filter((c) => c.parent_channel_id === channelId)
      },
    },

    polls: {
      async create(channelId, question, optionTexts, createdBy) {
        const polls = readJson<Poll[]>(KEYS.polls, [])
        const poll: Poll = {
          id: crypto.randomUUID(),
          channel_id: channelId,
          question,
          created_by: createdBy,
          closed_at: null,
          created_at: new Date().toISOString(),
        }
        polls.push(poll)
        writeJson(KEYS.polls, polls)

        const allOptions = readJson<PollOption[]>(KEYS.poll_options, [])
        const options: PollOption[] = optionTexts.map((text, i) => ({
          id: crypto.randomUUID(),
          poll_id: poll.id,
          text,
          position: i,
        }))
        allOptions.push(...options)
        writeJson(KEYS.poll_options, allOptions)
        return { ...poll, options }
      },

      async vote(pollId, optionId, userId) {
        const votes = readJson<PollVote[]>(KEYS.poll_votes, [])
        const existing = votes.findIndex((v) => v.poll_id === pollId && v.user_id === userId)
        const vote: PollVote = {
          poll_id: pollId,
          user_id: userId,
          option_id: optionId,
          created_at: new Date().toISOString(),
        }
        if (existing !== -1) votes[existing] = vote
        else votes.push(vote)
        writeJson(KEYS.poll_votes, votes)
        return vote
      },

      async getResults(pollId, userId) {
        const polls = readJson<Poll[]>(KEYS.polls, [])
        const poll = polls.find((p) => p.id === pollId)
        if (!poll) throw new Error('Poll not found')
        const allOptions = readJson<PollOption[]>(KEYS.poll_options, [])
        const allVotes = readJson<PollVote[]>(KEYS.poll_votes, [])
        const options = allOptions.filter((o) => o.poll_id === pollId).sort((a, b) => a.position - b.position)
        const votes = allVotes.filter((v) => v.poll_id === pollId)
        const myVote = votes.find((v) => v.user_id === userId)?.option_id ?? null
        return {
          poll,
          options: options.map((o) => ({ ...o, vote_count: votes.filter((v) => v.option_id === o.id).length })),
          myVote,
          total_votes: votes.length,
        }
      },

      async close(pollId) {
        const polls = readJson<Poll[]>(KEYS.polls, [])
        const poll = polls.find((p) => p.id === pollId)
        if (!poll) throw new Error('Poll not found')
        poll.closed_at = new Date().toISOString()
        writeJson(KEYS.polls, polls)
        return poll
      },

      async listByChannel(channelId) {
        const polls = readJson<Poll[]>(KEYS.polls, [])
        const allOptions = readJson<PollOption[]>(KEYS.poll_options, [])
        const allVotes = readJson<PollVote[]>(KEYS.poll_votes, [])
        return polls
          .filter((p) => p.channel_id === channelId)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .map((poll) => {
            const options = allOptions.filter((o) => o.poll_id === poll.id).sort((a, b) => a.position - b.position)
            const votes = allVotes.filter((v) => v.poll_id === poll.id)
            return {
              poll,
              options: options.map((o) => ({ ...o, vote_count: votes.filter((v) => v.option_id === o.id).length })),
              myVote: null,
              total_votes: votes.length,
            }
          })
      },
    },

    events: {
      async list(serverId) {
        const events = readJson<AppEvent[]>(KEYS.events, [])
        return events.filter((e) => e.server_id === serverId).sort((a, b) => a.start_at.localeCompare(b.start_at))
      },

      async create(data) {
        const events = readJson<AppEvent[]>(KEYS.events, [])
        const event: AppEvent = {
          id: crypto.randomUUID(),
          server_id: data.server_id,
          channel_id: data.channel_id ?? null,
          title: data.title,
          description: data.description ?? '',
          start_at: data.start_at,
          end_at: data.end_at ?? null,
          created_by: data.created_by,
          created_at: new Date().toISOString(),
        }
        events.push(event)
        writeJson(KEYS.events, events)
        return event
      },

      async rsvp(eventId, userId, status) {
        const rsvps = readJson<EventRsvp[]>(KEYS.event_rsvps, [])
        const existing = rsvps.findIndex((r) => r.event_id === eventId && r.user_id === userId)
        const rsvp: EventRsvp = { event_id: eventId, user_id: userId, status, created_at: new Date().toISOString() }
        if (existing !== -1) rsvps[existing] = rsvp
        else rsvps.push(rsvp)
        writeJson(KEYS.event_rsvps, rsvps)
        return rsvp
      },

      async getRsvps(eventId) {
        const rsvps = readJson<EventRsvp[]>(KEYS.event_rsvps, [])
        return rsvps.filter((r) => r.event_id === eventId)
      },
    },

    community_invites: {
      async create(data) {
        const invites = readJson<CommunityInvite[]>(KEYS.community_invites, [])
        const invite: CommunityInvite = {
          id: crypto.randomUUID(),
          token: Math.random().toString(36).substring(2, 18),
          created_by: data.created_by,
          usage: data.usage ?? 'single_use',
          max_uses: data.max_uses ?? null,
          use_count: 0,
          expires_at: data.expires_at ?? null,
          created_at: new Date().toISOString(),
        }
        invites.push(invite)
        writeJson(KEYS.community_invites, invites)
        return invite
      },

      async validate(token) {
        const invites = readJson<CommunityInvite[]>(KEYS.community_invites, [])
        const invite = invites.find((i) => i.token === token)
        if (!invite) return null
        if (invite.expires_at && new Date(invite.expires_at) < new Date()) return null
        if (invite.max_uses !== null && invite.use_count >= invite.max_uses) return null
        return invite
      },

      async use(token, _userId) {
        const invites = readJson<CommunityInvite[]>(KEYS.community_invites, [])
        const invite = invites.find((i) => i.token === token)
        if (invite) {
          invite.use_count++
          writeJson(KEYS.community_invites, invites)
        }
      },

      async list(createdBy) {
        const invites = readJson<CommunityInvite[]>(KEYS.community_invites, [])
        return invites.filter((i) => i.created_by === createdBy)
      },

      async revoke(id) {
        const invites = readJson<CommunityInvite[]>(KEYS.community_invites, [])
        writeJson(KEYS.community_invites, invites.filter((i) => i.id !== id))
      },
    },

    notification_preferences: {
      async get(userId, channelId) {
        const prefs = readJson<NotificationPreference[]>(KEYS.notification_prefs, [])
        return prefs.find((p) => p.user_id === userId && p.channel_id === channelId) ?? null
      },

      async set(userId, channelId, level) {
        const prefs = readJson<NotificationPreference[]>(KEYS.notification_prefs, [])
        const existing = prefs.findIndex((p) => p.user_id === userId && p.channel_id === channelId)
        const pref: NotificationPreference = { user_id: userId, channel_id: channelId, level }
        if (existing !== -1) prefs[existing] = pref
        else prefs.push(pref)
        writeJson(KEYS.notification_prefs, prefs)
        return pref
      },

      async listForUser(userId) {
        const prefs = readJson<NotificationPreference[]>(KEYS.notification_prefs, [])
        return prefs.filter((p) => p.user_id === userId)
      },
    },
  }
}
