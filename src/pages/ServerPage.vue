<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import EmojiPicker from '@/components/chat/EmojiPicker.vue'
import MessageSearch from '@/components/chat/MessageSearch.vue'
import { useServersStore } from '@/stores/servers'
import { useChannelsStore } from '@/stores/channels'
import { useMessagesStore } from '@/stores/messages'
import { useCategoriesStore } from '@/stores/categories'
import { useChannels } from '@/composables/useChannels'
import { useCategories } from '@/composables/useCategories'
import { useMembers } from '@/composables/useMembers'
import { useServers } from '@/composables/useServers'
import { useMessages } from '@/composables/useMessages'
import { useReactions } from '@/composables/useReactions'
import { useMessageSearch } from '@/composables/useMessageSearch'
import { useTyping } from '@/composables/useTyping'
import { useDMs } from '@/composables/useDMs'
import { useProfile } from '@/composables/useProfile'
import { useUnread } from '@/composables/useUnread'
import { useMentions } from '@/composables/useMentions'
import { renderMessage } from '@/lib/mentions'
import { useAuthStore } from '@/stores/auth'
import { useReactionsStore } from '@/stores/reactions'
import { useToastStore } from '@/stores/toast'
import { useContextMenuStore } from '@/stores/contextMenu'
import { messageContextItems, memberContextItems, channelContextItems, categoryContextItems, serverHeaderContextItems } from '@/lib/contextMenuItems'
import ConfirmDialog from '@/components/ui/ConfirmDialog.vue'
import { useRoles } from '@/composables/useRoles'
import { usePermissions } from '@/composables/usePermissions'
import { Permission } from '@/lib/permissions'
import type { Message, Profile, Member, MemberRole, Channel, ChannelCategory } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const serversStore = useServersStore()
const channelsStore = useChannelsStore()
const messagesStore = useMessagesStore()
const authStore = useAuthStore()
const { fetchChannels, createChannel, updateChannel, deleteChannel } = useChannels()
const { fetchCategories, createCategory, updateCategory, deleteCategory } = useCategories()
const categoriesStore = useCategoriesStore()
const { members, fetchMembers, updateRole } = useMembers()
const { fetchServerRoles, fetchUserRoles } = useRoles()
const { leaveServer, deleteServer, kickMember, banMember, regenerateInviteCode } = useServers()
const { fetchMessages, sendMessage, editMessage, deleteMessage, pinMessage, unpinMessage, fetchPinnedMessages } = useMessages()
const { fetchReactionsForChannel, toggleReaction } = useReactions()
const reactionsStore = useReactionsStore()
const toastStore = useToastStore()
const contextMenuStore = useContextMenuStore()
const { openDM } = useDMs()
const { updateProfile } = useProfile()
const { typingUsers, onTyping, onSent, startListening, stopListening } = useTyping(
  () => channelsStore.activeChannelId,
  () => myMember.value?.profile.display_name ?? authStore.user?.email?.split('@')[0] ?? 'Someone',
)
const { unreadChannelIds, markRead, refreshUnread } = useUnread()
const { scanForMentions, clearServerMentions, requestPermission, getUsername } = useMentions()
const { query: searchQuery, results: searchResults, isOpen: searchOpen, open: openSearch, close: closeSearch } = useMessageSearch(() => messages.value)

const myUsername = ref<string | null>(null)

const showCreateChannel = ref(false)
const newChannelName = ref('')
const newChannelCategoryId = ref<string | null>(null)
const showCreateCategory = ref(false)
const newCategoryName = ref('')

// Inline category rename
const renamingCategoryId = ref<string | null>(null)
const renamingCategoryName = ref('')

// Edit channel dialog
const showEditChannel = ref(false)
const editChannelId = ref<string | null>(null)
const editChannelName = ref('')
const editChannelDescription = ref('')
const editChannelSlowmode = ref(0)
const COLLAPSED_KEY = 'protosphere_collapsed_categories'

function loadCollapsedCategories(sid: string): Set<string> {
  try {
    const state: Record<string, string[]> = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}')
    return new Set(state[sid] ?? [])
  } catch {
    return new Set()
  }
}

function saveCollapsedCategories(sid: string, cats: Set<string>) {
  try {
    const state: Record<string, string[]> = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? '{}')
    state[sid] = [...cats]
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(state))
  } catch { /* ignore */ }
}

const collapsedCategories = ref<Set<string>>(new Set())
const draggedChannelId = ref<string | null>(null)
const dragOverChannelId = ref<string | null>(null)
const dragOverCategoryId = ref<string | null>(null)

// Slowmode
const slowmodeRemaining = ref(0)
let slowmodeTimer: ReturnType<typeof setInterval> | null = null
const inviteCode = ref('')
const showInvite = ref(false)
const showServerActions = ref(false)

const serverId = ref('')
const channelId = ref('')

const messageInput = ref('')
const messageInputEl = ref<HTMLInputElement | null>(null)
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)

// Full emoji drawer (input bar)
const emojiDrawerOpen = ref(false)
const emojiDrawerAnchor = ref<{ bottom: number; right: number } | null>(null)

