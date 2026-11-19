// @vitest-environment jsdom
// DOMPurify relies on correct NodeIterator semantics; happy-dom mis-iterates
// after removals (it leaves an <iframe> following a <script>), so sanitizer
// guarantees are asserted against jsdom, DOMPurify's own test environment.
import { describe, it, expect } from 'vitest'
import { sanitizeRichText, safeHttpUrl, safeImageUrl, backgroundImageStyle, scopeCustomCss } from '@/lib/pageSanitize'

function parse(html: string) {
  const host = document.createElement('div')
  host.innerHTML = html
  return host
}

function hasHandlers(html: string): boolean {
  return Array.from(parse(html).querySelectorAll('*')).some((el) =>
    Array.from(el.attributes).some((a) => a.name.toLowerCase().startsWith('on')),
  )
}

describe('sanitizeRichText', () => {
  it.each([
    '<img src=x onerror=alert(1)>',
    '<p onfocus=alert(1) tabindex=0>x</p>',
    '<details open ontoggle=alert(1)>x</details>',
    '<div onpointerenter=alert(1)>x</div>',
    '<svg><animate onbegin=alert(1)></svg>',
  ])('strips event handlers: %s', (payload) => {
    expect(hasHandlers(sanitizeRichText(payload))).toBe(false)
  })

  it('removes script, iframe and style elements', () => {
    const out = sanitizeRichText('<script>alert(1)</script><iframe srcdoc="x"></iframe><style>*{}</style><p>ok</p>')
    const host = parse(out)
    expect(host.querySelector('script,iframe,style')).toBeNull()
    expect(host.textContent).toContain('ok')
  })

  it('drops javascript: hrefs and hardens remaining links', () => {
    const host = parse(sanitizeRichText('<a href="javascript:alert(1)">a</a><a href="https://example.com">b</a>'))
    const hrefs = Array.from(host.querySelectorAll('a')).map((a) => a.getAttribute('href'))
    expect(hrefs).not.toContain('javascript:alert(1)')
    const good = host.querySelector('a[href="https://example.com"]')
    expect(good?.getAttribute('rel')).toContain('noopener')
    expect(host.textContent).toContain('a') // link text survives as text
  })

  it('keeps ordinary formatting', () => {
    const out = sanitizeRichText('<p><strong>b</strong> <em>i</em> <code>c</code></p><ul><li>x</li></ul>')
    expect(parse(out).querySelectorAll('strong,em,code,li')).toHaveLength(4)
  })

  it('removes inline styles', () => {
    expect(sanitizeRichText('<p style="position:fixed;inset:0">x</p>')).not.toContain('style')
  })

  it('handles empty input', () => {
    expect(sanitizeRichText('')).toBe('')
    expect(sanitizeRichText(undefined)).toBe('')
  })
})

describe('safeHttpUrl', () => {
  it('accepts http(s)', () => {
    expect(safeHttpUrl('https://example.com/a b')).toBe('https://example.com/a%20b')
  })

  it.each(['javascript:alert(1)', ' JavaScript:alert(1)', 'data:text/html,x', 'vbscript:x', 'not a url', ''])(
    'rejects %j',
    (raw) => {
      expect(safeHttpUrl(raw)).toBeUndefined()
    },
  )
})

describe('safeImageUrl', () => {
  it('allows http(s), same-origin blob: and raster data: URLs', () => {
    expect(safeImageUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png')
    const blob = `blob:${window.location.origin}/123e4567`
    expect(safeImageUrl(blob)).toBe(blob)
    expect(safeImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe('data:image/png;base64,iVBORw0KGgo=')
  })

  it.each(['javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=', 'data:text/html,x', 'blob:https://evil.example/x'])(
    'rejects %j',
    (raw) => {
      expect(safeImageUrl(raw)).toBeUndefined()
    },
  )
})

describe('backgroundImageStyle', () => {
  it('cannot break out of url("…")', () => {
    const style = backgroundImageStyle('https://example.com/x");position:fixed;inset:0;("')
    // Exactly the two quotes we emit: the payload's quotes were percent-encoded,
    // so its text stays inside the url("…") token.
    expect(style.match(/"/g)).toHaveLength(2)
    expect(style).toMatch(/^background-image:url\("https:\/\/example\.com\/[^"]*"\);background-size:cover;background-position:center$/)
  })

  it('returns empty for unsafe urls', () => {
    expect(backgroundImageStyle('javascript:alert(1)')).toBe('')
  })
})

describe('scopeCustomCss', () => {
  it('prefixes every selector with the scope id', () => {
    expect(scopeCustomCss('h1, p { color: red }', 'sc')).toBe('#sc h1, #sc p { color: red }')
  })

  it('drops at-rules and remote loads', () => {
    const css = '@import url(//evil); a[href^="x"] { background: url(//evil/x) } p { color: blue }'
    const out = scopeCustomCss(css, 'sc')
    expect(out).not.toMatch(/@import|url\(/i)
    expect(out).toBe('#sc p { color: blue }')
  })

  it('cannot escape the scope with stray braces', () => {
    const out = scopeCustomCss('p { color: red } } body { display: none }', 'sc')
    for (const line of out.split('\n')) expect(line.startsWith('#sc ')).toBe(true)
  })

  it('drops fixed positioning and CSS escapes', () => {
    expect(scopeCustomCss('div { position: fixed; color: red }', 'sc')).toBe('#sc div { color: red }')
    expect(scopeCustomCss('div { background: u\\72l(x) }', 'sc')).toBe('')
  })
})
