// TypeScript types matching the database schema
// All types correspond to tables in supabase/migrations/001_initial_schema.sql

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline'

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member'

export type ChannelType = 'text'

export type SpaceVisibility = 'public' | 'private' | 'restricted'

export type SpaceType = 'general' | 'announcement' | 'archive'

export type RegistrationMode = 'open' | 'approval' | 'invite_only' | 'closed'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  status: UserStatus
  status_text: string
  bio: string
  created_at: string
  updated_at: string
}

export interface Server {
  id: string
  name: string
  description: string
  icon_url: string | null
  owner_id: string
  invite_code: string | null
  is_public: boolean
  member_count: number
  visibility: SpaceVisibility
  space_type: SpaceType
  sort_order: number
  created_at: string
}

export interface CommunitySettings {
  id: string
  name: string
  description: string
  logo_url: string | null
  banner_url: string | null
  registration_mode: RegistrationMode
  rules: string
  welcome_message: string
  created_at: string
  updated_at: string
}

export interface ChannelCategory {
  id: string
  server_id: string
  name: string
  position: number
  created_at: string
}

export interface Channel {
  id: string
  server_id: string
  name: string
  description: string
  type: ChannelType
  position: number
  is_default: boolean
  slowmode_seconds: number
  category_id: string | null
  created_at: string
}

export interface Attachment {
  url: string
  filename: string
  size: number
  mime_type: string
}

export interface Message {
  id: string
  channel_id: string
  author_id: string
  content: string
  edited_at: string | null
  reply_to_id: string | null
  attachments: Attachment[]
  is_pinned: boolean
  created_at: string
}

export interface Member {
  server_id: string
  user_id: string
  role: MemberRole
  nickname: string | null
  joined_at: string
}

export interface Reaction {
  message_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ChannelReadState {
  channel_id: string
  user_id: string
  last_read_at: string
  mention_count: number
}

export interface DirectMessageGroup {
  id: string
  name: string | null
  is_group: boolean
  created_at: string
}

export interface DirectMessageMember {
  dm_group_id: string
  user_id: string
  joined_at: string
}

export interface DirectMessage {
  id: string
  dm_group_id: string
  author_id: string
  content: string
  edited_at: string | null
  reply_to_id: string | null
  attachments: Attachment[]
  created_at: string
}

export interface Ban {
  server_id: string
  user_id: string
  banned_by: string
  reason: string
  created_at: string
}

export interface Role {
  id: string
  server_id: string
  name: string
  color: string | null
  icon: string | null
  position: number
  permissions: string  // decimal string representation of a BIGINT
  is_default: boolean
  is_system: boolean
  created_at: string
}

export interface UserRole {
  user_id: string
  role_id: string
  assigned_at: string
}

export interface ChannelRoleOverride {
  channel_id: string
  role_id: string
  allow: string  // decimal string representation of a BIGINT
  deny: string   // decimal string representation of a BIGINT
}
