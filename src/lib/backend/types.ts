import type { Profile, Server, Channel, Member, Message, DirectMessageGroup, DirectMessage } from '@/lib/types'

export interface AuthUser {
  id: string
  email: string
}

export interface AuthSession {
  user: AuthUser
  access_token: string
}

export type DmGroupWithMeta = DirectMessageGroup & {
  otherUser: Profile
  lastMessage: DirectMessage | null
}

export interface Backend {
  auth: {
    login(email: string, password: string): Promise<void>
    register(email: string, password: string, username: string): Promise<void>
    loginWithOAuth(provider: string): Promise<void>
    logout(): Promise<void>
    resetPassword(email: string): Promise<void>
    init(onSession: (session: AuthSession | null) => void): void
  }
  profiles: {
    get(id: string): Promise<Profile>
    update(id: string, updates: Partial<Profile>): Promise<Profile>
    uploadAvatar(userId: string, file: File): Promise<string>
    search(query: string, excludeUserId: string): Promise<Profile[]>
  }
  servers: {
    list(userId: string): Promise<Server[]>
    get(id: string): Promise<Server>
    create(data: { name: string; description?: string; icon_url?: string | null }, ownerId: string): Promise<Server>
    update(id: string, updates: Partial<Pick<Server, 'name' | 'description' | 'icon_url' | 'is_public'>>): Promise<Server>
    delete(id: string): Promise<void>
    getByInviteCode(code: string): Promise<Server>
    regenerateInviteCode(id: string): Promise<string>
  }
  channels: {
    list(serverId: string): Promise<Channel[]>
    get(id: string): Promise<Channel>
    create(data: { server_id: string; name: string; description?: string; is_default?: boolean }): Promise<Channel>
    update(id: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'slowmode_seconds' | 'position'>>): Promise<Channel>
    delete(id: string): Promise<void>
  }
  members: {
    list(serverId: string): Promise<(Member & { profile: Profile })[]>
    join(serverId: string, userId: string): Promise<Member>
    leave(serverId: string, userId: string): Promise<void>
    updateRole(serverId: string, userId: string, role: Member['role']): Promise<Member>
  }
  messages: {
    list(channelId: string): Promise<(Message & { profile: Profile })[]>
    send(channelId: string, authorId: string, content: string, replyToId?: string | null): Promise<Message & { profile: Profile }>
    edit(id: string, content: string): Promise<Message>
    delete(id: string): Promise<void>
  }
  dm: {
    listGroups(userId: string): Promise<DmGroupWithMeta[]>
    getOrCreate(userId: string, otherUserId: string): Promise<DirectMessageGroup>
    listMessages(dmGroupId: string): Promise<(DirectMessage & { profile: Profile })[]>
    sendMessage(dmGroupId: string, authorId: string, content: string): Promise<DirectMessage & { profile: Profile }>
    editMessage(id: string, content: string): Promise<DirectMessage>
    deleteMessage(id: string): Promise<void>
  }
}
