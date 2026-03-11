// Downloads all Twemoji SVGs from jdecked/twemoji@15.1.0 (Emoji 15.1 support).
// Covers all base emoji + all skin-tone variants from @emoji-mart/data.
// Also generates public/emoji/data.json for runtime emoji name lookups.
// Run once after cloning: npm run sync:emoji
import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const __dir = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dir, '../public/emoji/svg')
const DATA_OUT = join(__dir, '../public/emoji/data.json')
// jdecked/twemoji fork — Emoji 15.1 support (includes shaking face, etc.)
const CDN = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/'

const require = createRequire(import.meta.url)
const twemoji = require('@twemoji/api')
const emojiData = require('@emoji-mart/data')

mkdirSync(OUT, { recursive: true })

// ── Generate data.json ────────────────────────────────────────────────────────
// names: native char → { id, name }
// icons: twemoji icon codepoint → ':id:'  (for markdown title attributes)
// categories: [{ id, emojis: [native] }]

const names = {}
const icons = {}

for (const e of Object.values(emojiData.emojis)) {
  const native = e.skins[0].native
  names[native] = { id: e.id, name: e.name }
  twemoji.parse(native, {
    folder: 'svg', ext: '.svg', base: '/',
    callback: (icon) => { icons[icon] = `:${e.id}:`; return icon },
  })
}

const categories = emojiData.categories
  .filter(c => c.id !== 'frequent')
  .map(c => ({
    id: c.id,
    emojis: c.emojis.map(id => emojiData.emojis[id]?.skins[0]?.native).filter(Boolean),
  }))
  .filter(c => c.emojis.length > 0)

writeFileSync(DATA_OUT, JSON.stringify({ categories, names, icons }))
console.log(`Wrote public/emoji/data.json (${Object.keys(names).length} emoji)`)

// ── Collect all SVG filenames (base + all skin-tone variants) ─────────────────
const filenames = new Set()
for (const e of Object.values(emojiData.emojis)) {
  for (const skin of e.skins) {
    twemoji.parse(skin.native, {
      folder: 'svg', ext: '.svg', base: '/',
      callback: (icon) => { filenames.add(`${icon}.svg`); return icon },
    })
  }
}

const files = [...filenames]
console.log(`Total SVG files to sync: ${files.length}`)

// ── Skip if already fully populated ──────────────────────────────────────────
const existing = readdirSync(OUT).length
if (existing >= files.length - 10) {
  console.log(`public/emoji/svg/ already has ${existing} files — skipping SVG download.`)
  process.exit(0)
}

console.log(`Downloading ${files.length} SVG files (have ${existing})...`)
let done = 0

for (let i = 0; i < files.length; i += 20) {
  const batch = files.slice(i, i + 20)
  await Promise.all(batch.map(async (filename) => {
    const outPath = join(OUT, filename)
    if (existsSync(outPath)) { done++; return }
    try {
      const r = await fetch(CDN + filename)
      if (!r.ok) return
      const text = await r.text()
      if (text.trimStart().startsWith('<svg') || text.trimStart().startsWith('<?xml'))
        writeFileSync(outPath, text)
    } catch { /* skip */ }
    done++
    if (done % 200 === 0) console.log(`  ${done}/${files.length}...`)
  }))
}
console.log(`Done. ${readdirSync(OUT).length} files in public/emoji/svg/`)