function openEmojiDrawer(event: MouseEvent) {
  if (emojiDrawerOpen.value) {
    emojiDrawerOpen.value = false
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  emojiDrawerAnchor.value = { bottom: window.innerHeight - rect.top + 8, right: window.innerWidth - rect.right }
  emojiDrawerOpen.value = true
}

function insertEmoji(emoji: string) {
  const input = messageInputEl.value
  if (!input) {
    messageInput.value += emoji
    return
  }
  const start = input.selectionStart ?? messageInput.value.length
  const end = input.selectionEnd ?? messageInput.value.length
  messageInput.value = messageInput.value.slice(0, start) + emoji + messageInput.value.slice(end)
  nextTick(() => {
    input.focus()
    const pos = start + [...emoji].length  // account for multi-codepoint emoji
    input.setSelectionRange(pos, pos)
  })
}

const editingId = ref<string | null>(null)
const editingContent = ref('')

const replyingTo = ref<(Message & { profile: Profile }) | null>(null)

// Emoji picker
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥']
const emojiPickerForMsg = ref<string | null>(null)
const pickerAnchorRect = ref<{ top: number; right: number } | null>(null)

function openEmojiPicker(msgId: string, event: MouseEvent) {
  if (emojiPickerForMsg.value === msgId) {
    emojiPickerForMsg.value = null
    pickerAnchorRect.value = null
    return
  }
  const btn = event.currentTarget as HTMLElement
  const rect = btn.getBoundingClientRect()
  pickerAnchorRect.value = { top: rect.bottom + 4, right: window.innerWidth - rect.right }
  emojiPickerForMsg.value = msgId
}

// Pinned messages panel
const showPinnedPanel = ref(false)
const pinnedMessages = ref<(Message & { profile: Profile })[]>([])

// Member profile panel
const selectedMember = ref<(Member & { profile: Profile }) | null>(null)

// Confirm dialog
const confirmDialog = ref<{
  title: string
  message: string
  confirmLabel: string
  danger: boolean
  requireInput?: string
  inputPlaceholder?: string
  onConfirm: (input: string) => void
} | null>(null)

function loadServer() {
  serverId.value = route.params.serverId as string
  channelId.value = route.params.channelId as string
  serversStore.activeServerId = serverId.value

  if (serverId.value) {
    collapsedCategories.value = loadCollapsedCategories(serverId.value)
    fetchChannels(serverId.value)
    fetchCategories(serverId.value)
    fetchMembers(serverId.value).then(() => {
      if (authStore.user?.id) {
        fetchServerRoles(serverId.value)
        fetchUserRoles(serverId.value, authStore.user.id)
      }
    })
  }
}

function startSlowmode(seconds: number) {
  slowmodeRemaining.value = seconds
  if (slowmodeTimer) clearInterval(slowmodeTimer)
  slowmodeTimer = setInterval(() => {
    slowmodeRemaining.value--
    if (slowmodeRemaining.value <= 0) {
      clearInterval(slowmodeTimer!)
      slowmodeTimer = null
    }
  }, 1000)
}

onMounted(async () => {
  loadServer()
  startListening()
  myUsername.value = await getUsername()
  clearServerMentions(serverId.value)
  await requestPermission()
})
onUnmounted(() => {
  stopListening()
  if (slowmodeTimer) clearInterval(slowmodeTimer)
})
watch(() => route.params.serverId, loadServer)

watch(() => channelsStore.channels, (channels) => {
  if (channels.length > 0 && channelId.value === serverId.value) {
    const defaultChannel = channels.find((c) => c.is_default) || channels[0]
    if (defaultChannel) {
      channelsStore.activeChannelId = defaultChannel.id
      router.replace(`/channels/${serverId.value}/${defaultChannel.id}`)
    }
  } else {
    channelsStore.activeChannelId = channelId.value
  }
})

watch(() => route.params.channelId, (id) => {
  if (id && id !== serverId.value) {
    channelId.value = id as string
    channelsStore.activeChannelId = channelId.value
  }
})

// Load messages and mark as read when active channel changes
watch(() => channelsStore.activeChannelId, (id) => {
  if (id && id !== serverId.value) {
    showPinnedPanel.value = false
    slowmodeRemaining.value = 0
    if (slowmodeTimer) { clearInterval(slowmodeTimer); slowmodeTimer = null }
    fetchMessages(id).then(() => {
      scrollToBottom()
      scanForMentions(serverId.value, id)
      markRead(id)
      refreshUnread(channelsStore.channels.map((c) => c.id))
    })
    fetchReactionsForChannel(id)
  }
}, { immediate: true })

// Refresh unread whenever the channel list changes (new channels loaded)
watch(() => channelsStore.channels, (channels) => {
  refreshUnread(channels.map((c) => c.id))
})

const currentServer = ref<typeof serversStore.servers[0] | undefined>()
watch(
  [() => serversStore.servers, () => serverId.value],
  () => {
    currentServer.value = serversStore.servers.find((s) => s.id === serverId.value)
    if (currentServer.value) {
      inviteCode.value = currentServer.value.invite_code ?? ''
    }
  },
  { immediate: true },
)

const activeChannel = ref<typeof channelsStore.channels[0] | undefined>()
watch(
  [() => channelsStore.channels, () => channelsStore.activeChannelId],
  () => {
    activeChannel.value = channelsStore.channels.find((c) => c.id === channelsStore.activeChannelId)
  },
  { immediate: true },
)

const isOwner = computed(() => currentServer.value?.owner_id === authStore.user?.id)

// ── Member sorting by role hierarchy → status → display name ───
const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, moderator: 2, member: 3 }
const STATUS_ORDER: Record<string, number> = { online: 0, idle: 1, dnd: 2, offline: 3 }

const ROLE_LABELS: Record<string, string> = { owner: 'Owner', admin: 'Admins', moderator: 'Moderators', member: 'Members' }

type MemberWithProfile = Member & { profile: Profile }
interface RoleGroup {
  role: string
  label: string
  members: MemberWithProfile[]
}

const memberRoleGroups = computed((): RoleGroup[] => {
  const sorted = [...members.value].sort((a, b) => {
    const roleDiff = (ROLE_ORDER[a.role] ?? 3) - (ROLE_ORDER[b.role] ?? 3)
    if (roleDiff !== 0) return roleDiff
    const statusDiff = (STATUS_ORDER[a.profile.status] ?? 3) - (STATUS_ORDER[b.profile.status] ?? 3)
    if (statusDiff !== 0) return statusDiff
    return a.profile.display_name.localeCompare(b.profile.display_name)
  })

  const groups: RoleGroup[] = []
  let currentRole = ''
  for (const m of sorted) {
    if (m.role !== currentRole) {
      currentRole = m.role
      groups.push({ role: m.role, label: ROLE_LABELS[m.role] ?? m.role, members: [] })
    }
    groups[groups.length - 1]!.members.push(m)
  }
  return groups
})

const myMember = computed(() => members.value.find((m) => m.user_id === authStore.user?.id))
const myRole = computed(() => myMember.value?.role ?? 'member')

const { can, check } = usePermissions(serverId, myRole)

// Create/delete channels, categories
const canManageChannels = can(Permission.MANAGE_CHANNELS)
// Delete others' messages, pin/unpin
const canModerate = can(Permission.MANAGE_MESSAGES)
// Kick / ban members
const canKick = can(Permission.KICK_MEMBERS)
const canBan = can(Permission.BAN_MEMBERS)

const messages = computed((): (Message & { profile: Profile })[] => {
  const id = channelsStore.activeChannelId
  return id ? (messagesStore.messagesByChannel[id] ?? []) as (Message & { profile: Profile })[] : []
})

function scrollToBottom() {
  nextTick(() => {
    if (messageListEl.value) {
      messageListEl.value.scrollTop = messageListEl.value.scrollHeight
    }
  })
}

