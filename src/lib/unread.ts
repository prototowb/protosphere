/**
 * Determine whether a channel/DM group has unread messages for the current user.
 * A channel is unread when there are messages from others newer than the last-read timestamp.
 * If the user has never visited (lastReadIso is undefined), any message from others counts as unread.
 */
export function isChannelUnread(
  messages: { author_id: string; created_at: string }[],
  lastReadIso: string | undefined,
  currentUserId: string,
): boolean {
  const othersMessages = messages.filter((m) => m.author_id !== currentUserId)
  if (othersMessages.length === 0) return false
  if (!lastReadIso) return true
  return othersMessages.some((m) => m.created_at > lastReadIso)
}
