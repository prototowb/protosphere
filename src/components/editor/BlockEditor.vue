<script setup lang="ts">
import { ref, computed } from 'vue'
import BlockRenderer from './BlockRenderer.vue'
import type { Block, PageContent, HeroBlock, TextBlock, ImageBlock, ColumnsBlock, CalloutBlock, LinkCardBlock, Attachment } from '@/lib/types'

const props = defineProps<{
  modelValue: PageContent
  readOnly?: boolean
  sourceMessage?: { content?: string | null; attachments?: Attachment[] | null } | null
}>()
const emit = defineEmits<{ 'update:modelValue': [PageContent] }>()

// ── helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2, 10) }

// Normalise to always have both required fields
const safeValue = computed<PageContent>(() => ({
  blocks: Array.isArray(props.modelValue?.blocks) ? props.modelValue.blocks : [],
  customCss: props.modelValue?.customCss ?? '',
}))

function patch(blocks: Block[]) {
  emit('update:modelValue', { ...safeValue.value, blocks })
}
function patchCss(customCss: string) {
  emit('update:modelValue', { ...safeValue.value, customCss })
}

// ── UI state ──────────────────────────────────────────────────────────────────

type Tab = 'edit' | 'preview' | 'css'
const activeTab = ref<Tab>('edit')
const editingId = ref<string | null>(null)
const addMenuOpen = ref(false)

const editingBlock = computed(() =>
  editingId.value ? safeValue.value.blocks.find(b => b.id === editingId.value) ?? null : null
)

// ── block CRUD ────────────────────────────────────────────────────────────────

function addBlock(type: Block['type']) {
  addMenuOpen.value = false
  const id = uid()
  let block: Block
  if (type === 'hero')      block = { id, type, title: 'Heading', subtitle: '', textAlign: 'left' }
  else if (type === 'text') block = { id, type, html: '<p>Your text here…</p>' }
  else if (type === 'image')block = { id, type, url: '', caption: '' }
  else if (type === 'columns') block = { id, type, cols: 2, items: ['<p>Column 1</p>', '<p>Column 2</p>'] }
  else if (type === 'callout')  block = { id, type, variant: 'info', title: '', text: 'Callout text' }
  else if (type === 'divider')  block = { id, type }
  else block = { id, type: 'link-card', url: 'https://', title: 'Link title', description: '' }
  patch([...safeValue.value.blocks, block])
  editingId.value = id
}

function removeBlock(id: string) {
  if (editingId.value === id) editingId.value = null
  patch(safeValue.value.blocks.filter(b => b.id !== id))
}

function moveBlock(id: string, dir: -1 | 1) {
  const blocks = [...safeValue.value.blocks]
  const idx = blocks.findIndex(b => b.id === id)
  if (idx === -1) return
  const next = idx + dir
  if (next < 0 || next >= blocks.length) return
  ;[blocks[idx], blocks[next]] = [blocks[next]!, blocks[idx]!]
  patch(blocks)
}

function updateBlock(id: string, updates: Partial<Block>) {
  patch(safeValue.value.blocks.map(b => b.id === id ? { ...b, ...updates } as Block : b))
}

function updateColumnItem(block: ColumnsBlock, idx: number, html: string) {
  const items = [...block.items]
  items[idx] = html
  updateBlock(block.id, { items } as Partial<Block>)
}

// ── source message imports ────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function importSourceText(text: string) {
  const id = uid()
  patch([...safeValue.value.blocks, { id, type: 'text', html: `<p>${escapeHtml(text)}</p>` } as TextBlock])
  editingId.value = id
}

function importAttachment(att: Attachment) {
  const id = uid()
  const isImage = att.mime_type?.startsWith('image/')
  const block: Block = isImage
    ? ({ id, type: 'image', url: att.url, caption: att.filename ?? '' } as ImageBlock)
    : ({ id, type: 'link-card', url: att.url, title: att.filename ?? 'Attachment', description: att.size ? `${(att.size / 1024).toFixed(1)} KB` : undefined } as LinkCardBlock)
  patch([...safeValue.value.blocks, block])
  editingId.value = id
}

// ── block type meta ───────────────────────────────────────────────────────────

