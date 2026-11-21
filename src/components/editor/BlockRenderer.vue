<script setup lang="ts">
import { computed } from 'vue'
import type { PageContent, Block, TextBlock } from '@/lib/types'
import { sanitizeRichText as sanitise, safeHttpUrl, safeImageUrl, backgroundImageStyle, scopeCustomCss } from '@/lib/pageSanitize'

const props = defineProps<{ content: PageContent }>()

// Page content is authored by one user and rendered for every viewer: every
// HTML string, URL, inline style and stylesheet goes through pageSanitize.
function heroStyle(b: Extract<Block, { type: 'hero' }>) {
  return backgroundImageStyle(b.backgroundUrl)
}

const calloutClass: Record<string, string> = {
  info:    'border-sky-500/40 bg-sky-500/10 text-sky-300',
  warning: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  success: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
  error:   'border-red-500/40 bg-red-500/10 text-red-300',
}

const variantWrap: Record<string, string> = {
  quote:     'border-l-4 border-accent/40 pl-4',
  highlight: 'rounded-lg border border-accent/20 bg-accent/5 px-4 py-3',
}

function textWrapClass(b: TextBlock): string {
  return (b._pinned && b._variant && b._variant !== 'default') ? (variantWrap[b._variant] ?? '') : ''
}

const scopeId = computed(() => `bpe-${Math.random().toString(36).slice(2, 7)}`)
const scopedCss = computed(() => scopeCustomCss(props.content?.customCss, scopeId.value))
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
        <div v-if="heroStyle(block)" class="absolute inset-0 rounded-xl bg-black/40" />
        <div class="relative" :class="{ 'text-center': block.textAlign === 'center', 'text-right': block.textAlign === 'right' }">
          <h1 class="text-3xl font-bold leading-tight text-white drop-shadow">{{ block.title }}</h1>
          <p v-if="block.subtitle" class="mt-2 text-lg text-white/80 drop-shadow">{{ block.subtitle }}</p>
        </div>
      </div>

      <!-- Text -->
      <div v-else-if="block.type === 'text'" :class="textWrapClass(block)">
        <div class="prose prose-invert max-w-none text-text-secondary" v-html="sanitise(block.html)" />
        <p v-if="block._author || block._date" class="mt-1 text-xs opacity-40">
          — {{ [block._author, block._date ? new Date(block._date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : null].filter(Boolean).join(' · ') }}
        </p>
      </div>

      <!-- Image -->
      <figure v-else-if="block.type === 'image'">
        <img :src="safeImageUrl(block.url)" :alt="block.caption ?? ''" class="rounded-lg
        object-cover"  :class="block.fullWidth ? 'w-full' : 'mx-auto max-w-2xl'"
        />
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
        :href="safeHttpUrl(block.url)"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="flex items-center gap-4 rounded-lg border border-bg-tertiary bg-bg-secondary px-4 py-3 hover:border-accent/40 hover:bg-bg-hover transition-colors"
      >
        <img v-if="safeImageUrl(block.imageUrl)" :src="safeImageUrl(block.imageUrl)" class="h-12 w-12 flex-shrink-0 rounded object-cover" alt="" />
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
