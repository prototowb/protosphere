import { describe, it, expect } from 'vitest'
import { escapeHtml } from '@/lib/formatters'
import { renderMessage } from '@/lib/mentions'

// Every string rendered through v-html must come out as inert markup: only the
// elements and attributes the renderer itself emits, never attacker-chosen
// attributes. Parse the output and check structurally rather than by substring.
const ALLOWED_ATTRS = new Set(['href', 'class', 'target', 'rel', 'title', 'alt', 'src', 'draggable', 'data-mention'])

function attributesOf(html: string): { tag: string; name: string; value: string }[] {
  const host = document.createElement('div')
  host.innerHTML = html
  const out: { tag: string; name: string; value: string }[] = []
  for (const el of host.querySelectorAll('*')) {
    for (const attr of Array.from(el.attributes)) {
      out.push({ tag: el.tagName.toLowerCase(), name: attr.name, value: attr.value })
    }
  }
  return out
}

function assertInert(html: string) {
  for (const { tag, name, value } of attributesOf(html)) {
    expect(name.startsWith('on'), `<${tag} ${name}> is an event handler`).toBe(false)
    expect(ALLOWED_ATTRS.has(name), `<${tag} ${name}> is not an allowed attribute`).toBe(true)
    if (name === 'href') expect(value).toMatch(/^https?:\/\//)
  }
}

describe('escapeHtml', () => {
  it('escapes double and single quotes so output is safe inside attributes', () => {
    expect(escapeHtml(`"x" 'y'`)).toBe('&quot;x&quot; &#39;y&#39;')
  })

  it('escapes ampersands first, so entities are not double-decoded', () => {
    expect(escapeHtml('&quot;')).toBe('&amp;quot;')
  })
})

describe('renderMessage HTML safety', () => {
  it('keeps an auto-linked URL containing quotes inside its href', () => {
    const html = renderMessage('see https://example.com/"x="y"class="z', null)
    assertInert(html)
    const links = attributesOf(html).filter((a) => a.name === 'href')
    expect(links).toHaveLength(1)
  })

  it('does not let a quote in a URL introduce an event-handler attribute', () => {
    const html = renderMessage(`https://example.com/"onmouseover="alert(1)"style="x`, null)
    assertInert(html)
  })

  it('renders raw tags as text', () => {
    const html = renderMessage('<img src=x onerror=alert(1)> **bold** `code`', null)
    assertInert(html)
    expect(html).toContain('&lt;img')
  })

  it('still renders ordinary links', () => {
    const html = renderMessage('docs at https://example.com/a?b=1&c=2 ok', null)
    assertInert(html)
    const host = document.createElement('div')
    host.innerHTML = html
    expect(host.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a?b=1&c=2')
  })
})
