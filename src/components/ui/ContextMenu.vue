<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useContextMenuStore } from '@/stores/contextMenu'

const menu = useContextMenuStore()

function handleClick(action: () => void) {
  action()
  menu.hide()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') menu.hide()
}

function onScroll() {
  if (menu.visible) menu.hide()
}

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  document.addEventListener('scroll', onScroll, true)
})
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('scroll', onScroll, true)
})
</script>

<template>
  <Teleport to="body">
    <!-- Backdrop -->
    <div
      v-if="menu.visible"
      class="fixed inset-0 z-[10000]"
      @click="menu.hide()"
      @contextmenu.prevent="menu.hide()"
    />
    <!-- Menu -->
    <Transition
      enter-active-class="transition-all duration-100 ease-out"
      leave-active-class="transition-all duration-75 ease-in"
      enter-from-class="scale-95 opacity-0"
      enter-to-class="scale-100 opacity-100"
      leave-from-class="scale-100 opacity-100"
      leave-to-class="scale-95 opacity-0"
    >
      <div
        v-if="menu.visible"
        class="fixed z-[10001] min-w-48 rounded-lg border border-bg-tertiary bg-bg-secondary p-1 shadow-xl"
        :style="{ left: menu.x + 'px', top: menu.y + 'px' }"
      >
        <template v-for="(item, i) in menu.items" :key="i">
          <div v-if="item.separator" class="my-1 h-px bg-bg-tertiary" />
          <button
            v-else
            @click="handleClick(item.action)"
            class="flex w-full items-center gap-2 rounded px-3 py-1.5 text-sm"
            :class="item.danger
              ? 'text-danger hover:bg-danger/10'
              : 'text-text-primary hover:bg-bg-hover'"
          >
            {{ item.label }}
          </button>
        </template>
      </div>
    </Transition>
  </Teleport>
</template>
