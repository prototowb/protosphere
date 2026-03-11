<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'
import { getEmojiUrl } from '@/lib/emojiMap'
import { loadEmojiData, getEmojiData } from '@/lib/emojiNames'

const props = withDefaults(defineProps<{
  modelValue: string
  disabled?: boolean
  placeholder?: string
}>(), { disabled: false })

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'submit': []
  'input': []
  'files': [files: File[]]
}>()

const editorEl = ref<HTMLDivElement | null>(null)

// ── Autocomplete ──────────────────────────────────────────────────────────────

interface EmojiResult { id: string; name: string; native: string }
const acResults = ref<EmojiResult[]>([])
const acIndex = ref(0)


function getColonQuery(): string | null {
  const sel = window.getSelection()
  if (!sel?.rangeCount || !sel.getRangeAt(0).collapsed) return null
  const range = sel.getRangeAt(0)
  const node = range.startContainer
  if (node.nodeType !== Node.TEXT_NODE) return null
  const before = (node.textContent ?? '').slice(0, range.startOffset)
  const m = before.match(/:([a-z0-9_]+)$/)
  return m ? (m[1] ?? null) : null
}

function detectAutocomplete() {
  const query = getColonQuery()
  if (!query || query.length < 2) { acResults.value = []; return }
  loadEmojiData().then(() => {
    const d = getEmojiData()
    if (!d) return
    const q = query.toLowerCase()
    // prioritise emojis whose id starts with the query
    const results = Object.entries(d.names)
      .map(([native, e]) => ({ native, id: e.id, name: e.name }))
      .filter(e => e.id.includes(q) || e.name.toLowerCase().includes(q))
    results.sort((a, b) => (a.id.startsWith(q) ? -1 : 1) - (b.id.startsWith(q) ? -1 : 1))
    acResults.value = results.slice(0, 8)
    acIndex.value = 0
  })
}

function applyAutocomplete(result: EmojiResult) {
  const sel = window.getSelection()
  if (sel?.rangeCount) {
    const range = sel.getRangeAt(0)
    const node = range.startContainer as Text
    const before = (node.textContent ?? '').slice(0, range.startOffset)
    const m = before.match(/:([a-z0-9_]+)$/)
    if (m) {
      range.setStart(node, range.startOffset - m[0].length)
      range.deleteContents()
    }
  }
  acResults.value = []
  insertEmoji(result.native)
}

// ── Value extraction & sync ───────────────────────────────────────────────────

function extractText(): string {
  let s = ''
  if (!editorEl.value) return s
  for (const node of editorEl.value.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      s += node.textContent ?? ''
    } else if ((node as Element).nodeName === 'IMG') {
      s += (node as HTMLImageElement).dataset.emoji ?? ''
    } else if ((node as Element).nodeName === 'BR') {
      s += '\n'
    }
  }
  return s
}

function clearEditor() {
  if (editorEl.value) editorEl.value.innerHTML = ''
}

watch(() => props.modelValue, (newVal) => {
  // Only clear — handles the "after send" case; never overwrite user input
  if (newVal === '' && extractText() !== '') clearEditor()
})

// ── DOM change → parent ───────────────────────────────────────────────────────

function onContentChange() {
  emit('update:modelValue', extractText())
  emit('input')
}

// ── Keyboard ──────────────────────────────────────────────────────────────────

function insertBr() {
  const sel = window.getSelection()
  if (!sel?.rangeCount) return
  const range = sel.getRangeAt(0)
  range.deleteContents()
  const br = document.createElement('br')
  range.insertNode(br)
  range.setStartAfter(br)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
}

function onKeydown(e: KeyboardEvent) {
  if (acResults.value.length) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      acIndex.value = (acIndex.value + 1) % acResults.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      acIndex.value = (acIndex.value - 1 + acResults.value.length) % acResults.value.length
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      const result = acResults.value[acIndex.value]
      if (result) applyAutocomplete(result)
      return
    }
    if (e.key === 'Escape') { acResults.value = []; return }
  }

  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); emit('submit'); return }
  if (e.key === 'Enter' && e.shiftKey)  { e.preventDefault(); insertBr(); onContentChange(); return }
}

function onInput() {
  onContentChange()
  detectAutocomplete()
}

// ── Paste ─────────────────────────────────────────────────────────────────────

