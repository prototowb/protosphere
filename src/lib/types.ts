// TypeScript types matching the database schema
// All types correspond to tables in supabase/migrations/001_initial_schema.sql

export type UserStatus = 'online' | 'idle' | 'dnd' | 'offline'

export type MemberRole = 'owner' | 'admin' | 'moderator' | 'member'

export type ChannelType = 'text'

export type SpaceVisibility = 'public' | 'private' | 'restricted'

export type SpaceType = 'general' | 'announcement' | 'archive'

export type RegistrationMode = 'open' | 'approval' | 'invite_only' | 'closed'

export type ProfileStatus = 'active' | 'pending' | 'rejected'

export type ForumPostType = 'thread' | 'page'

export interface Profile {
  id: string
  username: string
  display_name: string
  avatar_url: string | null
  status: UserStatus
  status_text: string
  bio: string
  pronouns: string
  website: string
  location: string
  display_banner_url: string | null
  account_status: ProfileStatus
  meta_points: number
  profile_page: PageContent | null
  onboarding_complete: boolean
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
  setup_complete: boolean
  owner_id: string | null  // first registered user / community admin
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
  expires_at: string | null
  forum_post_id: string | null
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
  expires_at: string | null
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

// ── Moderation & Safety ──────────────────────────────────────

export type AuditLogAction =
  | 'member.kick'
  | 'member.ban'
  | 'member.unban'
  | 'message.delete'
  | 'message.pin'
  | 'message.unpin'
  | 'channel.create'
  | 'channel.update'
  | 'channel.delete'
  | 'role.create'
  | 'role.update'
  | 'role.delete'
  | 'role.assign'
  | 'role.remove'
  | 'role.permissions_changed'
  | 'channel_override.changed'
  | 'channel_override.removed'
  | 'server.update'
  | 'mute.add'
  | 'mute.remove'

export interface AuditLog {
  id: string
  server_id: string | null
  actor_id: string
  action: AuditLogAction
  target_type: 'member' | 'message' | 'channel' | 'role' | 'server'
  target_id: string
  details: Record<string, unknown>
  created_at: string
}

export type ReportCategory = 'spam' | 'harassment' | 'nsfw' | 'misinformation' | 'other'

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'

export interface Report {
  id: string
  reporter_id: string
  reported_type: 'message' | 'user'
  reported_id: string
  server_id: string | null
  category: ReportCategory
  description: string
  status: ReportStatus
  reviewed_by: string | null
  resolution: string
  created_at: string
  resolved_at: string | null
}

export interface Mute {
  server_id: string
  user_id: string
  muted_by: string
  reason: string
  expires_at: string | null
  created_at: string
}

export type AutomodRuleType = 'word_filter' | 'spam_detect' | 'link_filter' | 'caps_filter'

export type AutomodAction = 'flag' | 'delete' | 'mute'

export interface AutomodRule {
  id: string
  server_id: string
  name: string
  rule_type: AutomodRuleType
  config: Record<string, unknown>
  action: AutomodAction
  enabled: boolean
  created_at: string
}

// ── Polls ──────────────────────────────────────────────────

export interface Poll {
  id: string
  channel_id: string
  question: string
  created_by: string
  closed_at: string | null
  created_at: string
}

export interface PollOption {
  id: string
  poll_id: string
  text: string
  position: number
}

export interface PollVote {
  poll_id: string
  user_id: string
  option_id: string
  created_at: string
}

export interface PollWithResults {
  poll: Poll
  options: (PollOption & { vote_count: number })[]
  myVote: string | null
  total_votes: number
}

// ── Events ─────────────────────────────────────────────────

export type RsvpStatus = 'going' | 'maybe' | 'not_going'

export interface AppEvent {
  id: string
  server_id: string
  channel_id: string | null
  title: string
  description: string
  start_at: string
  end_at: string | null
  created_by: string
  created_at: string
}

export interface EventRsvp {
  event_id: string
  user_id: string
  status: RsvpStatus
  created_at: string
}

// ── Community Invites ───────────────────────────────────────

export type CommunityInviteUsage = 'single_use' | 'multi_use'

export interface CommunityInvite {
  id: string
  token: string
  created_by: string
  usage: CommunityInviteUsage
  max_uses: number | null
  use_count: number
  expires_at: string | null
  created_at: string
}

// ── Notification Preferences ────────────────────────────────

export type NotificationLevel = 'all' | 'mentions' | 'none'

export interface NotificationPreference {
  user_id: string
  channel_id: string
  level: NotificationLevel
}

// ── Message Attachments ──────────────────────────────────────

export interface MessageAttachment {
  id: string
  message_id: string
  storage_path: string
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
}

// ── DM Notification Preferences ─────────────────────────────

export interface DmNotificationPreference {
  user_id: string
  group_id: string
  muted: boolean
}

// ── Forum ─────────────────────────────────────────────────────

// ── Block editor ─────────────────────────────────────────────────────────────

export interface HeroBlock    { id: string; type: 'hero';      title: string; subtitle: string; backgroundUrl?: string; textAlign?: 'left' | 'center' | 'right' }
export interface TextBlock    { id: string; type: 'text';      html: string; _author?: string; _date?: string; _pinned?: true; _variant?: 'default' | 'quote' | 'highlight' }
export interface ImageBlock   { id: string; type: 'image';     url: string; caption?: string; fullWidth?: boolean }
export interface ColumnsBlock { id: string; type: 'columns';   cols: 2 | 3; items: string[] }
export interface CalloutBlock { id: string; type: 'callout';   variant: 'info' | 'warning' | 'success' | 'error'; title?: string; text: string }
export interface DividerBlock { id: string; type: 'divider' }
export interface LinkCardBlock{ id: string; type: 'link-card'; url: string; title: string; description?: string; imageUrl?: string }

export type Block = HeroBlock | TextBlock | ImageBlock | ColumnsBlock | CalloutBlock | DividerBlock | LinkCardBlock

export interface PageContent {
  blocks: Block[]
  customCss: string
  lockedHeroStyle?: { backgroundUrl?: string; textAlign?: 'left' | 'center' | 'right' }
}

export interface ForumPost {
  id: string
  space_id: string
  source_message_id: string | null
  type: ForumPostType
  title: string
  body: string | null
  content: PageContent | null
  vote_score: number
  is_deleted: boolean
  created_by: string
  marked_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
}

export interface ForumCollaborator {
  post_id: string
  user_id: string
  invited_by: string
  added_at: string
}

export interface ForumComment {
  id: string
  post_id: string
  parent_comment_id: string | null
  author_id: string
  content: string
  vote_score: number
  is_deleted: boolean
  created_at: string
  edited_at: string | null
}

export interface ForumCommentVote {
  comment_id: string
  user_id: string
  value: 1 | -1
}

export interface ForumCommentReaction {
  comment_id: string
  user_id: string
  emoji: string
  created_at: string
}

export interface ForumVote {
  post_id: string
  user_id: string
  value: 1 | -1
}

// ── Integrations ─────────────────────────────────────────────

export type IntegrationAuthMode = 'same_domain_cookie' | 'oauth_redirect' | 'token_exchange'

export type IntegrationFieldType = 'number' | 'text' | 'badge' | 'list' | 'activity_feed' | 'progress_bar'

export type FieldVisibility = 'public' | 'private' | 'hidden'

export interface Integration {
  id: string
  name: string
  slug: string
  description: string
  icon_url: string | null
  api_base_url: string
  api_key: string
  app_url: string | null
  auth_mode: IntegrationAuthMode
  data_endpoint: string
  default_ttl_seconds: number
  enabled: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface IntegrationFieldSchema {
  id: string
  integration_id: string
  field_key: string
  label: string
  field_type: IntegrationFieldType
  default_visibility: FieldVisibility
  sort_order: number
  created_at: string
}

export interface UserIntegration {
  id: string
  user_id: string
  integration_id: string
  external_user_id: string | null
  connected_at: string
  synced_data: Record<string, unknown> | null
  synced_at: string | null
  connection_token: string | null
}

export interface UserFieldVisibility {
  user_id: string
  field_schema_id: string
  visibility: FieldVisibility
}

export interface SpaceIntegrationRequirement {
  id: string
  server_id: string
  integration_id: string
  field_key: string
  required: boolean
  created_at: string
}
