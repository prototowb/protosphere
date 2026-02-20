// Escapes HTML then wraps @username tokens in styled spans.
// Safe to use with v-html — no user-injected markup can survive.
export function renderWithMentions(content: string, myUsername: string | null): string {
  const escaped = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  return escaped.replace(/@(\w+)/g, (_, username: string) => {
    const isMe = myUsername && username === myUsername
    return isMe
      ? `<span class="mention-me">@${username}</span>`
      : `<span class="mention">@${username}</span>`
  })
}

export function extractMentionedUsernames(content: string): string[] {
  return (content.match(/@(\w+)/g) ?? []).map((m) => m.slice(1))
}
