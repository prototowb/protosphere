// Lightweight markdown renderer for chat messages.
// Operates on already-HTML-escaped text (safe against XSS).
// Supports: code blocks, inline code, bold, italic, strikethrough, URL auto-linking.

import twemoji from '@twemoji/api'
import { getEmojiIconLabel } from '@/lib/emojiNames'

export function renderMarkdown(escaped: string): string {
  // Fenced code blocks: ```lang\ncode\n```
  escaped = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_match, _lang: string, code: string) => {
    return `<pre class="md-codeblock"><code>${code.trimEnd()}</code></pre>`
  })

  // Inline code: `code`
  escaped = escaped.replace(/`([^`\n]+)`/g, '<code class="md-code">$1</code>')

  // Bold: **text**
  escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  // Italic: *text* (but not inside ** which we already handled)
  escaped = escaped.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>')

  // Strikethrough: ~~text~~
  escaped = escaped.replace(/~~(.+?)~~/g, '<del>$1</del>')

  // URL auto-linking (http/https)
  escaped = escaped.replace(
    /(?<!")https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" class="md-link" target="_blank" rel="noopener noreferrer">${url}</a>`,
  )

  // Replace native emoji with Twemoji PNGs (Discord-style, CORB-safe)
  escaped = twemoji.parse(escaped, {
    folder: 'svg',
    ext: '.svg',
    base: '/emoji/',
    attributes: (icon: string) => {
      const label = getEmojiIconLabel(icon)
      return label ? { class: 'emoji', title: label } : { class: 'emoji' }
    },
  }) as string

  return escaped
}