function scrollToMessage(messageId: string) {
  nextTick(() => {
    if (!messageListEl.value) return
    const el = messageListEl.value.querySelector(`[data-message-id="${messageId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      el.classList.add('bg-accent/10')
      setTimeout(() => el.classList.remove('bg-accent/10'), 2000)
    }
  })
}

watch(messages, scrollToBottom)

async function handleSendMessage() {
  const content = messageInput.value.trim()
  if (!content || sending.value || !channelsStore.activeChannelId || !authStore.user?.id || slowmodeRemaining.value > 0) return
  sending.value = true
  try {
    messageInput.value = ''
    onSent()
    await sendMessage(channelsStore.activeChannelId, authStore.user.id, content, replyingTo.value?.id)
    replyingTo.value = null
    const slowmode = activeChannel.value?.slowmode_seconds ?? 0
    if (slowmode > 0) startSlowmode(slowmode)
  } finally {
    sending.value = false
  }
}

function getMessageById(id: string | null): (Message & { profile: Profile }) | null {
  if (!id) return null
  return messages.value.find((m) => m.id === id) ?? null
}

function startReply(msg: Message & { profile: Profile }) {
  replyingTo.value = msg
  editingId.value = null
}

function startEdit(msg: Message & { profile: Profile }) {
  editingId.value = msg.id
  editingContent.value = msg.content
}

function cancelEdit() {
  editingId.value = null
  editingContent.value = ''
}

async function submitEdit() {
  if (!editingId.value || !editingContent.value.trim() || !channelsStore.activeChannelId) return
  await editMessage(channelsStore.activeChannelId, editingId.value, editingContent.value.trim())
  cancelEdit()
}

function handleDeleteMessage(messageId: string) {
  confirmDialog.value = {
    title: 'Delete Message',
    message: 'Are you sure you want to delete this message? This cannot be undone.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      if (!channelsStore.activeChannelId) return
      await deleteMessage(channelsStore.activeChannelId, messageId)
    },
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

// Group messages: collapse consecutive messages from same author within 5 minutes
type GroupedMessage = (Message & { profile: Profile }) & { showHeader: boolean; dateSeparator: string | null }

const groupedMessages = computed((): GroupedMessage[] => {
  return messages.value.map((msg, i) => {
    const prev = messages.value[i - 1]
    const sameAuthor = prev && prev.author_id === msg.author_id
    const withinWindow = prev && (new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime()) < 5 * 60 * 1000
    const showHeader = !sameAuthor || !withinWindow

    const currDate = new Date(msg.created_at).toDateString()
    const prevDate = prev ? new Date(prev.created_at).toDateString() : null
    const dateSeparator = currDate !== prevDate ? formatDate(msg.created_at) : null

    return { ...msg, showHeader, dateSeparator }
  })
})

async function handleCreateChannel() {
  if (!newChannelName.value.trim() || !serverId.value) return
  await createChannel(serverId.value, newChannelName.value.trim(), undefined, newChannelCategoryId.value)
  newChannelName.value = ''
  newChannelCategoryId.value = null
  showCreateChannel.value = false
}

async function handleCreateCategory() {
  if (!newCategoryName.value.trim() || !serverId.value) return
  await createCategory(serverId.value, newCategoryName.value.trim())
  newCategoryName.value = ''
  showCreateCategory.value = false
}

function openEditChannel(channelId: string) {
  const ch = channelsStore.channels.find((c) => c.id === channelId)
  if (!ch) return
  editChannelId.value = ch.id
  editChannelName.value = ch.name
  editChannelDescription.value = ch.description
  editChannelSlowmode.value = ch.slowmode_seconds
  showEditChannel.value = true
}

async function handleEditChannel() {
  if (!editChannelId.value || !editChannelName.value.trim()) return
  await updateChannel(editChannelId.value, {
    name: editChannelName.value.trim(),
    description: editChannelDescription.value.trim(),
    slowmode_seconds: editChannelSlowmode.value,
  })
  showEditChannel.value = false
  toastStore.show('Channel updated', 'success')
}

function handleDeleteChannel(chId: string) {
  const ch = channelsStore.channels.find((c) => c.id === chId)
  confirmDialog.value = {
    title: 'Delete Channel',
    message: `Are you sure you want to delete #${ch?.name ?? 'this channel'}? This cannot be undone.`,
    confirmLabel: 'Delete Channel',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await deleteChannel(chId)
      toastStore.show('Channel deleted', 'success')
      if (channelsStore.activeChannelId === null && channelsStore.channels.length > 0) {
        const defaultCh = channelsStore.channels.find((c) => c.is_default) || channelsStore.channels[0]
        if (defaultCh) router.replace(`/channels/${serverId.value}/${defaultCh.id}`)
      }
    },
  }
}

function handleDeleteCategory(categoryId: string) {
  const cat = categoriesStore.categories.find((c) => c.id === categoryId)
  confirmDialog.value = {
    title: 'Delete Category',
    message: `Are you sure you want to delete "${cat?.name ?? 'this category'}"? Channels in this category will become uncategorized.`,
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await deleteCategory(categoryId)
      fetchChannels(serverId.value)
      toastStore.show('Category deleted', 'success')
    },
  }
}

function startCategoryRename(categoryId: string) {
  const cat = categoriesStore.categories.find((c) => c.id === categoryId)
  if (!cat) return
  renamingCategoryId.value = categoryId
  renamingCategoryName.value = cat.name
}

async function submitCategoryRename() {
  if (!renamingCategoryId.value || !renamingCategoryName.value.trim()) return
  await updateCategory(renamingCategoryId.value, { name: renamingCategoryName.value.trim() })
  renamingCategoryId.value = null
  renamingCategoryName.value = ''
}

function cancelCategoryRename() {
  renamingCategoryId.value = null
  renamingCategoryName.value = ''
}

function onCategoryContext(event: MouseEvent, cat: ChannelCategory) {
  contextMenuStore.show(event, categoryContextItems(cat, {
    canManage: canManageChannels.value,
    isCollapsed: collapsedCategories.value.has(cat.id),
    onToggleCollapse: () => toggleCategory(cat.id),
    onRename: () => startCategoryRename(cat.id),
    onDelete: () => handleDeleteCategory(cat.id),
  }))
}

// ── Channel drag-and-drop reordering ─────────────────────
function onChannelDragStart(channelId: string) {
  draggedChannelId.value = channelId
}

function onChannelDragOver(channelId: string) {
  if (draggedChannelId.value && draggedChannelId.value !== channelId) {
    dragOverChannelId.value = channelId
    dragOverCategoryId.value = null
  }
}

function onChannelDragLeave() {
  dragOverChannelId.value = null
}

function onCategoryDragOver(categoryId: string) {
  if (draggedChannelId.value) {
    dragOverCategoryId.value = categoryId
    dragOverChannelId.value = null
  }
}

function onCategoryDragLeave() {
  dragOverCategoryId.value = null
}

async function onChannelDrop(targetChannelId: string) {
  const fromId = draggedChannelId.value
  draggedChannelId.value = null
  dragOverChannelId.value = null
  dragOverCategoryId.value = null
  if (!fromId || fromId === targetChannelId || !canManageChannels.value) return

  const from = channelsStore.channels.find((c) => c.id === fromId)
  const to = channelsStore.channels.find((c) => c.id === targetChannelId)
  if (!from || !to) return

  // If moving to a different category, update category_id first
  if (from.category_id !== to.category_id) {
    await updateChannel(fromId, { category_id: to.category_id })
  }

  // Reorder within the target category (read fresh from store after possible update)
  const group = channelsStore.channels
    .filter((c) => c.category_id === to.category_id)
    .sort((a, b) => a.position - b.position)

  const fromIdx = group.findIndex((c) => c.id === fromId)
  const toIdx = group.findIndex((c) => c.id === targetChannelId)
  if (fromIdx === -1 || toIdx === -1) return

  const [moved] = group.splice(fromIdx, 1)
  group.splice(toIdx, 0, moved!)

  for (let i = 0; i < group.length; i++) {
    const ch = group[i]
    if (ch && ch.position !== i) {
      await updateChannel(ch.id, { position: i })
    }
  }
}

async function onCategoryDrop(categoryId: string) {
  const fromId = draggedChannelId.value
  draggedChannelId.value = null
  dragOverCategoryId.value = null
  dragOverChannelId.value = null
  if (!fromId || !canManageChannels.value) return

  const from = channelsStore.channels.find((c) => c.id === fromId)
  if (!from || from.category_id === categoryId) return

  // Place at end of target category
  const group = channelsStore.channels.filter((c) => c.category_id === categoryId)
  await updateChannel(fromId, { category_id: categoryId, position: group.length })
}

