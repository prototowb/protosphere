import type { ContextMenuItem } from '@/stores/contextMenu'
import type { Message, Member, Profile, Channel, ChannelCategory, MemberRole } from '@/lib/types'

// Separator helper
const sep: ContextMenuItem = { label: '', separator: true, action: () => {} }

// ── Server Message Context ─────────────────────────────────
export function messageContextItems(
  msg: Message & { profile: Profile },
  opts: {
    isAuthor: boolean
    canModerate: boolean
    onReply: () => void
    onEdit: () => void
    onDelete: () => void
    onPin: () => void
    onUnpin: () => void
    onCopyText: () => void
    onAddReaction: () => void
  },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'Reply', action: opts.onReply },
    { label: 'Add Reaction', action: opts.onAddReaction },
    { label: 'Copy Text', action: opts.onCopyText },
  ]

  if (opts.isAuthor) {
    items.push(sep)
    items.push({ label: 'Edit Message', action: opts.onEdit })
  }

  if (opts.canModerate) {
    items.push(sep)
    items.push({ label: msg.is_pinned ? 'Unpin Message' : 'Pin Message', action: msg.is_pinned ? opts.onUnpin : opts.onPin })
  }

  if (opts.isAuthor || opts.canModerate) {
    items.push({ label: 'Delete Message', danger: true, action: opts.onDelete })
  }

  return items
}

// ── Member Context ──────────────────────────────────────────
export function memberContextItems(
  member: Member & { profile: Profile },
  opts: {
    isMe: boolean
    myRole: MemberRole
    onViewProfile: () => void
    onOpenDM: () => void
    onChangeRole?: (role: MemberRole) => void
    onKick?: () => void
    onBan?: () => void
  },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'View Profile', action: opts.onViewProfile },
  ]

  if (!opts.isMe) {
    items.push({ label: 'Message', action: opts.onOpenDM })
  }

  // Role management
  const canManage = !opts.isMe && (opts.myRole === 'owner' || (opts.myRole === 'admin' && (member.role === 'member' || member.role === 'moderator')))
  if (canManage && opts.onChangeRole) {
    items.push(sep)
    if (member.role !== 'moderator') items.push({ label: 'Make Moderator', action: () => opts.onChangeRole!('moderator') })
    if (member.role !== 'admin' && opts.myRole === 'owner') items.push({ label: 'Make Admin', action: () => opts.onChangeRole!('admin') })
    if (member.role !== 'member') items.push({ label: 'Set to Member', action: () => opts.onChangeRole!('member') })
  }

  if (canManage && (opts.onKick || opts.onBan)) {
    items.push(sep)
    if (opts.onKick) items.push({ label: 'Kick', danger: true, action: opts.onKick })
    if (opts.onBan) items.push({ label: 'Ban', danger: true, action: opts.onBan })
  }

  return items
}

// ── Channel Context ─────────────────────────────────────────
export function channelContextItems(
  _channel: Channel,
  opts: {
    canManage: boolean
    onEditChannel?: () => void
    onDeleteChannel?: () => void
    onMarkRead: () => void
  },
): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'Mark as Read', action: opts.onMarkRead },
  ]

  if (opts.canManage) {
    items.push(sep)
    if (opts.onEditChannel) items.push({ label: 'Edit Channel', action: opts.onEditChannel })
    if (opts.onDeleteChannel) items.push({ label: 'Delete Channel', danger: true, action: opts.onDeleteChannel })
  }

  return items
}

// ── Category Context ────────────────────────────────────────
export function categoryContextItems(
  _category: ChannelCategory,
  opts: {
    canManage: boolean
    onRename?: () => void
    onDelete?: () => void
  },
): ContextMenuItem[] {
  if (!opts.canManage) return []
  const items: ContextMenuItem[] = []
  if (opts.onRename) items.push({ label: 'Rename Category', action: opts.onRename })
  if (opts.onDelete) items.push({ label: 'Delete Category', danger: true, action: opts.onDelete })
  return items
}

// ── Server Header Context ───────────────────────────────────
export function serverHeaderContextItems(opts: {
  isOwner: boolean
  canManageChannels: boolean
  onInvite: () => void
  onCreateChannel?: () => void
  onCreateCategory?: () => void
  onServerSettings?: () => void
  onLeave?: () => void
  onDelete?: () => void
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'Invite People', action: opts.onInvite },
  ]

  if (opts.canManageChannels) {
    if (opts.onCreateChannel) items.push({ label: 'Create Channel', action: opts.onCreateChannel })
    if (opts.onCreateCategory) items.push({ label: 'Create Category', action: opts.onCreateCategory })
    if (opts.onServerSettings) items.push({ label: 'Server Settings', action: opts.onServerSettings })
  }

  items.push(sep)
  if (opts.isOwner) {
    if (opts.onDelete) items.push({ label: 'Delete Server', danger: true, action: opts.onDelete })
  } else {
    if (opts.onLeave) items.push({ label: 'Leave Server', danger: true, action: opts.onLeave })
  }

  return items
}

// ── Server Icon Context (sidebar) ──────────────────────────
export function serverIconContextItems(opts: {
  isOwner: boolean
  onInvite: () => void
  onServerSettings?: () => void
  onMarkRead: () => void
  onLeave?: () => void
  onDelete?: () => void
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'Invite People', action: opts.onInvite },
  ]

  if (opts.isOwner && opts.onServerSettings) {
    items.push({ label: 'Server Settings', action: opts.onServerSettings })
  }

  items.push({ label: 'Mark as Read', action: opts.onMarkRead })
  items.push(sep)

  if (opts.isOwner) {
    if (opts.onDelete) items.push({ label: 'Delete Server', danger: true, action: opts.onDelete })
  } else {
    if (opts.onLeave) items.push({ label: 'Leave Server', danger: true, action: opts.onLeave })
  }

  return items
}

// ── DM Conversation Context ────────────────────────────────
export function dmConversationContextItems(opts: {
  onMarkRead: () => void
  onCloseConversation: () => void
}): ContextMenuItem[] {
  return [
    { label: 'Mark as Read', action: opts.onMarkRead },
    sep,
    { label: 'Close Conversation', danger: true, action: opts.onCloseConversation },
  ]
}

// ── DM Message Context ──────────────────────────────────────
export function dmMessageContextItems(opts: {
  isAuthor: boolean
  onReply: () => void
  onEdit: () => void
  onDelete: () => void
  onCopyText: () => void
}): ContextMenuItem[] {
  const items: ContextMenuItem[] = [
    { label: 'Reply', action: opts.onReply },
    { label: 'Copy Text', action: opts.onCopyText },
  ]

  if (opts.isAuthor) {
    items.push(sep)
    items.push({ label: 'Edit Message', action: opts.onEdit })
    items.push({ label: 'Delete Message', danger: true, action: opts.onDelete })
  }

  return items
}
