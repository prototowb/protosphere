// Sanitisers for user-authored page content (forum posts, profile pages).
//
// Page blocks are stored as JSON written by their author and rendered to every
// viewer, so every field that reaches the DOM as HTML, a URL, inline style or
// a stylesheet is attacker-controlled from the viewer's point of view.

import DOMPurify from 'dompurify'

// Rich text from the block editor: formatting, lists, links, code, images.
// An explicit allowlist — anything not named here (svg, math, iframe, form
// controls, style, …) is removed together with its attributes.
const RICH_TEXT_CONFIG = {
  ALLOWED_TAGS: [
    'p', 'br', 'hr', 'span', 'div', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'mark', 'sub', 'sup',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code', 'ul', 'ol', 'li',
    'a', 'img', 'figure', 'figcaption', 'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'colspan', 'rowspan', 'start'],
  ALLOW_DATA_ATTR: false,
  ALLOW_ARIA_ATTR: false,
}

let hooked = false
function ensureHooks() {
  if (hooked) return
  hooked = true
  // Links in user content open in a new tab without access to window.opener.
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.hasAttribute('href')) {
      node.setAttribute('target', '_blank')
      node.setAttribute('rel', 'noopener noreferrer nofollow')
    }
  })
}

/** Allowlist-sanitise rich-text HTML. Parsing happens in an inert document. */
export function sanitizeRichText(html: string | null | undefined): string {
  if (!html) return ''
  ensureHooks()
  return DOMPurify.sanitize(html, RICH_TEXT_CONFIG) as unknown as string
}

/**
 * Return a normalised absolute http(s) URL, or undefined for anything else
 * (javascript:, data:, protocol-relative tricks, garbage). The URL parser
 * percent-encodes quotes and strips newlines, so the result is also safe to
 * embed in a quoted CSS `url("…")`.
 */
export function safeHttpUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

const RASTER_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i

/**
 * URL for an `<img src>`: http(s), plus the same-origin `blob:` and raster
 * `data:` URLs the local-only backend produces. Images cannot run script, so
 * these are safe in `src` — but never use this for `href` or CSS.
 */
export function safeImageUrl(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined
  const value = raw.trim()
  if (value.startsWith(`blob:${window.location.origin}/`)) return value
  if (RASTER_DATA_URL.test(value)) return value
  return safeHttpUrl(value)
}

/** Inline style for a background image, or '' when the URL isn't safe. */
export function backgroundImageStyle(raw: string | null | undefined): string {
  const url = safeHttpUrl(raw)
  return url ? `background-image:url("${url}");background-size:cover;background-position:center` : ''
}

// Declarations that can load remote resources (CSS-based data exfiltration
// via attribute selectors + url()), execute legacy script, or escape the
// renderer to overlay the rest of the app (phishing UI).
const FORBIDDEN_CSS = [
  /url\s*\(/i,
  /image-set\s*\(/i,
  /expression\s*\(/i,
  /-moz-binding/i,
  /behavior\s*:/i,
  /javascript:/i,
  /position\s*:\s*(fixed|sticky)/i,
  /\\/, // CSS escapes are the usual way to smuggle the above past filters
]

/**
 * Scope author CSS to `#scopeId`, keeping only plain `selector { decls }`
 * rules. At-rules (@import, @font-face, @media, …), comments, nested braces and
 * forbidden declarations are dropped rather than repaired.
 */
export function scopeCustomCss(css: string | null | undefined, scopeId: string): string {
  if (!css || !css.trim()) return ''
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const out: string[] = []
  const ruleRe = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = ruleRe.exec(withoutComments)) !== null) {
    const selectorText = m[1]!.trim()
    const body = m[2]!
    if (!selectorText || selectorText.includes('@') || selectorText.includes('<')) continue
    const decls = body
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d && d.includes(':') && !FORBIDDEN_CSS.some((re) => re.test(d)) && !d.includes('<'))
    if (decls.length === 0) continue
    const selectors = selectorText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !FORBIDDEN_CSS.some((re) => re.test(s)))
      .map((s) => `#${scopeId} ${s}`)
    if (selectors.length === 0) continue
    out.push(`${selectors.join(', ')} { ${decls.join('; ')} }`)
  }
  return out.join('\n')
}
