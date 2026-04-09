<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed, defineAsyncComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppShell from '@/components/layout/AppShell.vue'
import UserAvatar from '@/components/user/UserAvatar.vue'
import EmojiPickerPopover from '@/components/ui/EmojiPickerPopover.vue'
import ChannelListItem from '@/components/channel/ChannelListItem.vue'
import ChannelHeader from '@/components/channel/ChannelHeader.vue'
import ForumHeaderComp from '@/components/forum/ForumHeader.vue'
import ForumPostHeader from '@/components/forum/ForumPostHeader.vue'
import MessageBubble from '@/components/chat/MessageBubble.vue'
import MessageInputArea from '@/components/chat/MessageInputArea.vue'
import MemberList from '@/components/chat/MemberList.vue'
import MemberProfilePanel from '@/components/user/MemberProfilePanel.vue'
import CreateChannelDialog from '@/components/channel/CreateChannelDialog.vue'
import EditChannelDialog from '@/components/channel/EditChannelDialog.vue'
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
import PollCard from '@/components/chat/PollCard.vue'
const ReportDialog = defineAsyncComponent(() => import('@/components/moderation/ReportDialog.vue'))
const CreateForumPostDialog = defineAsyncComponent(() => import('@/components/forum/CreateForumPostDialog.vue'))
const ForumPostView = defineAsyncComponent(() => import('@/components/forum/ForumPostView.vue'))
const ForumCommentsPanel = defineAsyncComponent(() => import('@/components/forum/ForumCommentsPanel.vue'))
const CreatePollDialog = defineAsyncComponent(() => import('@/components/chat/CreatePollDialog.vue'))
const EventsPanel = defineAsyncComponent(() => import('@/components/community/EventsPanel.vue'))
const PinnedMessagesPanel = defineAsyncComponent(() => import('@/components/chat/PinnedMessagesPanel.vue'))
import { useRoles } from '@/composables/useRoles'
import { usePermissions } from '@/composables/usePermissions'
import { useMutes } from '@/composables/useMutes'
import { useMutesStore } from '@/stores/mutes'
import { usePolls } from '@/composables/usePolls'
import { useEvents } from '@/composables/useEvents'
import { Permission } from '@/lib/permissions'
import { checkAutomod } from '@/lib/automod'
import { expandShortcodes } from '@/lib/emojiNames'
import { backend, isLocalMode } from '@/lib/backend'
import { formatDate } from '@/lib/formatters'
import { useRealtime } from '@/composables/useRealtime'
import { usePresenceStore } from '@/stores/presence'
import type { Message, Profile, Member, MemberRole, Channel, ChannelCategory, AutomodRule, RsvpStatus, UserStatus, NotificationLevel, Attachment, ForumPost, ForumPostType } from '@/lib/types'
import { useNotificationPreferences } from '@/composables/useNotificationPreferences'

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
const { fetchMessages, fetchOlderMessages, loadingOlder, sendMessage, editMessage, deleteMessage, pinMessage, unpinMessage, fetchPinnedMessages } = useMessages()
const { fetchReactionsForChannel, toggleReaction } = useReactions()
const reactionsStore = useReactionsStore()
const toastStore = useToastStore()
const contextMenuStore = useContextMenuStore()
const { fetchMutes, muteMember } = useMutes()
const mutesStore = useMutesStore()
const { polls, fetchPolls, createPoll, vote: votePoll, closePoll } = usePolls()
const { events, rsvpsByEvent, fetchEvents, createEvent, rsvp: rsvpEvent, loadRsvps } = useEvents()
const { openDM } = useDMs()
const { updateProfile } = useProfile()
const { typingUsers, onTyping: localOnTyping, onSent: localOnSent, startListening, stopListening } = useTyping(
  () => channelsStore.activeChannelId,
  () => myMember.value?.profile.display_name ?? authStore.user?.email?.split('@')[0] ?? 'Someone',
)
const { startMessages, stopMessages, startPresence, startTypingChannel, broadcastTyping, broadcastStopTyping, stopTypingChannel, stopAll } = useRealtime()
const presenceStore = usePresenceStore()
const realtimeTypingUsers = ref<string[]>([])
const { unreadChannelIds, markRead, refreshUnread } = useUnread()
const { scanForMentions, clearServerMentions, requestPermission, getUsername } = useMentions()
const activeChannelIdRef = computed(() => channelsStore.activeChannelId ?? '')
const { query: searchQuery, results: searchResults, isOpen: searchOpen, open: openSearch, close: closeSearch } = useMessageSearch(activeChannelIdRef)

