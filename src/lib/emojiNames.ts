import { ref } from 'vue'

interface EmojiEntry { id: string; name: string }

interface EmojiData {
  categories: Array<{ id: string; emojis: string[] }>
  names: Record<string, EmojiEntry>
  icons: Record<string, string> // twemoji icon codepoint → ':id:'
}

export const emojiDataLoaded = ref(false)
let data: EmojiData | null = null
let byId: Record<string, string> | null = null // emoji id → native char
let loading: Promise<void> | null = null

export function loadEmojiData(): Promise<void> {
  if (data) return Promise.resolve()
  if (loading) return loading
  loading = fetch('/emoji/data.json')
    .then(r => r.json() as Promise<EmojiData>)
    .then(d => {
      data = d
      byId = {}
      for (const [native, e] of Object.entries(d.names)) byId[e.id] = native
      emojiDataLoaded.value = true
    })
    .catch(() => {})
  return loading
}

export function getEmojiData(): EmojiData | null { return data }

/** Returns the emoji id for a native char, e.g. '😀' → 'grinning'. Requires data loaded. */
export function getEmojiId(native: string): string | null {
  return data?.names[native]?.id ?? null
}

/** Returns ':id:' label for a twemoji icon codepoint (used in markdown attributes). */
export function getEmojiIconLabel(icon: string): string | null {
  return data?.icons[icon] ?? null
}

/**
 * Expands :shortcode: patterns in text to native emoji chars.
 * e.g. ':shaking_face:' → '🫨'. Unrecognised codes are left as-is.
 * Safe to call before data is loaded (returns text unchanged).
 */
export function expandShortcodes(text: string): string {
  if (!byId) return text
  return text.replace(/:([a-z0-9_+-]+):/g, (match, id) => byId![id] ?? match)
}
