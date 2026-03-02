import type { Profile, Server, Channel, ChannelCategory, Member, Message, Reaction, Ban, DirectMessageGroup, DirectMessage, Role, UserRole, ChannelRoleOverride, CommunitySettings, SpaceVisibility, SpaceType, AuditLog, AuditLogAction, Report, ReportCategory, ReportStatus, Mute, AutomodRule, Poll, PollOption, PollVote, PollWithResults, AppEvent, EventRsvp, RsvpStatus } from '@/lib/types'

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
    register(email: string, password: string, username: string): Promise<{ needsConfirmation: boolean }>
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
    create(data: { name: string; description?: string; icon_url?: string | null; visibility?: SpaceVisibility; space_type?: SpaceType; sort_order?: number }, ownerId: string): Promise<Server>
    update(id: string, updates: Partial<Pick<Server, 'name' | 'description' | 'icon_url' | 'is_public'>>): Promise<Server>
    delete(id: string): Promise<void>
    getByInviteCode(code: string): Promise<Server>
    regenerateInviteCode(id: string): Promise<string>
  }
  channels: {
    list(serverId: string): Promise<Channel[]>
    get(id: string): Promise<Channel>
    create(data: { server_id: string; name: string; description?: string; is_default?: boolean; category_id?: string | null }): Promise<Channel>
    update(id: string, updates: Partial<Pick<Channel, 'name' | 'description' | 'slowmode_seconds' | 'position' | 'category_id'>>): Promise<Channel>
    delete(id: string): Promise<void>
  }
  categories: {
    list(serverId: string): Promise<ChannelCategory[]>
    create(data: { server_id: string; name: string }): Promise<ChannelCategory>
    update(id: string, updates: Partial<Pick<ChannelCategory, 'name' | 'position'>>): Promise<ChannelCategory>
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
    pin(id: string): Promise<Message>
    unpin(id: string): Promise<Message>
    listPinned(channelId: string): Promise<(Message & { profile: Profile })[]>
  }
  reactions: {
    listByChannel(channelId: string): Promise<Reaction[]>
    add(messageId: string, userId: string, emoji: string): Promise<Reaction>
    remove(messageId: string, userId: string, emoji: string): Promise<void>
  }
  bans: {
    list(serverId: string): Promise<(Ban & { profile: Profile })[]>
    add(serverId: string, userId: string, bannedBy: string, reason?: string): Promise<Ban>
    remove(serverId: string, userId: string): Promise<void>
    check(serverId: string, userId: string): Promise<boolean>
  }
  dm: {
    listGroups(userId: string): Promise<DmGroupWithMeta[]>
    getOrCreate(userId: string, otherUserId: string): Promise<DirectMessageGroup>
    listMessages(dmGroupId: string): Promise<(DirectMessage & { profile: Profile })[]>
    sendMessage(dmGroupId: string, authorId: string, content: string, replyToId?: string | null): Promise<DirectMessage & { profile: Profile }>
    editMessage(id: string, content: string): Promise<DirectMessage>
    deleteMessage(id: string): Promise<void>
  }
  community: {
    get(): Promise<CommunitySettings>
    update(updates: Partial<Pick<CommunitySettings, 'name' | 'description' | 'logo_url' | 'banner_url' | 'registration_mode' | 'rules' | 'welcome_message'>>): Promise<CommunitySettings>
  }
  roles: {
    list(serverId: string): Promise<Role[]>
    create(data: { server_id: string; name: string; color?: string | null; icon?: string | null; permissions?: string; position?: number; is_default?: boolean }): Promise<Role>
    update(id: string, updates: Partial<Pick<Role, 'name' | 'color' | 'icon' | 'position' | 'permissions' | 'is_default'>>): Promise<Role>
    delete(id: string): Promise<void>
    listUserRoles(serverId: string, userId: string): Promise<Role[]>
    assignRole(userId: string, roleId: string): Promise<UserRole>
    removeRole(userId: string, roleId: string): Promise<void>
    listChannelOverrides(channelId: string): Promise<ChannelRoleOverride[]>
    setChannelOverride(channelId: string, roleId: string, allow: string, deny: string): Promise<ChannelRoleOverride>
    deleteChannelOverride(channelId: string, roleId: string): Promise<void>
  }
  audit_log: {
    log(serverId: string | null, actorId: string, action: AuditLogAction, targetType: AuditLog['target_type'], targetId: string, details?: Record<string, unknown>): Promise<AuditLog>
    list(serverId?: string | null, offset?: number, limit?: number): Promise<AuditLog[]>
  }
  reports: {
    // reporter_profile = the user who filed the report; reviewer_profile = the mod who reviewed it
    list(serverId?: string | null, status?: ReportStatus, offset?: number, limit?: number): Promise<Array<Report & { reporter_profile: Profile; reviewer_profile: Profile | null }>>
    create(data: { reporter_id: string; reported_type: 'message' | 'user'; reported_id: string; server_id?: string | null; category: ReportCategory; description: string }): Promise<Report>
    update(id: string, updates: { status?: ReportStatus; reviewed_by?: string | null; resolution?: string }): Promise<Report>
  }
  mutes: {
    // user_profile = the muted user; muted_by_profile = the mod who muted them
    list(serverId: string): Promise<Array<Mute & { user_profile: Profile; muted_by_profile: Profile }>>
    add(serverId: string, userId: string, mutedBy: string, reason?: string, expiresAt?: string | null): Promise<Mute>
    remove(serverId: string, userId: string): Promise<void>
    check(serverId: string, userId: string): Promise<Mute | null>
  }
  automod_rules: {
    list(serverId: string): Promise<AutomodRule[]>
    create(data: Omit<AutomodRule, 'id' | 'created_at' | 'enabled'> & { enabled?: boolean }): Promise<AutomodRule>
    update(id: string, updates: Partial<Pick<AutomodRule, 'name' | 'rule_type' | 'config' | 'action' | 'enabled'>>): Promise<AutomodRule>
    delete(id: string): Promise<void>
  }
  threads: {
    create(serverId: string, parentChannelId: string, parentMessageId: string, name: string): Promise<Channel>
    listByChannel(channelId: string): Promise<Channel[]>
  }
  polls: {
    create(channelId: string, question: string, options: string[], createdBy: string): Promise<Poll & { options: PollOption[] }>
    vote(pollId: string, optionId: string, userId: string): Promise<PollVote>
    getResults(pollId: string, userId: string): Promise<PollWithResults>
    close(pollId: string): Promise<Poll>
    listByChannel(channelId: string): Promise<PollWithResults[]>
  }
  events: {
    list(serverId: string): Promise<AppEvent[]>
    create(data: { server_id: string; channel_id?: string | null; title: string; description?: string; start_at: string; end_at?: string | null; created_by: string }): Promise<AppEvent>
    rsvp(eventId: string, userId: string, status: RsvpStatus): Promise<EventRsvp>
    getRsvps(eventId: string): Promise<EventRsvp[]>
  }
}
