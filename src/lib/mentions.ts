import { renderMarkdown } from './markdown'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function applyMentions(html: string, myUsername: string | null): string {
  return html.replace(/@(\w+)/g, (_, username: string) => {
    const isMe = myUsername && username === myUsername
    return isMe
      ? `<span class="mention-me">@${username}</span>`
      : `<span class="mention">@${username}</span>`
  })
}

// Full render pipeline: escape → markdown → mentions → return
// Safe to use with v-html — no user-injected markup can survive.
export function renderMessage(content: string, myUsername: string | null): string {
  const escaped = escapeHtml(content)
  const withMarkdown = renderMarkdown(escaped)
  return applyMentions(withMarkdown, myUsername)
}

// Legacy alias for backward compat
export function renderWithMentions(content: string, myUsername: string | null): string {
  return renderMessage(content, myUsername)
}

export function extractMentionedUsernames(content: string): string[] {
  return (content.match(/@(\w+)/g) ?? []).map((m) => m.slice(1))
}
