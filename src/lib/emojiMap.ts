import twemoji from 'twemoji'

const BASE = 'https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/'
const cache = new Map<string, Promise<string>>()

export function getEmojiSvg(emoji: string): Promise<string> {
  if (cache.has(emoji)) return cache.get(emoji)!

  // Use twemoji.parse() in callback mode to get the exact same URL twemoji generates
  // (identical normalisation — handles ZWJ, FE0F, skin tones etc. correctly)
  let svgUrl = ''
  twemoji.parse(emoji, {
    folder: 'svg',
    ext: '.svg',
    base: BASE,
    callback: (icon, options) => {
      svgUrl = `${(options as { base: string }).base}svg/${icon}.svg`
      return svgUrl
    },
  })

  if (!svgUrl) {
    const p = Promise.resolve('')
    cache.set(emoji, p)
    return p
  }

  const promise = fetch(svgUrl)
    .then(r => {
      if (!r.ok) return ''
      return r.text()
    })
    .then(text => {
      // Discard anything that isn't an SVG (e.g. CDN error HTML pages)
      const t = text.trimStart()
      return t.startsWith('<svg') || t.startsWith('<?xml') ? text : ''
    })
    .catch(() => '')

  cache.set(emoji, promise)
  return promise
}