function onChannelDragEnd() {
  draggedChannelId.value = null
  dragOverChannelId.value = null
  dragOverCategoryId.value = null
}

function toggleCategory(categoryId: string) {
  if (collapsedCategories.value.has(categoryId)) {
    collapsedCategories.value.delete(categoryId)
  } else {
    collapsedCategories.value.add(categoryId)
  }
  saveCollapsedCategories(serverId.value, collapsedCategories.value)
}


function handleLeaveServer() {
  confirmDialog.value = {
    title: 'Leave Server',
    message: `Are you sure you want to leave "${currentServer.value?.name ?? 'this server'}"?`,
    confirmLabel: 'Leave',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await leaveServer(serverId.value)
      router.push('/channels/@me')
    },
  }
}

function handleDeleteServer() {
  const name = currentServer.value?.name ?? ''
  confirmDialog.value = {
    title: 'Delete Server',
    message: `This will permanently delete "${name}" and all its channels and messages. Type the server name to confirm.`,
    confirmLabel: 'Delete Server',
    danger: true,
    requireInput: name,
    onConfirm: async () => {
      confirmDialog.value = null
      await deleteServer(serverId.value)
      toastStore.show('Server deleted', 'success')
      router.push('/channels/@me')
    },
  }
}

async function handleRegenerateInvite() {
  inviteCode.value = await regenerateInviteCode(serverId.value)
}

function copyInviteCode() {
  navigator.clipboard.writeText(inviteCode.value)
  toastStore.show('Invite code copied!', 'success')
}

// ── Member context menu ───────────────────────────────────
function canChangeRole(target: Member & { profile: Profile }) {
  return check(Permission.MANAGE_ROLES) && target.user_id !== authStore.user?.id
}

async function handleRoleChange(userId: string, role: MemberRole) {
  await updateRole(serverId.value, userId, role)
  if (selectedMember.value?.user_id === userId) {
    selectedMember.value = members.value.find((m) => m.user_id === userId) ?? null
  }
}

function handleKick(userId: string) {
  const member = members.value.find((m) => m.user_id === userId)
  confirmDialog.value = {
    title: 'Kick Member',
    message: `Are you sure you want to kick ${member?.profile.display_name ?? 'this member'} from the server?`,
    confirmLabel: 'Kick',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await kickMember(serverId.value, userId)
      await fetchMembers(serverId.value)
      selectedMember.value = null
      toastStore.show('Member kicked', 'success')
    },
  }
}

function handleBan(userId: string) {
  const member = members.value.find((m) => m.user_id === userId)
  confirmDialog.value = {
    title: 'Ban Member',
    message: `Are you sure you want to ban ${member?.profile.display_name ?? 'this member'}? They will not be able to rejoin.`,
    confirmLabel: 'Ban',
    danger: true,
    inputPlaceholder: 'Reason for ban (optional)',
    onConfirm: async (reason: string) => {
      confirmDialog.value = null
      await banMember(serverId.value, userId, reason || undefined)
      await fetchMembers(serverId.value)
      selectedMember.value = null
      toastStore.show('Member banned', 'success')
    },
  }
}

// ── Reactions ─────────────────────────────────────────────
function getReactionGroups(messageId: string): { emoji: string; count: number; iMine: boolean }[] {
  const reactions = reactionsStore.reactionsByMessage[messageId] ?? []
  const map = new Map<string, { count: number; iMine: boolean }>()
  for (const r of reactions) {
    const entry = map.get(r.emoji) ?? { count: 0, iMine: false }
    entry.count++
    if (r.user_id === authStore.user?.id) entry.iMine = true
    map.set(r.emoji, entry)
  }
  return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }))
}

async function handleToggleReaction(messageId: string, emoji: string) {
  emojiPickerForMsg.value = null
  pickerAnchorRect.value = null
  await toggleReaction(messageId, emoji)
}

// ── Pinning ───────────────────────────────────────────────
async function handlePinMessage(messageId: string) {
  if (!channelsStore.activeChannelId) return
  await pinMessage(channelsStore.activeChannelId, messageId)
  if (showPinnedPanel.value) await refreshPinnedPanel()
}

async function handleUnpinMessage(messageId: string) {
  if (!channelsStore.activeChannelId) return
  await unpinMessage(channelsStore.activeChannelId, messageId)
  if (showPinnedPanel.value) await refreshPinnedPanel()
}

async function refreshPinnedPanel() {
  if (!channelsStore.activeChannelId) return
  pinnedMessages.value = await fetchPinnedMessages(channelsStore.activeChannelId)
}

async function togglePinnedPanel() {
  showPinnedPanel.value = !showPinnedPanel.value
  if (showPinnedPanel.value) await refreshPinnedPanel()
}

// ── Context Menus ─────────────────────────────────────────
function onMessageContext(event: MouseEvent, msg: Message & { profile: Profile }) {
  const isAuthor = msg.author_id === authStore.user?.id
  contextMenuStore.show(event, messageContextItems(msg, {
    isAuthor,
    canModerate: canModerate.value,
    onReply: () => startReply(msg),
    onEdit: () => startEdit(msg),
    onDelete: () => handleDeleteMessage(msg.id),
    onPin: () => handlePinMessage(msg.id),
    onUnpin: () => handleUnpinMessage(msg.id),
    onCopyText: () => { navigator.clipboard.writeText(msg.content); toastStore.show('Copied to clipboard', 'success') },
    onCopyId: () => { navigator.clipboard.writeText(msg.id); toastStore.show('Message ID copied', 'success') },
    onAddReaction: () => {
      pickerAnchorRect.value = { top: event.clientY, right: window.innerWidth - event.clientX }
      emojiPickerForMsg.value = msg.id
    },
  }))
}

function onMemberContext(event: MouseEvent, member: Member & { profile: Profile }) {
  const isMe = member.user_id === authStore.user?.id
  contextMenuStore.show(event, memberContextItems(member, {
    isMe,
    canManageRoles: check(Permission.MANAGE_ROLES),
    onViewProfile: () => { selectedMember.value = member },
    onOpenDM: async () => {
      const groupId = await openDM(member.user_id)
      router.push(`/channels/@me/${groupId}`)
    },
    onCopyUsername: () => { navigator.clipboard.writeText(member.profile.username); toastStore.show('Username copied', 'success') },
    onEditStatusMessage: isMe ? () => {
      confirmDialog.value = {
        title: 'Edit Status Message',
        message: 'Set a custom status message visible to other members.',
        confirmLabel: 'Save',
        danger: false,
        inputPlaceholder: member.profile.status_text || 'What\'s on your mind?',
        onConfirm: async (input: string) => {
          confirmDialog.value = null
          await updateProfile({ status_text: input })
          await fetchMembers(serverId.value)
        },
      }
    } : undefined,
    onChangeRole: (role: MemberRole) => handleRoleChange(member.user_id, role),
    onKick: () => handleKick(member.user_id),
    onBan: () => handleBan(member.user_id),
  }))
}