const myUsername = ref<string | null>(null)

// Notification preferences
const { getCached, loadLevel, setLevel } = useNotificationPreferences()
const notifPopoverChannelId = ref<string | null>(null)
const NOTIF_OPTIONS: { value: NotificationLevel; label: string }[] = [
  { value: 'all', label: 'All Messages' },
  { value: 'mentions', label: 'Mentions Only' },
  { value: 'none', label: 'Nothing' },
]

function openNotifPopover(channelId: string) {
  notifPopoverChannelId.value = notifPopoverChannelId.value === channelId ? null : channelId
  if (authStore.user?.id) loadLevel(authStore.user.id, channelId).catch(() => {})
}

async function setChannelNotifLevel(channelId: string, level: NotificationLevel) {
  if (!authStore.user?.id) return
  await setLevel(authStore.user.id, channelId, level)
  notifPopoverChannelId.value = null
}

const showCreateChannel = ref(false)
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

// Report dialog
const showReportDialog = ref(false)
const reportDialogType = ref<'message' | 'user'>('message')
const reportDialogTargetId = ref('')

// Automod rules (loaded once per server)
const automodRules = ref<AutomodRule[]>([])

// Engagement panels
const showPollsPanel = ref(false)
const showEventsPanel = ref(false)
const showCreatePoll = ref(false)

// Forum
const forumPosts = ref<(ForumPost & { created_by_profile: Profile })[]>([])
const activeView = ref<'channel' | 'forum' | 'forum-post'>('channel')
const activeForumPostId = ref<string | null>(null)
const showForumPostDialog = ref(false)
const pendingForumMsg = ref<(Message & { profile: Profile }) | null>(null)

type FPVRef = {
  post: { title: string; type: string; created_by: string } | null
  editingTitle: string
  editingPage: boolean
  isPageType: boolean
  canEdit: boolean
  savingPage: boolean
  savePage: () => Promise<void>
  cancelEdit: () => void
  handleDeletePost: () => Promise<void>
  startEditing: () => void
}
const forumPostViewRef = ref<FPVRef | null>(null)
const forumCommentsPanelRef = ref<{ count: number } | null>(null)
const showForumComments = computed(() => activeView.value === 'forum-post' && !!forumPostViewRef.value?.isPageType)
const defaultChannelId = computed(() =>
  channelsStore.channels.find((c) => c.is_default)?.id ?? channelsStore.channels[0]?.id ?? serverId.value
)

// Announcement space: only MANAGE_MESSAGES holders can post
const isAnnouncementSpace = computed(() => currentServer.value?.space_type === 'announcement')
const canPostInChannel = computed(() => !isAnnouncementSpace.value || canModerate.value)

// Real-time typing: use Supabase Broadcast in Supabase mode, localStorage events in local mode
const displayTypingUsers = computed(() => isLocalMode ? typingUsers.value : realtimeTypingUsers.value)

const serverId = ref('')
const channelId = ref('')

const messageInput = ref('')
const sending = ref(false)
const messageListEl = ref<HTMLElement | null>(null)
const pendingAttachments = ref<Attachment[]>([])
const uploadingFiles = ref(false)


const editingId = ref<string | null>(null)
const editingContent = ref('')

const replyingTo = ref<(Message & { profile: Profile }) | null>(null)

