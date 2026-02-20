import type { Profile, Server, Channel, Member, Message } from '@/lib/types'
import type { AuthSession, Backend } from './types'

const KEYS = {
  users: 'protocode_users',
  session: 'protocode_session',
  profiles: 'protocode_profiles',
  servers: 'protocode_servers',
  channels: 'protocode_channels',
  members: 'protocode_members',
  messages: 'protocode_messages',
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
          created_at: new Date().toISOString(),
        })
        writeJson(KEYS.channels, channels)

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
    },
  }
}
