<script setup lang="ts">
import { computed } from 'vue'
import type { PageContent, Block } from '@/lib/types'

const props = defineProps<{ content: PageContent }>()

// Inline-style helpers — keeps CSS class surface minimal
function heroStyle(b: Extract<Block, { type: 'hero' }>) {
  return b.backgroundUrl
    ? `background-image:url(${b.backgroundUrl});background-size:cover;background-position:center`
    : ''
}

const calloutClass: Record<string, string> = {
  info:    'border-sky-500/40 bg-sky-500/10 text-sky-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error:   'border-red-500/40 bg-red-500/10 text-red-300',
}

// Sanitise text-block HTML — strip <script>, event attrs, javascript: hrefs
function sanitise(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  div.querySelectorAll('script,[onclick],[onerror],[onload],[onmouseover]').forEach(el => el.remove())
  div.querySelectorAll('a[href]').forEach(el => {
    const href = el.getAttribute('href') ?? ''
    if (/^javascript:/i.test(href.trim())) el.removeAttribute('href')
  })
  return div.innerHTML
}

const scopeId = computed(() => `bpe-${Math.random().toString(36).slice(2, 7)}`)
const scopedCss = computed(() => {
  const css = props.content?.customCss ?? ''
  if (!css.trim()) return ''
  // Prefix every rule with the scope id so it only affects this renderer
  return css.replace(/([^\r\n,{}]+)(,(?=[^}]*{)|\s*{)/g, (_, sel, sep) =>
    `#${scopeId.value} ${sel.trim()}${sep}`)
})
</script>

<template>
  <div :id="scopeId" class="block-renderer space-y-6">
    <!-- Scoped custom CSS -->
    <component :is="'style'" v-if="scopedCss">{{ scopedCss }}</component>

    <template v-for="block in (content.blocks ?? [])" :key="block.id">

      <!-- Hero -->
      <div
        v-if="block.type === 'hero'"
        class="relative flex min-h-40 flex-col justify-end rounded-xl p-8"
        :class="block.backgroundUrl ? '' : 'bg-gradient-to-br from-accent/30 to-bg-tertiary'"
        :style="heroStyle(block)"
      >
        <div v-if="block.backgroundUrl" class="absolute inset-0 rounded-xl bg-black/40" />
        <div class="relative" :class="{ 'text-center': block.textAlign === 'center', 'text-right': block.textAlign === 'right' }">
          <h1 class="text-3xl font-bold leading-tight text-white drop-shadow">{{ block.title }}</h1>
          <p v-if="block.subtitle" class="mt-2 text-lg text-white/80 drop-shadow">{{ block.subtitle }}</p>
        </div>
      </div>

      <!-- Text -->
      <div
        v-else-if="block.type === 'text'"
        class="prose prose-invert max-w-none text-text-secondary"
        v-html="sanitise(block.html)"
      />

      <!-- Image -->
      <figure v-else-if="block.type === 'image'" :class="block.fullWidth ? 'w-full' : 'mx-auto max-w-2xl'">
        <img :src="block.url" :alt="block.caption ?? ''" class="w-full rounded-lg object-cover" />
        <figcaption v-if="block.caption" class="mt-2 text-center text-sm text-text-muted">{{ block.caption }}</figcaption>
      </figure>

      <!-- Columns -->
      <div
        v-else-if="block.type === 'columns'"
        :class="block.cols === 3 ? 'grid grid-cols-3 gap-6' : 'grid grid-cols-2 gap-6'"
      >
        <div
          v-for="(col, i) in block.items"
          :key="i"
          class="prose prose-invert max-w-none text-text-secondary"
          v-html="sanitise(col)"
        />
      </div>

      <!-- Callout -->
      <div
        v-else-if="block.type === 'callout'"
        class="rounded-lg border px-5 py-4"
        :class="calloutClass[block.variant]"
      >
        <p v-if="block.title" class="mb-1 font-semibold">{{ block.title }}</p>
        <p class="text-sm leading-relaxed">{{ block.text }}</p>
      </div>

      <!-- Divider -->
      <hr v-else-if="block.type === 'divider'" class="border-bg-tertiary" />

      <!-- Link card -->
      <a
        v-else-if="block.type === 'link-card'"
        :href="block.url"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3 hover:border-accent/40 hover:bg-bg-hover transition-colors"
      >
        <img v-if="block.imageUrl" :src="block.imageUrl" class="h-12 w-12 flex-shrink-0 rounded object-cover" alt="" />
        <div class="min-w-0 flex-1">
          <p class="truncate font-medium text-text-primary">{{ block.title }}</p>
          <p v-if="block.description" class="truncate text-sm text-text-muted">{{ block.description }}</p>
          <p class="truncate text-xs text-accent">{{ block.url }}</p>
        </div>
      </a>

    </template>

    <p v-if="!(content.blocks ?? []).length" class="text-center text-sm text-text-muted italic">No content yet.</p>
  </div>
</template>