function onChannelContext(event: MouseEvent, channel: Channel) {
  contextMenuStore.show(event, channelContextItems(channel, {
    canManage: canManageChannels.value,
    onEditChannel: () => openEditChannel(channel.id),
    onDeleteChannel: () => handleDeleteChannel(channel.id),
    onMarkRead: () => { markRead(channel.id); toastStore.show('Marked as read', 'info') },
    onCopyId: () => { navigator.clipboard.writeText(channel.id); toastStore.show('Channel ID copied', 'success') },
  }))
}

function onServerHeaderContext(event: MouseEvent) {
  contextMenuStore.show(event, serverHeaderContextItems({
    isOwner: isOwner.value,
    canManageChannels: canManageChannels.value,
    onInvite: () => { showInvite.value = true },
    onCreateChannel: () => { showCreateChannel.value = true },
    onCreateCategory: () => { showCreateCategory.value = true },
    onServerSettings: () => { router.push(`/servers/${serverId.value}/settings`) },
    onMarkAllRead: () => {
      channelsStore.channels.forEach((c) => markRead(c.id))
      refreshUnread(channelsStore.channels.map((c) => c.id))
      toastStore.show('All channels marked as read', 'info')
    },
    onLeave: () => handleLeaveServer(),
    onDelete: () => handleDeleteServer(),
  }))
}
</script>