function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  const cd = e.clipboardData
  if (!cd) return

  const files = Array.from(cd.items)
    .filter(i => i.kind === 'file')
    .map(i => i.getAsFile())
    .filter((f): f is File => f !== null)
  if (files.length) { emit('files', files); return }

  const text = cd.getData('text/plain')
  if (text) document.execCommand('insertText', false, text)
}

// ── Emoji insertion ───────────────────────────────────────────────────────────

function insertEmoji(native: string) {
  const url = getEmojiUrl(native)

  // If no SVG URL is available, insert as plain text (native OS glyph)
  if (!url) {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && editorEl.value?.contains(sel.anchorNode)) {
      const range = sel.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(native))
      range.collapse(false)
      sel.removeAllRanges()
      sel.addRange(range)
    } else {
      editorEl.value?.appendChild(document.createTextNode(native))
    }
    onContentChange()
    editorEl.value?.focus()
    return
  }

  const img = document.createElement('img')
  img.className = 'msg-emoji'
  img.alt = native
  img.dataset.emoji = native
  img.src = url
  // If SVG is missing (e.g. Emoji 15.x not in Twemoji), fall back to native glyph
  img.onerror = () => { img.replaceWith(document.createTextNode(native)) }

  const sel = window.getSelection()
  if (sel && sel.rangeCount > 0 && editorEl.value?.contains(sel.anchorNode)) {
    const range = sel.getRangeAt(0)
    range.deleteContents()
    range.insertNode(img)
    range.setStartAfter(img)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  } else {
    editorEl.value?.appendChild(img)
  }

  onContentChange()
  editorEl.value?.focus()
}

function focus() { editorEl.value?.focus() }

defineExpose({ insertEmoji, focus })

// ── Disable ───────────────────────────────────────────────────────────────────

const editableAttr = computed(() => props.disabled ? 'false' : 'true')
</script>

<template>
  <div class="mi-wrap">
    <!-- Autocomplete dropdown -->
    <div v-if="acResults.length" class="mi-ac">
      <button
        v-for="(r, i) in acResults"
        :key="r.id"
        class="mi-ac-btn"
        :class="{ active: i === acIndex }"
        @mousedown.prevent="applyAutocomplete(r)"
        @mouseover="acIndex = i"
      >
        <EmojiIcon :emoji="r.native" size="1.2em" />
        <span class="mi-ac-id">:{{ r.id }}:</span>
        <span class="mi-ac-name">{{ r.name }}</span>
      </button>
    </div>

    <!-- Editable area -->
    <div
      ref="editorEl"
      :contenteditable="editableAttr"
      role="textbox"
      aria-multiline="true"
      class="mi-editor"
      :class="{ 'mi-editor--disabled': disabled }"
      :data-placeholder="placeholder ?? ''"
      @input="onInput"
      @keydown="onKeydown"
      @paste="onPaste"
    />
  </div>
</template>

<!-- Non-scoped: styles dynamically inserted img.msg-emoji nodes -->
<style>
img.msg-emoji {
  height: 1.2em;
  width: 1.2em;
  vertical-align: -0.2em;
  display: inline-block;
  pointer-events: none;
  user-select: none;
}
</style>

<style scoped>
.mi-wrap {
  position: relative;
  flex: 1;
  min-width: 0;
}

.mi-editor {
  outline: none;
  color: var(--color-text-primary);
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
  max-height: 200px;
  overflow-y: auto;
  cursor: text;
  caret-color: var(--color-text-primary);
}

.mi-editor--disabled {
  opacity: 0.6;
  cursor: not-allowed;
  pointer-events: none;
}

.mi-editor:empty::before {
  content: attr(data-placeholder);
  color: var(--color-text-muted);
  pointer-events: none;
}

/* Autocomplete dropdown */
.mi-ac {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--color-bg-tertiary);
  border: 1px solid rgba(148, 163, 184, 0.15);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  z-index: 100;
}

.mi-ac-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 12px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-primary);
  font-size: 0.875rem;
  text-align: left;
  transition: background 0.1s;
}

.mi-ac-btn:hover,
.mi-ac-btn.active {
  background: rgba(248, 250, 252, 0.06);
}

.mi-ac-id {
  font-family: 'Fira Code', ui-monospace, monospace;
  font-size: 0.8rem;
}

.mi-ac-name {
  color: var(--color-text-muted);
  font-size: 0.8rem;
  margin-left: auto;
}
</style>
