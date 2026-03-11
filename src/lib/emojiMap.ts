import twemoji from 'twemoji'

const BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/'
const cache = new Map<string, Promise<string>>()

export function getEmojiSvg(emoji: string): Promise<string> {
  if (cache.has(emoji)) return cache.get(emoji)!
  // Strip variation selector \uFE0F unless it's part of a ZWJ sequence — matches twemoji normalisation
  const normalised = emoji.indexOf('\u200D') < 0 ? emoji.replace(/\uFE0F/g, '') : emoji
  const codepoint = twemoji.convert.toCodePoint(normalised)
  const promise = fetch(`${BASE}${codepoint}.svg`)
    .then(r => r.text())
    .catch(() => '')
  cache.set(emoji, promise)
  return promise
}
