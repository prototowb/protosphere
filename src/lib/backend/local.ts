import type { Profile, Server, Channel, ChannelCategory, Member, Message, Reaction, Ban, DirectMessageGroup, DirectMessageMember, DirectMessage, Role, UserRole, ChannelRoleOverride } from '@/lib/types'
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
          created_at: now,
          updated_at: now,
        }
        writeJson(KEYS.profiles, profiles)

        setSession({
          user: { id, email },
          access_token: `local_${id}`,
        })
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
          .filter((c) => c.server_id === serverId)
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
  }
}
