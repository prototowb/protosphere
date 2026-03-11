<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'
import { loadEmojiData, getEmojiData } from '@/lib/emojiNames'

const emit = defineEmits<{ select: [emoji: string] }>()

const CATEGORY_ICONS: Record<string, string> = {
  people:   '😀',
  nature:   '🐶',
  foods:    '🍕',
  activity: '⚽',
  places:   '✈️',
  objects:  '💡',
  symbols:  '❤️',
  flags:    '🏳️',
}

const search = ref('')
const activeCategory = ref('')
const categories = ref<Array<{ id: string; emojis: string[] }>>([])

onMounted(async () => {
  await loadEmojiData()
  const d = getEmojiData()
  if (!d) return
  categories.value = d.categories
  activeCategory.value = d.categories[0]?.id ?? ''
})

const visibleEmojis = computed<Array<{ native: string; name: string }>>(() => {
  const d = getEmojiData()
  if (!d) return []
  if (search.value.trim()) {
    const q = search.value.toLowerCase()
    return Object.entries(d.names)
      .filter(([, e]) => e.name.toLowerCase().includes(q) || e.id.includes(q))
      .slice(0, 80)
      .map(([native, e]) => ({ native, name: e.name }))
  }
  const cat = categories.value.find(c => c.id === activeCategory.value)
  return (cat?.emojis ?? [])
    .map(native => {
      const e = d.names[native]
      return e ? { native, name: e.name } : null
    })
    .filter((e): e is { native: string; name: string } => e !== null)
})
</script>

<template>
  <div class="ep-root">
    <div class="ep-search">
      <input v-model="search" class="ep-input" placeholder="Search emoji…" />
    </div>
    <div v-if="!search" class="ep-cats">
      <button
        v-for="cat in categories"
        :key="cat.id"
        class="ep-cat-btn"
        :class="{ active: activeCategory === cat.id }"
        @click="activeCategory = cat.id"
        :title="cat.id"
      >
        <EmojiIcon :emoji="CATEGORY_ICONS[cat.id] ?? '❓'" size="1em" />
      </button>
    </div>
    <div class="ep-grid">
      <button
        v-for="e in visibleEmojis"
        :key="e.native"
        class="ep-emoji-btn"
        :title="e.name"
        @click="emit('select', e.native)"
      >
        <EmojiIcon :emoji="e.native" size="1.4em" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.ep-root {
  width: 352px;
  max-height: 440px;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-secondary);
  border-radius: 0.75rem;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
  overflow: hidden;
}

.ep-search {
  padding: 12px 12px 8px;
  flex-shrink: 0;
}

.ep-input {
  width: 100%;
  box-sizing: border-box;
  background-color: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  border: 1px solid rgba(148, 163, 184, 0.12);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.875rem;
  outline: none;
  font-family: inherit;
}

.ep-input:focus {
  border-color: rgba(99, 102, 241, 0.5);
}

.ep-cats {
  display: flex;
  padding: 0 8px 6px;
  border-bottom: 1px solid rgba(148, 163, 184, 0.12);
  flex-shrink: 0;
}

.ep-cat-btn {
  flex: 1;
  padding: 5px 0;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  cursor: pointer;
  opacity: 0.6;
  transition: opacity 0.1s, background 0.1s;
}

.ep-cat-btn:hover,
.ep-cat-btn.active {
  opacity: 1;
}

.ep-cat-btn.active {
  background: rgba(99, 102, 241, 0.25);
}

.ep-grid {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(9, 1fr);
  gap: 1px;
  align-content: start;
}

.ep-emoji-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  border-radius: 6px;
  padding: 3px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background 0.1s;
}

.ep-emoji-btn:hover {
  background: rgba(248, 250, 252, 0.06);
}
</style>