// Emoji picker

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
  channelId.value = (route.params.channelId as string) ?? ''
  serversStore.activeServerId = serverId.value

  const postId = route.params.postId as string | undefined
  if (postId) {
    activeView.value = 'forum-post'
    activeForumPostId.value = postId
  }

  if (serverId.value) {
    collapsedCategories.value = loadCollapsedCategories(serverId.value)
    fetchChannels(serverId.value)
    fetchCategories(serverId.value)
    backend.forum.listBySpace(serverId.value).then((posts) => { forumPosts.value = posts }).catch(() => {})
    fetchMembers(serverId.value).then(() => {
      if (authStore.user?.id) {
        fetchServerRoles(serverId.value)
        fetchUserRoles(serverId.value, authStore.user.id)
        if (!isLocalMode) {
          const displayName = myMember.value?.profile.display_name ?? authStore.user.email?.split('@')[0] ?? 'Someone'
          startPresence(serverId.value, authStore.user.id, displayName, 'online')
        }
      }
    })
    fetchMutes(serverId.value).catch(() => {})
    backend.automod_rules.list(serverId.value).then((rules) => { automodRules.value = rules }).catch(() => {})
    fetchEvents(serverId.value).catch(() => {})
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
  stopAll()
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

watch(() => route.params.postId, (postId) => {
  if (postId) {
    activeView.value = 'forum-post'
    activeForumPostId.value = postId as string
  }
})

// Load messages and mark as read when active channel changes
watch(() => channelsStore.activeChannelId, (id) => {
  if (id && id !== serverId.value) {
    activeView.value = 'channel'
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
    fetchPolls(id).catch(() => {})
    if (!isLocalMode) {
      stopMessages()
      stopTypingChannel()
      realtimeTypingUsers.value = []
      startMessages(id)
      startTypingChannel(id, (names) => { realtimeTypingUsers.value = names })
    }
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

const hasMoreMessages = computed(() => {
  const id = channelsStore.activeChannelId
  return id ? (messagesStore.paginationByChannel[id]?.hasMore ?? false) : false
})

async function loadOlderMessages() {
  const id = channelsStore.activeChannelId
  if (!id || loadingOlder.value) return
  const el = messageListEl.value
  const prevScrollHeight = el?.scrollHeight ?? 0
  await fetchOlderMessages(id)
  nextTick(() => {
    if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
  })
}

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

watch(messages, () => { if (!loadingOlder.value) scrollToBottom() })

async function handleSendMessage() {
  const content = expandShortcodes(messageInput.value.trim())
  const hasAttachments = pendingAttachments.value.length > 0
  if ((!content && !hasAttachments) || sending.value || uploadingFiles.value || !channelsStore.activeChannelId || !authStore.user?.id || slowmodeRemaining.value > 0) return
  if (!canPostInChannel.value) return

  // Check if user is muted
  if (mutesStore.isMuted(serverId.value, authStore.user.id)) {
    toastStore.show('You are muted and cannot send messages.', 'error')
    return
  }

  // Run automod check
  if (automodRules.value.length > 0) {
    const automodResult = checkAutomod(content, automodRules.value)
    if (automodResult) {
      if (automodResult.action === 'delete') {
        toastStore.show(`Message blocked: ${automodResult.details}`, 'error')
        return
      }
      if (automodResult.action === 'mute' && authStore.user?.id) {
        toastStore.show(`Message blocked and you have been muted: ${automodResult.details}`, 'error')
        muteMember(serverId.value, authStore.user.id, `Automod: ${automodResult.details}`).catch(() => {})
        return
      }
      // 'flag' action: send but auto-report
      if (automodResult.action === 'flag') {
        toastStore.show(`Your message was flagged for review: ${automodResult.details}`, 'error')
        // still allow send, report is created below after we get the message
      }
    }
  }

  sending.value = true
  try {
    messageInput.value = ''
    localOnSent()
    if (!isLocalMode && authStore.user?.id) {
      broadcastStopTyping(authStore.user.id, myMember.value?.profile.display_name ?? 'Someone')
    }
    const toSend = pendingAttachments.value.length > 0 ? [...pendingAttachments.value] : undefined
    pendingAttachments.value = []
    await sendMessage(channelsStore.activeChannelId, authStore.user.id, content, replyingTo.value?.id, toSend)
    replyingTo.value = null

    const slowmode = activeChannel.value?.slowmode_seconds ?? 0
    if (slowmode > 0) startSlowmode(slowmode)
  } finally {
    sending.value = false
  }
}

async function uploadAttachments(files: File[] | FileList) {
  if (!authStore.user?.id || !files.length) return
  uploadingFiles.value = true
  try {
    for (const file of Array.from(files)) {
      const { publicUrl } = await backend.messages.upload(file, authStore.user.id)
      pendingAttachments.value = [
        ...pendingAttachments.value,
        {
          url: publicUrl,
          filename: file.name,
          size: file.size,
          mime_type: file.type || 'application/octet-stream',
        },
      ]
    }
  } catch {
    toastStore.show('Failed to upload file', 'error')
  } finally {
    uploadingFiles.value = false
  }
}

function removePendingAttachment(index: number) {
  pendingAttachments.value = pendingAttachments.value.filter((_, i) => i !== index)
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
      await deleteMessage(channelsStore.activeChannelId, messageId, serverId.value, authStore.user?.id)
    },
  }
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


function handleDeleteChannel(chId: string) {
  const ch = channelsStore.channels.find((c) => c.id === chId)
  confirmDialog.value = {
    title: 'Delete Channel',
    message: `Are you sure you want to delete #${ch?.name ?? 'this channel'}? This cannot be undone.`,
    confirmLabel: 'Delete Channel',
    danger: true,
    onConfirm: async () => {
      confirmDialog.value = null
      await deleteChannel(chId, serverId.value)
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

// ── Forum ─────────────────────────────────────────────────
function handleCreateForumPost(msg: Message & { profile: Profile }) {
  pendingForumMsg.value = msg
  showForumPostDialog.value = true
}

async function submitForumPost(type: ForumPostType, title: string, body: string) {
  if (!authStore.user?.id) return
  showForumPostDialog.value = false
  try {
    const post = await backend.forum.createPost(
      serverId.value,
      type,
      title,
      authStore.user.id,
      pendingForumMsg.value?.id ?? null,
      body || null,
    )
    forumPosts.value.unshift({ ...post, created_by_profile: (await backend.profiles.get(authStore.user.id)) })
    toastStore.show('Forum post created', 'success')
    router.push(`/spaces/${serverId.value}/forum/${post.id}`)
  } catch {
    toastStore.show('Failed to create forum post', 'error')
  } finally {
    pendingForumMsg.value = null
  }
}

// ── Report ────────────────────────────────────────────────
function handleReport(type: 'message' | 'user', targetId: string) {
  reportDialogType.value = type
  reportDialogTargetId.value = targetId
  showReportDialog.value = true
}

async function handleReportSubmit(data: { category: string; description: string }) {
  if (!authStore.user?.id) return
  await backend.reports.create({
    reporter_id: authStore.user.id,
    reported_type: reportDialogType.value,
    reported_id: reportDialogTargetId.value,
    server_id: serverId.value || null,
    category: data.category as import('@/lib/types').ReportCategory,
    description: data.description,
  })
  showReportDialog.value = false
  toastStore.show('Report submitted. Thank you.', 'success')
}

// ── Mute ──────────────────────────────────────────────────
function handleMute(userId: string) {
  const member = members.value.find((m) => m.user_id === userId)
  confirmDialog.value = {
    title: 'Mute Member',
    message: `Mute ${member?.profile.display_name ?? 'this member'}? They will not be able to send messages.`,
    confirmLabel: 'Mute',
    danger: true,
    inputPlaceholder: 'Reason (optional)',
    onConfirm: async (reason: string) => {
      confirmDialog.value = null
      await muteMember(serverId.value, userId, reason || '')
      toastStore.show('Member muted', 'success')
    },
  }
}

// ── Typing input handler ───────────────────────────────────
function handleInput() {
  localOnTyping()
  if (!isLocalMode && authStore.user?.id) {
    const displayName = myMember.value?.profile.display_name ?? authStore.user.email?.split('@')[0] ?? 'Someone'
    broadcastTyping(authStore.user.id, displayName)
  }
}

// ── Presence: get live status for a member ────────────────
function getEffectiveStatus(member: Member & { profile: Profile }): UserStatus {
  if (isLocalMode) return member.profile.status
  return presenceStore.getStatus(member.user_id, member.profile.status)
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
  await pinMessage(channelsStore.activeChannelId, messageId, serverId.value, authStore.user?.id)
  if (showPinnedPanel.value) await refreshPinnedPanel()
}

async function handleUnpinMessage(messageId: string) {
  if (!channelsStore.activeChannelId) return
  await unpinMessage(channelsStore.activeChannelId, messageId, serverId.value, authStore.user?.id)
  if (showPinnedPanel.value) await refreshPinnedPanel()
}

async function refreshPinnedPanel() {
  if (!channelsStore.activeChannelId) return
  pinnedMessages.value = await fetchPinnedMessages(channelsStore.activeChannelId)
}

async function togglePinnedPanel() {
  showPinnedPanel.value = !showPinnedPanel.value
  if (showPinnedPanel.value) {
    showPollsPanel.value = false
    showEventsPanel.value = false
    await refreshPinnedPanel()
  }
}

// ── Poll handlers ──────────────────────────────────────────
async function handlePollVote(pollId: string, optionId: string) {
  if (!authStore.user?.id) return
  await votePoll(pollId, optionId, authStore.user.id)
}

async function handlePollClose(pollId: string) {
  if (!channelsStore.activeChannelId) return
  await closePoll(pollId, channelsStore.activeChannelId)
}

async function handleCreatePollSubmit(data: { question: string; options: string[] }) {
  if (!channelsStore.activeChannelId || !authStore.user?.id) return
  await createPoll(channelsStore.activeChannelId, data.question, data.options, authStore.user.id)
  showCreatePoll.value = false
  showPollsPanel.value = true
  showPinnedPanel.value = false
  showEventsPanel.value = false
}

// ── Events handlers ────────────────────────────────────────
function handleCreateEvent(data: { server_id: string; channel_id: string | null; title: string; description: string; start_at: string; end_at: string | null }) {
  if (!authStore.user?.id) return
  createEvent({ ...data, created_by: authStore.user.id }).catch(() => {})
}

function handleEventRsvp(data: { eventId: string; status: RsvpStatus }) {
  if (!authStore.user?.id) return
  rsvpEvent(data.eventId, authStore.user.id, data.status).catch(() => {})
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
    onReport: !isAuthor ? () => handleReport('message', msg.id) : undefined,
    onCreateForumPost: canModerate.value ? () => handleCreateForumPost(msg) : undefined,
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
    onKick: check(Permission.KICK_MEMBERS) ? () => handleKick(member.user_id) : undefined,
    onBan: check(Permission.BAN_MEMBERS) ? () => handleBan(member.user_id) : undefined,
    onMute: check(Permission.MUTE_MEMBERS) && !isMe ? () => handleMute(member.user_id) : undefined,
    onReport: !isMe ? () => handleReport('user', member.user_id) : undefined,
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
      <!-- Backdrop to close notification popover -->
      <div v-if="notifPopoverChannelId" class="fixed inset-0 z-40"
      @click="notifPopoverChannelId = null" />

      <!-- ── Forum nav item ────────────────────────────────── -->
      <div class="space-y-0.5 mb-1 border-b border-bg-tertiary border-2 rounded">
        <button
          @click="activeView = 'forum'"
        class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm
        transition-colors"
          :class="activeView === 'forum' ? 'bg-bg-active text-text-primary' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
        >
          <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
          <span>Forum</span>
          <span class="ml-auto text-[10px] text-text-muted">{{ forumPosts.length }}</span>
        </button>
      </div>

      <div class="space-y-0.5 mb-0.5">
        <!-- Uncategorized channels (category_id = null) -->
        <ChannelListItem
          v-for="channel in channelsStore.channels.filter(c => c.category_id === null).sort((a,b) => a.position - b.position)"
          :key="channel.id"
          :channel="channel"
          :server-id="serverId"
          :is-active="channelsStore.activeChannelId === channel.id"
          :has-unread="unreadChannelIds.has(channel.id)"
          :can-drag="canManageChannels"
          :notification-level="getCached(channel.id)"
          :show-notif-popover="notifPopoverChannelId === channel.id"
          :drag-over-target="dragOverChannelId === channel.id"
          :notif-options="NOTIF_OPTIONS"
          @click="activeView = 'channel'"
          @contextmenu="onChannelContext($event, channel)"
          @dragstart="onChannelDragStart(channel.id)"
          @dragover="onChannelDragOver(channel.id)"
          @dragleave="onChannelDragLeave"
          @drop="onChannelDrop(channel.id)"
          @dragend="onChannelDragEnd"
          @open-notif-popover="openNotifPopover(channel.id)"
          @set-notif-level="setChannelNotifLevel(channel.id, $event)"
        />

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
            <ChannelListItem
              v-for="channel in channelsStore.channels.filter(c => c.category_id === cat.id).sort((a,b) => a.position - b.position)"
              :key="channel.id"
              :channel="channel"
              :server-id="serverId"
              :is-active="channelsStore.activeChannelId === channel.id"
              :has-unread="unreadChannelIds.has(channel.id)"
              :can-drag="canManageChannels"
              :notification-level="getCached(channel.id)"
              :show-notif-popover="notifPopoverChannelId === channel.id"
              :drag-over-target="dragOverChannelId === channel.id"
              :notif-options="NOTIF_OPTIONS"
              @click="activeView = 'channel'"
              @contextmenu="onChannelContext($event, channel)"
              @dragstart="onChannelDragStart(channel.id)"
              @dragover="onChannelDragOver(channel.id)"
              @dragleave="onChannelDragLeave"
              @drop="onChannelDrop(channel.id)"
              @dragend="onChannelDragEnd"
              @open-notif-popover="openNotifPopover(channel.id)"
              @set-notif-level="setChannelNotifLevel(channel.id, $event)"
            />
          </template>
        </div>
      </div>
    </template>

    <template #top-bar>
      <ChannelHeader
        v-if="activeView === 'channel'"
        :channel-name="activeChannel?.name ?? 'general'"
        :channel-description="activeChannel?.description"
        :search-open="searchOpen"
        :show-pinned-panel="showPinnedPanel"
        :show-polls-panel="showPollsPanel"
        :show-events-panel="showEventsPanel"
        @toggle-search="searchOpen ? closeSearch() : openSearch()"
        @toggle-pinned="togglePinnedPanel"
        @toggle-polls="showPollsPanel = !showPollsPanel; if (showPollsPanel) { showPinnedPanel = false; showEventsPanel = false }"
        @toggle-events="showEventsPanel = !showEventsPanel; if (showEventsPanel) { showPinnedPanel = false; showPollsPanel = false }"
      />

      <ForumHeaderComp
        v-else-if="activeView === 'forum'"
        :server-id="serverId"
        :default-channel-id="defaultChannelId"
        :post-count="forumPosts.length"
        :can-moderate="canModerate"
        @back="router.push(`/channels/${serverId}/${defaultChannelId}`)"
        @new-post="pendingForumMsg = null; showForumPostDialog = true"
      />

      <ForumPostHeader
        v-else-if="activeView === 'forum-post'"
        :post-title="forumPostViewRef?.post?.title ?? null"
        :editing-title="forumPostViewRef?.editingTitle ?? ''"
        :is-page-type="forumPostViewRef?.isPageType ?? false"
        :editing-page="forumPostViewRef?.editingPage ?? false"
        :can-edit="forumPostViewRef?.canEdit ?? false"
        :saving-page="forumPostViewRef?.savingPage ?? false"
        :is-author="!!forumPostViewRef?.post && authStore.user?.id === forumPostViewRef?.post?.created_by"
        @go-home="router.push(`/channels/${serverId}/${defaultChannelId}`)"
        @go-forum="activeView = 'forum'; backend.forum.listBySpace(serverId).then(posts => { forumPosts = posts }).catch(() => {})"
        @save="forumPostViewRef?.savePage()"
        @cancel="forumPostViewRef?.cancelEdit()"
        @start-edit="forumPostViewRef?.startEditing()"
        @delete="forumPostViewRef?.handleDeletePost()"
      />
    </template>

    <!-- Forum index view -->
    <div v-if="activeView === 'forum'" class="flex-1 overflow-y-auto">
      <div class="mx-auto max-w-3xl px-6 py-6">
        <!-- Empty state -->
        <div v-if="forumPosts.length === 0" class="flex flex-col items-center justify-center py-24 text-center">
          <div class="mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-bg-tertiary">
            <svg class="h-7 w-7 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
          </div>
          <h3 class="mb-1 text-base font-semibold text-text-primary">No posts yet</h3>
          <p class="mb-4 text-sm text-text-muted">Be the first to start a discussion or create a page.</p>
          <button
            v-if="canModerate"
            @click="pendingForumMsg = null; showForumPostDialog = true"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Create first post
          </button>
        </div>

        <!-- Post list -->
        <div v-else class="space-y-2">
          <router-link
            v-for="post in forumPosts"
            :key="post.id"
            :to="`/spaces/${serverId}/forum/${post.id}`"
            @click="activeView = 'forum-post'; activeForumPostId = post.id"
            class="flex items-start gap-3 rounded-lg bg-bg-secondary px-4 py-3 transition-colors hover:bg-bg-hover"
          >
          <div class="flex flex-col justify-between">
            <!-- Type badge -->
            <span
              class="mt-0.5 flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              :class="post.type === 'thread' ? 'bg-violet-500/15 text-violet-400' : 'bg-sky-500/15 text-sky-400'"
            >{{ post.type }}</span>

            <!-- Vote score -->
            <div class="mt-0.5 flex-shrink-0 pt-1 text-right">
              <span
                class="text-sm font-bold tabular-nums"
                :class="post.vote_score > 0 ? 'text-emerald-400' : post.vote_score < 0 ? 'text-red-400' : 'text-text-muted'"
              >{{ post.vote_score > 0 ? '+' : '' }}{{ post.vote_score }}</span>
            </div>
          </div>

            <!-- Title + meta -->
            <div class="min-w-0 flex-1">
              <p class="truncate font-medium text-text-primary">{{ post.title }}</p>
              <div class="mt-1 flex items-center gap-1.5 text-xs text-text-muted">
                <UserAvatar
                  :src="post.created_by_profile?.avatar_url"
                  :alt="post.created_by_profile?.display_name"
                  size="xs"
                  class="flex-shrink-0"
                />
                <span>{{ post.created_by_profile?.display_name ?? 'Unknown' }}</span>
                <span class="text-text-muted/40">·</span>
                <span>{{ formatDate(post.created_at) }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>
    </div>

    <!-- Forum post view -->
    <ForumPostView
      v-else-if="activeView === 'forum-post' && activeForumPostId"
      ref="forumPostViewRef"
      :post-id="activeForumPostId"
      :space-id="serverId"
      :comment-count="showForumComments ? (forumCommentsPanelRef?.count ?? undefined) : undefined"
      class="flex-1"
      @back="activeView = 'forum'; backend.forum.listBySpace(serverId).then(posts => { forumPosts = posts }).catch(() => {})"
    />

    <!-- Message list -->
    <div v-else-if="activeView === 'channel'" ref="messageListEl" class="flex flex-1 flex-col overflow-y-auto px-4 py-4">
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

        <!-- Load earlier messages -->
        <div v-if="hasMoreMessages || loadingOlder" class="flex justify-center py-2">
          <button
            @click="loadOlderMessages"
            :disabled="loadingOlder"
            class="rounded-full bg-bg-secondary px-4 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover disabled:opacity-50"
          >
            {{ loadingOlder ? 'Loading…' : 'Load earlier messages' }}
          </button>
        </div>
        <MessageBubble
          v-for="msg in groupedMessages"
          :key="msg.id"
          :message="msg"
          :content-html="renderMessage(msg.content, myUsername) + (msg.edited_at ? ' <span class=\'text-xs text-text-muted\'>(edited)</span>' : '')"
          :reply-author-name="msg.reply_to_id ? (getMessageById(msg.reply_to_id)?.profile.display_name ?? 'Unknown') : null"
          :reply-content="msg.reply_to_id ? (getMessageById(msg.reply_to_id)?.content ?? '[deleted]') : null"
          :reaction-groups="getReactionGroups(msg.id)"
          :is-editing="editingId === msg.id"
          :edit-content="editingContent"
          :is-author="msg.author_id === authStore.user?.id"
          :can-moderate="canModerate"
          :show-reaction-button="true"
          :show-pin-button="true"
          :server-id="serverId"
          @update:edit-content="editingContent = $event"
          @reply="startReply(msg)"
          @start-edit="startEdit(msg)"
          @delete="handleDeleteMessage(msg.id)"
          @cancel-edit="cancelEdit"
          @submit-edit="submitEdit"
          @pin="handlePinMessage(msg.id)"
          @unpin="handleUnpinMessage(msg.id)"
          @toggle-reaction="handleToggleReaction(msg.id, $event)"
          @open-reaction-picker="openEmojiPicker(msg.id, $event)"
          @contextmenu="onMessageContext($event, msg)"
        />
      </div>
    </div>

    <template #input>
      <MessageInputArea
        v-if="activeView === 'channel'"
        v-model="messageInput"
        :reply-display-name="replyingTo?.profile.display_name ?? null"
        :reply-content="replyingTo?.content ?? null"
        :typing-users="displayTypingUsers"
        :pending-attachments="pendingAttachments"
        :uploading-files="uploadingFiles"
        :disabled="!activeChannel"
        :placeholder="!canPostInChannel ? 'This is an announcement channel — only moderators can post' : slowmodeRemaining > 0 ? `Slowmode active — wait ${slowmodeRemaining}s` : `Message #${activeChannel?.name ?? 'general'}`"
        :can-post="canPostInChannel"
        :show-attach-button="true"
        :show-poll-button="true"
        :slowmode-remaining="slowmodeRemaining"
        :sending="sending"
        @submit="handleSendMessage"
        @input="handleInput"
        @cancel-reply="replyingTo = null"
        @attach-files="uploadAttachments"
        @remove-pending-attachment="removePendingAttachment"
        @create-poll="showCreatePoll = true"
      />
    </template>

    <template #members-header>
      <template v-if="showForumComments">
        <span class="text-xs font-semibold uppercase text-text-muted">Comments</span>
        <span class="ml-1.5 text-xs text-text-muted">· {{ forumCommentsPanelRef?.count ?? 0 }}</span>
      </template>
      <template v-else>
        <span class="text-xs font-semibold uppercase text-text-muted">Members</span>
        <span class="ml-1.5 text-xs text-text-muted">· {{ members.length }}</span>
      </template>
    </template>

    <template #members>
      <!-- Forum page comments (replaces member list for page-type posts) -->
      <ForumCommentsPanel
        v-if="showForumComments && activeForumPostId"
        ref="forumCommentsPanelRef"
        :post-id="activeForumPostId"
      />

      <!-- Search panel -->
      <MessageSearch
        v-else-if="searchOpen"
        v-model:query="searchQuery"
        :results="searchResults"
        @close="closeSearch"
        @select="(id: string) => { closeSearch(); scrollToMessage(id) }"
      />

      <!-- Pinned messages panel (replaces member list when open) -->
      <PinnedMessagesPanel
        v-else-if="showPinnedPanel"
        :messages="pinnedMessages"
        :can-moderate="canModerate"
        :my-username="myUsername"
        @close="showPinnedPanel = false"
        @unpin="handleUnpinMessage"
      />


      <!-- Polls panel -->
      <div v-else-if="showPollsPanel" class="flex h-full flex-col">
        <div class="flex items-center justify-between border-b border-bg-tertiary px-4 py-3">
          <h3 class="text-sm font-semibold">Polls</h3>
          <button @click="showPollsPanel = false" class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
            <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 overflow-y-auto p-4 space-y-3">
          <p v-if="polls.length === 0" class="py-6 text-center text-sm text-text-muted">No polls in this channel.</p>
          <PollCard
            v-for="pr in polls"
            :key="pr.poll.id"
            :poll-result="pr"
            :user-id="authStore.user?.id ?? ''"
            :can-close="canModerate"
            @vote="handlePollVote(pr.poll.id, $event)"
            @close="handlePollClose(pr.poll.id)"
          />
        </div>
      </div>

      <!-- Events panel -->
      <EventsPanel
        v-else-if="showEventsPanel"
        :events="events"
        :rsvps-by-event="rsvpsByEvent"
        :user-id="authStore.user?.id ?? ''"
        :server-id="serverId"
        :channels="channelsStore.channels"
        :can-create="canModerate"
        @close="showEventsPanel = false"
        @create="handleCreateEvent"
        @rsvp="handleEventRsvp"
        @load-rsvps="loadRsvps($event)"
      />

      <!-- Default member list -->
      <MemberList
        v-else
        :role-groups="memberRoleGroups"
        :selected-user-id="selectedMember?.user_id ?? null"
        :get-effective-status="getEffectiveStatus"
        @select-member="selectedMember = $event"
        @contextmenu="(e: MouseEvent, m: any) => onMemberContext(e, m)"
      />
    </template>
  </AppShell>

  <!-- Close emoji picker on outside click -->
  <div
    v-if="emojiPickerForMsg"
    class="fixed inset-0 z-40"
    @click="emojiPickerForMsg = null"
  />

  <!-- Member profile modal -->
  <MemberProfilePanel
    v-if="selectedMember"
    :member="selectedMember"
    :status="getEffectiveStatus(selectedMember)"
    :is-self="selectedMember.user_id === authStore.user?.id"
    :can-change-role="canChangeRole(selectedMember)"
    :can-kick="canKick"
    :can-ban="canBan"
    :is-owner="isOwner"
    @close="selectedMember = null"
    @send-message="async () => { const gid = await openDM(selectedMember!.user_id); selectedMember = null; router.push(`/channels/@me/${gid}`) }"
    @change-role="handleRoleChange(selectedMember!.user_id, $event)"
    @kick="handleKick(selectedMember!.user_id)"
    @ban="handleBan(selectedMember!.user_id)"
  />

  <!-- Create Channel Dialog -->
  <CreateChannelDialog
    v-if="showCreateChannel"
    :categories="categoriesStore.categories"
    @create="(name, catId) => { createChannel(serverId, name, undefined, catId); showCreateChannel = false }"
    @close="showCreateChannel = false"
  />

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
  <EditChannelDialog
    v-if="showEditChannel"
    :name="editChannelName"
    :description="editChannelDescription"
    :slowmode-seconds="editChannelSlowmode"
    @save="async (data) => { if (editChannelId) { await updateChannel(editChannelId, { name: data.name, description: data.description, slowmode_seconds: data.slowmodeSeconds }); showEditChannel = false; toastStore.show('Channel updated', 'success') } }"
    @close="showEditChannel = false"
  />

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

  <EmojiPickerPopover
    :open="!!emojiPickerForMsg && !!pickerAnchorRect"
    :anchor="pickerAnchorRect"
    @select="handleToggleReaction(emojiPickerForMsg!, $event)"
    @close="emojiPickerForMsg = null; pickerAnchorRect = null"
  />

  <!-- Report dialog -->
  <ReportDialog
    v-if="showReportDialog"
    :type="reportDialogType"
    :target-id="reportDialogTargetId"
    :server-id="serverId"
    @report="handleReportSubmit"
    @close="showReportDialog = false"
  />

  <!-- Create Poll dialog -->
  <CreatePollDialog
    v-if="showCreatePoll"
    @create="handleCreatePollSubmit"
    @close="showCreatePoll = false"
  />

  <CreateForumPostDialog
    v-if="showForumPostDialog"
    :space-id="serverId"
    :source-message-id="pendingForumMsg?.id"
    @confirm="submitForumPost"
    @cancel="showForumPostDialog = false; pendingForumMsg = null"
  />

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
