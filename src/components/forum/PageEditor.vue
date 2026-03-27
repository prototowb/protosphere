<script setup lang="ts">
import { computed, watch, onBeforeUnmount } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'

const props = defineProps<{
  modelValue: Record<string, unknown> | null
  editable: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: Record<string, unknown>]
}>()

const editor = useEditor({
  content: props.modelValue ?? undefined,
  editable: props.editable,
  extensions: [
    StarterKit,
    Link.configure({ openOnClick: !props.editable, HTMLAttributes: { class: 'text-accent underline' } }),
    Image.configure({ HTMLAttributes: { class: 'max-w-full rounded-lg my-2' } }),
    Placeholder.configure({ placeholder: 'Start writing your page…' }),
  ],
  onUpdate({ editor: e }) {
    emit('update:modelValue', e.getJSON() as Record<string, unknown>)
  },
})

const toolbarItems = computed(() => {
  const e = editor.value
  if (!e) return []
  return [
    { label: 'Bold', icon: 'B', action: () => e.chain().focus().toggleBold().run(), active: e.isActive('bold') },
    { label: 'Italic', icon: 'I', action: () => e.chain().focus().toggleItalic().run(), active: e.isActive('italic') },
    { label: 'Code', icon: '<>', action: () => e.chain().focus().toggleCode().run(), active: e.isActive('code') },
    { label: 'sep1', icon: '|', action: () => {}, active: false },
    { label: 'H1', icon: 'H1', action: () => e.chain().focus().toggleHeading({ level: 1 }).run(), active: e.isActive('heading', { level: 1 }) },
    { label: 'H2', icon: 'H2', action: () => e.chain().focus().toggleHeading({ level: 2 }).run(), active: e.isActive('heading', { level: 2 }) },
    { label: 'H3', icon: 'H3', action: () => e.chain().focus().toggleHeading({ level: 3 }).run(), active: e.isActive('heading', { level: 3 }) },
    { label: 'sep2', icon: '|', action: () => {}, active: false },
    { label: 'Bullet list', icon: '•—', action: () => e.chain().focus().toggleBulletList().run(), active: e.isActive('bulletList') },
    { label: 'Ordered list', icon: '1.', action: () => e.chain().focus().toggleOrderedList().run(), active: e.isActive('orderedList') },
    { label: 'Blockquote', icon: '❝', action: () => e.chain().focus().toggleBlockquote().run(), active: e.isActive('blockquote') },
    { label: 'Code block', icon: '{}', action: () => e.chain().focus().toggleCodeBlock().run(), active: e.isActive('codeBlock') },
    { label: 'sep3', icon: '|', action: () => {}, active: false },
    { label: 'Horizontal rule', icon: '—', action: () => e.chain().focus().setHorizontalRule().run(), active: false },
  ]
})

watch(() => props.editable, (val) => {
  editor.value?.setEditable(val)
})

watch(() => props.modelValue, (val) => {
  if (!editor.value) return
  const current = editor.value.getJSON()
  if (JSON.stringify(current) !== JSON.stringify(val)) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    editor.value.commands.setContent((val ?? null) as any)
  }
})

onBeforeUnmount(() => editor.value?.destroy())
</script>

<template>
  <div class="page-editor">
    <!-- Toolbar (edit mode only) -->
    <div
      v-if="editable && editor"
      class="mb-3 flex flex-wrap gap-1 rounded-lg bg-bg-secondary p-1.5"
    >
      <template v-for="item in toolbarItems" :key="item.label">
        <span v-if="item.icon === '|'" class="mx-1 self-stretch border-l border-bg-tertiary" />
        <button
          v-else
          @click="item.action"
          :class="[
            'rounded px-2 py-1 text-xs font-medium transition-colors',
            item.active ? 'bg-accent text-white' : 'text-text-muted hover:bg-bg-hover hover:text-text-primary',
          ]"
          :title="item.label"
        >
          {{ item.icon }}
        </button>
      </template>
    </div>

    <!-- Editor content -->
    <EditorContent
      :editor="editor"
      :class="[
        'prose-editor',
        editable && 'rounded-lg bg-bg-secondary px-4 py-3 ring-1 ring-bg-tertiary focus-within:ring-accent',
      ]"
    />
  </div>
</template>

<style>
.prose-editor .tiptap { outline: none; min-height: 200px; color: var(--color-text-primary); line-height: 1.7; }
.prose-editor .tiptap p { margin-bottom: 0.75rem; }
.prose-editor .tiptap h1 { font-size: 1.75rem; font-weight: 700; margin: 1.25rem 0 0.5rem; }
.prose-editor .tiptap h2 { font-size: 1.375rem; font-weight: 600; margin: 1.125rem 0 0.5rem; }
.prose-editor .tiptap h3 { font-size: 1.125rem; font-weight: 600; margin: 1rem 0 0.375rem; }
.prose-editor .tiptap ul { list-style: disc; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose-editor .tiptap ol { list-style: decimal; padding-left: 1.5rem; margin-bottom: 0.75rem; }
.prose-editor .tiptap li { margin-bottom: 0.25rem; }
.prose-editor .tiptap blockquote { border-left: 3px solid var(--color-accent); padding-left: 1rem; color: var(--color-text-muted); margin: 0.75rem 0; }
.prose-editor .tiptap code { background: var(--color-bg-tertiary); border-radius: 3px; padding: 0.125rem 0.25rem; font-size: 0.875em; font-family: monospace; }
.prose-editor .tiptap pre { background: var(--color-bg-tertiary); border-radius: 6px; padding: 0.75rem 1rem; margin: 0.75rem 0; overflow-x: auto; }
.prose-editor .tiptap pre code { background: none; padding: 0; }
.prose-editor .tiptap hr { border: none; border-top: 1px solid var(--color-bg-tertiary); margin: 1rem 0; }
.prose-editor .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--color-text-muted); pointer-events: none; float: left; height: 0; }
</style>