<template>
  <AppShell>
    <template #sidebar-header>
      <div class="flex h-12 items-center justify-between border-b border-bg-tertiary px-4" @contextmenu.prevent="onServerHeaderContext($event)">
        <h2 class="truncate font-semibold">{{ currentServer?.name ?? 'Server' }}</h2>
        <div class="relative">
          <button
            @click="showServerActions = !showServerActions"
            class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
            </svg>
          </button>

          <div
            v-if="showServerActions"
            class="absolute right-0 top-8 z-40 w-48 rounded-lg bg-bg-primary p-1 shadow-lg"
          >
            <button
              @click="showInvite = true; showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Invite People
            </button>
            <button
              v-if="canManageChannels"
              @click="showCreateChannel = true; showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Create Channel
            </button>
            <button
              v-if="canManageChannels"
              @click="showCreateCategory = true; showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Create Category
            </button>
            <button
              v-if="canManageChannels"
              @click="router.push(`/servers/${serverId}/settings`); showServerActions = false"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-text-primary hover:bg-bg-hover"
            >
              Server Settings
            </button>
            <template v-if="isOwner">
              <div class="my-1 h-px bg-bg-tertiary" />
              <button
                @click="handleDeleteServer(); showServerActions = false"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Delete Server
              </button>
            </template>
            <template v-else>
              <div class="my-1 h-px bg-bg-tertiary" />
              <button
                @click="handleLeaveServer(); showServerActions = false"
                class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-danger hover:bg-danger/10"
              >
                Leave Server
              </button>
            </template>
          </div>

          <div v-if="showServerActions" class="fixed inset-0 z-30" @click="showServerActions = false" />
        </div>
      </div>
    </template>

    <template #sidebar-content>
      <div class="space-y-0.5">
        <!-- Uncategorized channels (category_id = null) -->
        <router-link
          v-for="channel in channelsStore.channels.filter(c => c.category_id === null).sort((a,b) => a.position - b.position)"
          :key="channel.id"
          :to="`/channels/${serverId}/${channel.id}`"
          :draggable="canManageChannels"
          @contextmenu.prevent="onChannelContext($event, channel)"
          @dragstart.stop="onChannelDragStart(channel.id)"
          @dragover.prevent.stop="onChannelDragOver(channel.id)"
          @dragleave.stop="onChannelDragLeave"
          @drop.prevent.stop="onChannelDrop(channel.id)"
          @dragend.stop="onChannelDragEnd"
          class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-bg-hover"
          :class="[
            channelsStore.activeChannelId === channel.id ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary',
            dragOverChannelId === channel.id ? 'border-t-2 border-accent' : '',
            canManageChannels ? 'cursor-grab' : '',
          ]"
        >
          <span class="text-text-muted">#</span>
          <span class="truncate flex-1">{{ channel.name }}</span>
          <span
            v-if="unreadChannelIds.has(channel.id)"
            class="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-white"
          />
        </router-link>

        <!-- Categories -->
        <div v-for="cat in categoriesStore.categories" :key="cat.id" class="mt-2">
          <!-- Category header -->
          <div
            class="group flex items-center gap-1 rounded px-1 py-0.5 transition-colors"
            :class="dragOverCategoryId === cat.id ? 'bg-accent/20 outline outline-1 outline-accent' : ''"
            @contextmenu.prevent="onCategoryContext($event, cat)"
            @dragover.prevent="onCategoryDragOver(cat.id)"
            @dragleave="onCategoryDragLeave"
            @drop.prevent="onCategoryDrop(cat.id)"
          >
            <template v-if="renamingCategoryId === cat.id">
              <input
                v-model="renamingCategoryName"
                @keydown.enter.prevent="submitCategoryRename"
                @keydown.escape="cancelCategoryRename"
                @blur="submitCategoryRename"
                class="flex-1 rounded border border-accent bg-bg-primary px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-primary outline-none"
                autofocus
              />
            </template>
            <template v-else>
              <button
                @click="toggleCategory(cat.id)"
                class="flex flex-1 items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-text-muted hover:text-text-primary"
              >
                <svg
                  class="h-2.5 w-2.5 flex-shrink-0 transition-transform"
                  :class="collapsedCategories.has(cat.id) ? '-rotate-90' : ''"
                  viewBox="0 0 24 24" fill="currentColor"
                >
                  <path d="M7 10l5 5 5-5z"/>
                </svg>
                {{ cat.name }}
              </button>
              <button
                v-if="canManageChannels"
                @click="handleDeleteCategory(cat.id)"
                class="hidden rounded p-0.5 text-text-muted hover:text-danger group-hover:block"
                title="Delete category"
              >
                <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </template>
          </div>
          <!-- Channels in this category -->
          <template v-if="!collapsedCategories.has(cat.id)">
            <router-link
              v-for="channel in channelsStore.channels.filter(c => c.category_id === cat.id).sort((a,b) => a.position - b.position)"
              :key="channel.id"
              :to="`/channels/${serverId}/${channel.id}`"
              :draggable="canManageChannels"
              @contextmenu.prevent="onChannelContext($event, channel)"
              @dragstart.stop="onChannelDragStart(channel.id)"
              @dragover.prevent.stop="onChannelDragOver(channel.id)"
              @dragleave.stop="onChannelDragLeave"
              @drop.prevent.stop="onChannelDrop(channel.id)"
              @dragend.stop="onChannelDragEnd"
              class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-bg-hover"
              :class="[
                channelsStore.activeChannelId === channel.id ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary',
                dragOverChannelId === channel.id ? 'border-t-2 border-accent' : '',
                canManageChannels ? 'cursor-grab' : '',
              ]"
            >
              <span class="text-text-muted">#</span>
              <span class="truncate flex-1">{{ channel.name }}</span>
              <span
                v-if="unreadChannelIds.has(channel.id)"
                class="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-white"
              />
            </router-link>
          </template>
        </div>
      </div>
    </template>

    <template #top-bar>
      <header class="flex h-12 items-center gap-2 border-b border-bg-tertiary bg-bg-primary px-4">
        <span class="text-text-muted">#</span>
        <span class="font-semibold text-text-primary">{{ activeChannel?.name ?? 'general' }}</span>
        <span v-if="activeChannel?.description" class="ml-1 text-text-muted/50">·</span>
        <span
          v-if="activeChannel?.description"
          class="truncate text-sm text-text-muted"
          :title="activeChannel.description"
        >
          {{ activeChannel.description }}
        </span>
        <div class="ml-auto flex items-center gap-1">
          <button
            @click="searchOpen ? closeSearch() : openSearch()"
            :class="searchOpen ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
            class="rounded p-1.5"
            title="Search Messages"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <button
            @click="togglePinnedPanel"
            :class="showPinnedPanel ? 'text-text-primary bg-bg-hover' : 'text-text-muted hover:text-text-primary hover:bg-bg-hover'"
            class="rounded p-1.5"
            title="Pinned Messages"
          >
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
            </svg>
          </button>
        </div>
      </header>
    </template>

    <!-- Message list -->
    <div ref="messageListEl" class="flex flex-1 flex-col overflow-y-auto px-4 py-4">
      <!-- Empty state -->
      <div v-if="messages.length === 0" class="flex flex-1 flex-col items-center justify-center py-16 text-center">
        <div class="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-bg-tertiary">
          <span class="text-2xl text-text-muted">#</span>
        </div>
        <h2 class="mb-1 text-xl font-bold">Welcome to #{{ activeChannel?.name ?? 'general' }}</h2>
        <p class="max-w-md text-text-secondary">
          This is the start of the #{{ activeChannel?.name ?? 'general' }} channel.
          {{ activeChannel?.description || 'Send a message to get started!' }}
        </p>
      </div>

      <!-- Messages -->
      <div v-else class="flex flex-col gap-0.5">
        <template v-for="msg in groupedMessages" :key="msg.id">
          <!-- Date separator -->
          <div v-if="msg.dateSeparator" class="my-4 flex items-center gap-3">
            <div class="h-px flex-1 bg-bg-tertiary" />
            <span class="text-xs text-text-muted">{{ msg.dateSeparator }}</span>
            <div class="h-px flex-1 bg-bg-tertiary" />
          </div>

          <!-- Message row -->
          <div
            :data-message-id="msg.id"
            class="group relative flex gap-3 rounded px-2 py-0.5 transition-colors hover:bg-bg-secondary"
            :class="msg.showHeader ? 'mt-3' : ''"
            @contextmenu.prevent="onMessageContext($event, msg)"
          >
            <!-- Avatar (only on first in group) -->
            <div class="w-10 flex-shrink-0">
              <UserAvatar
                v-if="msg.showHeader"
                :src="msg.profile.avatar_url"
                :alt="msg.profile.display_name"
                size="sm"
              />
            </div>

            <div class="min-w-0 flex-1">
              <!-- Reply quote -->
              <div
                v-if="msg.reply_to_id"
                class="mb-1 flex cursor-default items-center gap-1.5 text-xs text-text-muted"
              >
                <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
                <span class="font-medium text-text-secondary">{{ getMessageById(msg.reply_to_id)?.profile.display_name ?? 'Unknown' }}</span>
                <span class="truncate">{{ getMessageById(msg.reply_to_id)?.content ?? '[deleted]' }}</span>
              </div>

              <!-- Header (only on first in group) -->
              <div v-if="msg.showHeader" class="mb-0.5 flex items-baseline gap-2">
                <span class="font-semibold text-text-primary">{{ msg.profile.display_name }}</span>
                <span class="text-xs text-text-muted">{{ formatTime(msg.created_at) }}</span>
              </div>

              <!-- Edit mode -->
              <div v-if="editingId === msg.id" class="flex gap-2">
                <input
                  v-model="editingContent"
                  @keydown.enter.prevent="submitEdit"
                  @keydown.escape="cancelEdit"
                  class="flex-1 rounded border border-accent bg-bg-primary px-2 py-1 text-sm text-text-primary outline-none"
                  autofocus
                />
                <button @click="submitEdit" class="rounded bg-accent px-2 py-1 text-xs text-white">Save</button>
                <button @click="cancelEdit" class="rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary">Cancel</button>
              </div>

              <!-- Content -->
              <p
                v-else
                class="break-words text-sm text-text-primary leading-relaxed"
                v-html="renderMessage(msg.content, myUsername) + (msg.edited_at ? ' <span class=\'text-xs text-text-muted\'>(edited)</span>' : '')"
              />

              <!-- Reaction pills -->
              <div
                v-if="getReactionGroups(msg.id).length > 0"
                class="mt-1 flex flex-wrap gap-1"
              >
                <button
                  v-for="group in getReactionGroups(msg.id)"
                  :key="group.emoji"
                  @click="handleToggleReaction(msg.id, group.emoji)"
                  class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition-colors"
                  :class="group.iMine
                    ? 'border-accent bg-accent/20 text-accent'
                    : 'border-bg-tertiary bg-bg-secondary text-text-secondary hover:border-accent/50'"
                >
                  <span>{{ group.emoji }}</span>
                  <span>{{ group.count }}</span>
                </button>
              </div>
            </div>

            <!-- Hover actions -->
            <div
              v-if="editingId !== msg.id"
              class="absolute right-2 top-0 hidden -translate-y-1/2 items-center gap-1 rounded border border-bg-tertiary bg-bg-primary p-0.5 shadow group-hover:flex"
            >
              <!-- Emoji picker trigger -->
              <button
                @click.stop="openEmojiPicker(msg.id, $event)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                title="Add Reaction"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
                </svg>
              </button>
              <button
                @click="startReply(msg)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                title="Reply"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
                </svg>
              </button>
              <!-- Pin/unpin (moderator+) -->
              <button
                v-if="canModerate"
                @click="msg.is_pinned ? handleUnpinMessage(msg.id) : handlePinMessage(msg.id)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                :title="msg.is_pinned ? 'Unpin' : 'Pin'"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" :class="msg.is_pinned ? 'text-accent' : ''">
                  <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/>
                </svg>
              </button>
              <button
                v-if="msg.author_id === authStore.user?.id"
                @click="startEdit(msg)"
                class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
                title="Edit"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button
                v-if="msg.author_id === authStore.user?.id || canModerate"
                @click="handleDeleteMessage(msg.id)"
                class="rounded p-1 text-text-muted hover:bg-danger/10 hover:text-danger"
                title="Delete"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                  <path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>

            <!-- Timestamp on hover (for collapsed messages) -->
            <span
              v-if="!msg.showHeader && editingId !== msg.id"
              class="absolute left-2 hidden text-xs text-text-muted group-hover:block"
              style="top: 50%; transform: translateY(-50%)"
            >
              {{ formatTime(msg.created_at) }}
            </span>
          </div>
        </template>
      </div>
    </div>

    <template #input>
      <div class="px-4 pb-4">
        <!-- Reply bar -->
        <div
          v-if="replyingTo"
          class="mb-1 flex items-center gap-2 rounded-t-lg bg-bg-secondary px-4 py-2 text-xs text-text-muted"
        >
          <svg class="h-3 w-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/>
          </svg>
          <span>Replying to <span class="font-medium text-text-primary">{{ replyingTo.profile.display_name }}</span></span>
          <span class="flex-1 truncate text-text-muted">{{ replyingTo.content }}</span>
          <button @click="replyingTo = null" class="ml-auto flex-shrink-0 hover:text-text-primary">✕</button>
        </div>
        <!-- Typing indicator -->
        <div v-if="typingUsers.length > 0" class="px-1 pb-1 text-xs text-text-muted">
          <span class="font-medium text-text-secondary">{{ typingUsers.join(', ') }}</span>
          {{ typingUsers.length === 1 ? 'is' : 'are' }} typing
          <span class="animate-pulse">...</span>
        </div>
        <form @submit.prevent="handleSendMessage" class="flex items-center gap-2 rounded-lg bg-bg-tertiary px-4 py-3" :class="replyingTo ? 'rounded-t-none' : ''">
          <!-- Emoji drawer button -->
          <button
            type="button"
            @click="openEmojiDrawer($event)"
            :class="emojiDrawerOpen ? 'text-accent' : 'text-text-muted hover:text-text-primary'"
            class="flex-shrink-0 rounded p-1 transition-colors"
            title="Emoji"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
              <circle cx="12" cy="12" r="10"/>
              <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              <line x1="9" y1="9" x2="9.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
              <line x1="15" y1="9" x2="15.01" y2="9" stroke-linecap="round" stroke-width="2.5"/>
            </svg>
          </button>
          <input
            ref="messageInputEl"
            v-model="messageInput"
            type="text"
            :placeholder="slowmodeRemaining > 0 ? `Slowmode active — wait ${slowmodeRemaining}s` : `Message #${activeChannel?.name ?? 'general'}`"
            :disabled="!activeChannel || slowmodeRemaining > 0"
            class="flex-1 bg-transparent text-text-primary placeholder-text-muted outline-none disabled:cursor-not-allowed disabled:opacity-60"
            @keydown.enter.prevent="handleSendMessage"
            @input="onTyping"
          />
          <button
            type="submit"
            :disabled="!messageInput.trim() || sending || !activeChannel || slowmodeRemaining > 0"
            class="min-w-8 rounded p-1 text-text-muted transition-colors hover:text-text-primary disabled:opacity-30"
          >
            <span v-if="slowmodeRemaining > 0" class="text-xs font-medium tabular-nums text-text-muted">{{ slowmodeRemaining }}s</span>
            <svg v-else class="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </form>
      </div>
    </template>

    <template #members>
      <!-- Search panel -->
      <MessageSearch
        v-if="searchOpen"
        v-model:query="searchQuery"
        :results="searchResults"
        @close="closeSearch"
        @select="(id: string) => { closeSearch(); scrollToMessage(id) }"
      />

      <!-- Pinned messages panel (replaces member list when open) -->
      <div v-else-if="showPinnedPanel" class="flex h-full flex-col">
        <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
          <h3 class="text-sm font-semibold">Pinned Messages</h3>
          <button @click="showPinnedPanel = false" class="text-text-muted hover:text-text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-3">
          <p v-if="pinnedMessages.length === 0" class="text-center text-sm text-text-muted py-6">
            No pinned messages yet.
          </p>
          <div v-else class="space-y-3">
            <div
              v-for="pm in pinnedMessages"
              :key="pm.id"
              class="rounded-lg border border-bg-tertiary bg-bg-primary p-3"
            >
              <div class="mb-1 flex items-center gap-2">
                <UserAvatar :src="pm.profile.avatar_url" :alt="pm.profile.display_name" size="sm" />
                <span class="text-xs font-semibold text-text-primary">{{ pm.profile.display_name }}</span>
                <span class="ml-auto text-xs text-text-muted">{{ formatTime(pm.created_at) }}</span>
              </div>
              <p class="break-words text-xs text-text-secondary leading-relaxed" v-html="renderMessage(pm.content, myUsername)" />
              <button
                v-if="canModerate"
                @click="handleUnpinMessage(pm.id)"
                class="mt-2 text-xs text-text-muted hover:text-danger"
              >
                Unpin
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Default member list -->
      <div v-else class="p-4">
        <div v-for="group in memberRoleGroups" :key="group.role" class="mb-3">
          <h3 class="mb-1 text-xs font-semibold uppercase text-text-muted">
            {{ group.label }} — {{ group.members.length }}
          </h3>
          <div class="space-y-0.5">
            <button
              v-for="member in group.members"
              :key="member.user_id"
              @click="selectedMember = member"
              @contextmenu.prevent="onMemberContext($event, member)"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 hover:bg-bg-hover text-left"
              :class="selectedMember?.user_id === member.user_id ? 'bg-bg-hover' : ''"
            >
              <UserAvatar
                :src="member.profile.avatar_url"
                :alt="member.profile.display_name"
                :status="member.profile.status"
                size="sm"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium">{{ member.profile.display_name }}</p>
                <p v-if="member.profile.status_text" class="truncate text-xs text-text-muted">{{ member.profile.status_text }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </template>
  </AppShell>

  <!-- Close emoji picker on outside click -->
  <div
    v-if="emojiPickerForMsg"
    class="fixed inset-0 z-40"
    @click="emojiPickerForMsg = null"
  />

  <!-- Member profile modal -->
  <div
    v-if="selectedMember"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
    @click.self="selectedMember = null"
  >
    <div class="w-full max-w-sm rounded-lg bg-bg-secondary shadow-xl overflow-hidden">
      <!-- Header band -->
      <div class="h-16 bg-accent/30" />
      <!-- Avatar overlapping the band -->
      <div class="relative px-5 pb-5">
        <div class="-mt-8 mb-3 flex items-end justify-between">
          <UserAvatar
            :src="selectedMember.profile.avatar_url"
            :alt="selectedMember.profile.display_name"
            :status="selectedMember.profile.status"
            size="lg"
          />
          <button @click="selectedMember = null" class="mb-1 rounded p-1 text-text-muted hover:text-text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <p class="text-lg font-bold">{{ selectedMember.profile.display_name }}</p>
        <p class="mb-1 text-sm text-text-muted">@{{ selectedMember.profile.username }}</p>
        <span class="inline-block rounded px-2 py-0.5 text-xs font-medium"
          :class="{
            'bg-accent/20 text-accent': selectedMember.role === 'owner',
            'bg-success/20 text-success': selectedMember.role === 'admin',
            'bg-presence-idle/20 text-presence-idle': selectedMember.role === 'moderator',
            'bg-bg-tertiary text-text-muted': selectedMember.role === 'member',
          }"
        >{{ selectedMember.role }}</span>

        <div v-if="selectedMember.profile.bio" class="mt-3 border-t border-bg-tertiary pt-3">
          <p class="text-xs font-semibold uppercase text-text-muted">About Me</p>
          <p class="mt-1 text-sm text-text-secondary">{{ selectedMember.profile.bio }}</p>
        </div>

        <div v-if="selectedMember.profile.status_text" class="mt-2">
          <p class="text-xs text-text-muted">{{ selectedMember.profile.status_text }}</p>
        </div>

        <!-- Send Message button (non-self) -->
        <button
          v-if="selectedMember.user_id !== authStore.user?.id"
          @click="async () => { const gid = await openDM(selectedMember!.user_id); selectedMember = null; router.push(`/channels/@me/${gid}`) }"
          class="mt-3 w-full rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-hover"
        >
          Send Message
        </button>

        <!-- Role management (owner/admin only, not for self) -->
        <div v-if="canChangeRole(selectedMember)" class="mt-4 border-t border-bg-tertiary pt-4">
          <label class="mb-1 block text-xs font-semibold uppercase text-text-muted">Role</label>
          <select
            :value="selectedMember.role"
            @change="handleRoleChange(selectedMember!.user_id, ($event.target as HTMLSelectElement).value as MemberRole)"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent"
          >
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
            <option v-if="isOwner" value="owner">Owner</option>
          </select>
        </div>

        <!-- Kick / Ban buttons (moderators+, not for self) -->
        <div v-if="(canKick || canBan) && selectedMember.user_id !== authStore.user?.id" class="mt-3 flex gap-2">
          <button
            @click="handleKick(selectedMember!.user_id)"
            class="flex-1 rounded bg-bg-tertiary px-3 py-2 text-sm font-medium text-text-secondary hover:bg-bg-hover"
          >
            Kick
          </button>
          <button
            @click="handleBan(selectedMember!.user_id)"
            class="flex-1 rounded bg-danger/10 px-3 py-2 text-sm font-medium text-danger hover:bg-danger/20"
          >
            Ban
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Create Channel Dialog -->
  <div v-if="showCreateChannel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCreateChannel = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create Channel</h2>
      <form @submit.prevent="handleCreateChannel" class="space-y-4">
        <div>
          <label for="channel-name" class="mb-1 block text-sm text-text-secondary">Channel Name</label>
          <input
            id="channel-name"
            v-model="newChannelName"
            type="text"
            required
            maxlength="50"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="new-channel"
          />
        </div>
        <div v-if="categoriesStore.categories.length > 0">
          <label for="channel-category" class="mb-1 block text-sm text-text-secondary">Category (optional)</label>
          <select
            id="channel-category"
            v-model="newChannelCategoryId"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          >
            <option :value="null">No category</option>
            <option v-for="cat in categoriesStore.categories" :key="cat.id" :value="cat.id">
              {{ cat.name }}
            </option>
          </select>
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showCreateChannel = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" :disabled="!newChannelName.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Create Category Dialog -->
  <div v-if="showCreateCategory" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showCreateCategory = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Create Category</h2>
      <form @submit.prevent="handleCreateCategory" class="space-y-4">
        <div>
          <label for="category-name" class="mb-1 block text-sm text-text-secondary">Category Name</label>
          <input
            id="category-name"
            v-model="newCategoryName"
            type="text"
            required
            maxlength="50"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="TEXT CHANNELS"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showCreateCategory = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" :disabled="!newCategoryName.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Create</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Edit Channel Dialog -->
  <div v-if="showEditChannel" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showEditChannel = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Edit Channel</h2>
      <form @submit.prevent="handleEditChannel" class="space-y-4">
        <div>
          <label for="edit-channel-name" class="mb-1 block text-sm text-text-secondary">Channel Name</label>
          <input
            id="edit-channel-name"
            v-model="editChannelName"
            type="text"
            required
            maxlength="50"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div>
          <label for="edit-channel-desc" class="mb-1 block text-sm text-text-secondary">Description</label>
          <input
            id="edit-channel-desc"
            v-model="editChannelDescription"
            type="text"
            maxlength="200"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            placeholder="What's this channel about?"
          />
        </div>
        <div>
          <label for="edit-channel-slowmode" class="mb-1 block text-sm text-text-secondary">Slowmode (seconds, 0 = off)</label>
          <input
            id="edit-channel-slowmode"
            v-model.number="editChannelSlowmode"
            type="number"
            min="0"
            max="3600"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" @click="showEditChannel = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          <button type="submit" :disabled="!editChannelName.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Save</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Invite Dialog -->
  <div v-if="showInvite" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showInvite = false">
    <div class="w-full max-w-md rounded-lg bg-bg-secondary p-6">
      <h2 class="mb-4 text-xl font-bold">Invite People</h2>
      <p class="mb-2 text-sm text-text-secondary">Share this invite code with others:</p>
      <div class="flex items-center gap-2">
        <input
          :value="inviteCode"
          readonly
          class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-text-primary"
        />
        <button @click="copyInviteCode" class="rounded bg-accent px-3 py-2 text-sm text-white hover:bg-accent-hover">Copy</button>
      </div>
      <button
        v-if="isOwner"
        @click="handleRegenerateInvite"
        class="mt-2 text-sm text-text-muted hover:text-text-primary"
      >
        Regenerate code
      </button>
      <div class="mt-4 flex justify-end">
        <button @click="showInvite = false" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Close</button>
      </div>
    </div>
  </div>

  <!-- Full emoji drawer (input bar) -->
  <Teleport to="body">
    <div
      v-if="emojiDrawerOpen"
      class="fixed z-[9997]"
      :style="{ bottom: emojiDrawerAnchor ? emojiDrawerAnchor.bottom + 'px' : '80px', right: emojiDrawerAnchor ? emojiDrawerAnchor.right + 'px' : '16px' }"
      @click.stop
    >
      <EmojiPicker @select="insertEmoji" />
    </div>
    <div
      v-if="emojiDrawerOpen"
      class="fixed inset-0 z-[9996]"
      @click="emojiDrawerOpen = false"
    />
  </Teleport>

  <!-- Reaction emoji picker (teleported to body to escape overflow containers) -->
  <Teleport to="body">
    <div
      v-if="emojiPickerForMsg && pickerAnchorRect"
      class="fixed z-[9999] flex gap-1 rounded-lg border border-bg-tertiary bg-bg-primary p-1.5 shadow-lg"
      :style="{ top: pickerAnchorRect.top + 'px', right: pickerAnchorRect.right + 'px' }"
      @click.stop
    >
      <button
        v-for="emoji in QUICK_EMOJIS"
        :key="emoji"
        @click="handleToggleReaction(emojiPickerForMsg!, emoji)"
        class="rounded p-1 text-base hover:bg-bg-hover"
        :title="emoji"
      >{{ emoji }}</button>
    </div>
    <div
      v-if="emojiPickerForMsg"
      class="fixed inset-0 z-[9998]"
      @click="emojiPickerForMsg = null; pickerAnchorRect = null"
    />
  </Teleport>

  <!-- Confirm dialog -->
  <ConfirmDialog
    v-if="confirmDialog"
    :title="confirmDialog.title"
    :message="confirmDialog.message"
    :confirm-label="confirmDialog.confirmLabel"
    :danger="confirmDialog.danger"
    :require-input="confirmDialog.requireInput"
    :input-placeholder="confirmDialog.inputPlaceholder"
    @confirm="confirmDialog.onConfirm"
    @cancel="confirmDialog = null"
  />
</template>