const blockTypes: { type: Block['type']; label: string; icon: string }[] = [
  { type: 'hero',      label: 'Hero',      icon: 'M3 5h18M3 12h18M3 19h18' },
  { type: 'text',      label: 'Text',      icon: 'M4 6h16M4 12h16M4 18h7' },
  { type: 'image',     label: 'Image',     icon: 'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7' },
  { type: 'columns',   label: 'Columns',   icon: 'M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4m6-18h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4m-1-18v20' },
  { type: 'callout',   label: 'Callout',   icon: 'M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' },
  { type: 'divider',   label: 'Divider',   icon: 'M5 12h14' },
  { type: 'link-card', label: 'Link card', icon: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
]
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden">

    <!-- Tab bar -->
    <div class="flex h-10 flex-shrink-0 items-center gap-1 border-b border-bg-tertiary bg-bg-primary px-3">
      <button
        v-for="t in (['edit', 'preview', 'css'] as Tab[])"
        :key="t"
        @click="activeTab = t"
        :class="['rounded px-3 py-1 text-xs font-medium capitalize transition-colors', activeTab === t ? 'bg-accent/20 text-accent' : 'text-text-muted hover:text-text-primary']"
      >{{ t === 'css' ? 'Custom CSS' : t }}</button>
    </div>

    <!-- Preview tab -->
    <div v-if="activeTab === 'preview'" class="flex-1 overflow-y-auto p-6">
      <BlockRenderer :content="safeValue" />
    </div>

    <!-- CSS tab -->
    <div v-else-if="activeTab === 'css'" class="flex flex-1 flex-col gap-3 overflow-hidden p-4">
      <p class="text-xs text-text-muted">Write CSS to style the page. Only CSS rules are allowed — no JavaScript. Use class names or element selectors from your blocks.</p>
      <textarea
        :value="safeValue.customCss"
        @input="patchCss(($event.target as HTMLTextAreaElement).value)"
        class="flex-1 resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent"
        placeholder=".block-renderer h1 { color: hotpink; }"
        spellcheck="false"
      />
    </div>

    <!-- Edit tab -->
    <div v-else class="flex flex-1 overflow-hidden">

      <!-- Block list (left) -->
      <div class="flex w-64 flex-shrink-0 flex-col gap-1 overflow-y-auto border-r border-bg-tertiary bg-bg-primary p-2">

        <div
          v-for="(block, idx) in safeValue.blocks"
          :key="block.id"
          @click="editingId = editingId === block.id ? null : block.id"
          :class="['group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm transition-colors', editingId === block.id ? 'bg-accent/20 text-accent' : 'hover:bg-bg-hover text-text-secondary']"
        >
          <span class="flex-1 truncate capitalize">{{ block.type.replace('-', ' ') }}</span>
          <!-- Move up/down -->
          <button @click.stop="moveBlock(block.id, -1)" :disabled="idx === 0" class="hidden rounded p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30 group-hover:block">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          </button>
          <button @click.stop="moveBlock(block.id, 1)" :disabled="idx === safeValue.blocks.length - 1" class="hidden rounded p-0.5 text-text-muted hover:text-text-primary disabled:opacity-30 group-hover:block">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <!-- Delete -->
          <button @click.stop="removeBlock(block.id)" class="hidden rounded p-0.5 text-text-muted hover:text-red-400 group-hover:block">
            <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <!-- Import from source message -->
        <template v-if="sourceMessage">
          <div class="mt-2 border-t border-bg-tertiary pt-2">
            <p class="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-text-muted">From message</p>
            <button
              v-if="sourceMessage.content"
              @click="importSourceText(sourceMessage.content!)"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <svg class="h-3.5 w-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
              <span class="truncate">Message text</span>
            </button>
            <button
              v-for="(att, i) in (sourceMessage.attachments ?? [])"
              :key="i"
              @click="importAttachment(att)"
              class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <svg class="h-3.5 w-3.5 flex-shrink-0 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span class="truncate text-xs">{{ att.filename }}</span>
            </button>
          </div>
        </template>

        <!-- Add block button -->
        <div class="relative mt-1">
          <button
            @click="addMenuOpen = !addMenuOpen"
            class="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-bg-tertiary py-2 text-xs text-text-muted hover:border-accent/50 hover:text-accent transition-colors"
          >
            <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add block
          </button>
          <div v-if="addMenuOpen" class="absolute left-0 right-0 top-full z-20 mt-1 rounded-lg border border-bg-tertiary bg-bg-secondary py-1 shadow-lg">
            <button
              v-for="bt in blockTypes"
              :key="bt.type"
              @click="addBlock(bt.type)"
              class="flex w-full items-center gap-2.5 px-3 py-1.5 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              <svg class="h-4 w-4 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <path :d="bt.icon" />
              </svg>
              {{ bt.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- Block properties (right) -->
      <div class="flex-1 overflow-y-auto p-4">
        <p v-if="!editingBlock" class="text-sm text-text-muted">Select a block to edit its properties.</p>

        <template v-else>

          <!-- ── Hero ── -->
          <div v-if="editingBlock.type === 'hero'" class="space-y-3">
            <label class="block text-xs font-semibold uppercase text-text-muted">Title</label>
            <input :value="(editingBlock as HeroBlock).title" @input="updateBlock(editingBlock.id, { title: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Subtitle</label>
            <input :value="(editingBlock as HeroBlock).subtitle" @input="updateBlock(editingBlock.id, { subtitle: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="Optional subtitle" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Background image URL</label>
            <input :value="(editingBlock as HeroBlock).backgroundUrl ?? ''" @input="updateBlock(editingBlock.id, { backgroundUrl: ($event.target as HTMLInputElement).value || undefined })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="https://…" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Text alignment</label>
            <select :value="(editingBlock as HeroBlock).textAlign ?? 'left'" @change="updateBlock(editingBlock.id, { textAlign: ($event.target as HTMLSelectElement).value as HeroBlock['textAlign'] })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </div>

          <!-- ── Text ── -->
          <div v-else-if="editingBlock.type === 'text'" class="space-y-2">
            <label class="block text-xs font-semibold uppercase text-text-muted">HTML content</label>
            <p class="text-xs text-text-muted">Plain HTML — headings, paragraphs, lists, links, bold/italic. No scripts.</p>
            <textarea
              :value="(editingBlock as TextBlock).html"
              @input="updateBlock(editingBlock.id, { html: ($event.target as HTMLTextAreaElement).value })"
              rows="10"
              class="w-full resize-y rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent"
              spellcheck="false"
            />
          </div>

          <!-- ── Image ── -->
          <div v-else-if="editingBlock.type === 'image'" class="space-y-3">
            <label class="block text-xs font-semibold uppercase text-text-muted">Image URL</label>
            <input :value="(editingBlock as ImageBlock).url" @input="updateBlock(editingBlock.id, { url: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="https://…" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Caption</label>
            <input :value="(editingBlock as ImageBlock).caption ?? ''" @input="updateBlock(editingBlock.id, { caption: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="Optional caption" />
            <label class="flex items-center gap-2 text-sm text-text-secondary">
              <input type="checkbox" :checked="(editingBlock as ImageBlock).fullWidth" @change="updateBlock(editingBlock.id, { fullWidth: ($event.target as HTMLInputElement).checked })" class="rounded" />
              Full width
            </label>
          </div>

          <!-- ── Columns ── -->
          <div v-else-if="editingBlock.type === 'columns'" class="space-y-3">
            <label class="block text-xs font-semibold uppercase text-text-muted">Number of columns</label>
            <select :value="(editingBlock as ColumnsBlock).cols" @change="updateBlock(editingBlock.id, { cols: Number(($event.target as HTMLSelectElement).value) as 2 | 3 })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
              <option value="2">2 columns</option>
              <option value="3">3 columns</option>
            </select>
            <div v-for="(col, i) in (editingBlock as ColumnsBlock).items" :key="i">
              <label class="mb-1 block text-xs font-semibold uppercase text-text-muted">Column {{ i + 1 }} (HTML)</label>
              <textarea
                :value="col"
                @input="updateColumnItem(editingBlock as ColumnsBlock, i, ($event.target as HTMLTextAreaElement).value)"
                rows="5"
                class="w-full resize-y rounded border border-bg-tertiary bg-bg-primary px-3 py-2 font-mono text-sm text-text-primary outline-none focus:border-accent"
                spellcheck="false"
              />
            </div>
          </div>

          <!-- ── Callout ── -->
          <div v-else-if="editingBlock.type === 'callout'" class="space-y-3">
            <label class="block text-xs font-semibold uppercase text-text-muted">Variant</label>
            <select :value="(editingBlock as CalloutBlock).variant" @change="updateBlock(editingBlock.id, { variant: ($event.target as HTMLSelectElement).value as CalloutBlock['variant'] })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent">
              <option value="info">Info</option>
              <option value="warning">Warning</option>
              <option value="success">Success</option>
              <option value="error">Error</option>
            </select>
            <label class="block text-xs font-semibold uppercase text-text-muted">Title (optional)</label>
            <input :value="(editingBlock as CalloutBlock).title ?? ''" @input="updateBlock(editingBlock.id, { title: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Text</label>
            <textarea :value="(editingBlock as CalloutBlock).text" @input="updateBlock(editingBlock.id, { text: ($event.target as HTMLTextAreaElement).value })" rows="3" class="w-full resize-y rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
          </div>

          <!-- ── Divider ── -->
          <p v-else-if="editingBlock.type === 'divider'" class="text-sm text-text-muted">Horizontal rule — no properties.</p>

          <!-- ── Link card ── -->
          <div v-else-if="editingBlock.type === 'link-card'" class="space-y-3">
            <label class="block text-xs font-semibold uppercase text-text-muted">URL</label>
            <input :value="(editingBlock as LinkCardBlock).url" @input="updateBlock(editingBlock.id, { url: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="https://…" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Title</label>
            <input :value="(editingBlock as LinkCardBlock).title" @input="updateBlock(editingBlock.id, { title: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Description</label>
            <input :value="(editingBlock as LinkCardBlock).description ?? ''" @input="updateBlock(editingBlock.id, { description: ($event.target as HTMLInputElement).value })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" />
            <label class="block text-xs font-semibold uppercase text-text-muted">Thumbnail URL (optional)</label>
            <input :value="(editingBlock as LinkCardBlock).imageUrl ?? ''" @input="updateBlock(editingBlock.id, { imageUrl: ($event.target as HTMLInputElement).value || undefined })" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent" placeholder="https://…" />
          </div>

        </template>
      </div>
    </div>
  </div>
</template>
