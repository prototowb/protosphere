<script setup lang="ts">
import type { Channel, NotificationLevel } from '@/lib/types'

const props = defineProps<{
  channel: Channel
  serverId: string
  isActive: boolean
  hasUnread: boolean
  canDrag: boolean
  notificationLevel: NotificationLevel
  showNotifPopover: boolean
  dragOverTarget: boolean
  notifOptions: { value: NotificationLevel; label: string }[]
}>()

const emit = defineEmits<{
  click: []
  contextmenu: [event: MouseEvent]
  dragstart: []
  dragover: []
  dragleave: []
  drop: []
  dragend: []
  openNotifPopover: []
  setNotifLevel: [level: NotificationLevel]
}>()
</script>

<template>
  <div class="group relative">
    <router-link
      :to="`/channels/${props.serverId}/${props.channel.id}`"
      :draggable="props.canDrag"
      @click="emit('click')"
      @contextmenu.prevent="emit('contextmenu', $event)"
      @dragstart.stop="emit('dragstart')"
      @dragover.prevent.stop="emit('dragover')"
      @dragleave.stop="emit('dragleave')"
      @drop.prevent.stop="emit('drop')"
      @dragend.stop="emit('dragend')"
      class="flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-sm hover:bg-bg-hover"
      :class="[
        props.isActive ? 'bg-bg-hover text-text-primary font-medium' : 'text-text-secondary',
        props.dragOverTarget ? 'border-t-2 border-accent' : '',
        props.canDrag ? 'cursor-pointer' : '',
      ]"
    >
      <span class="text-text-muted">#</span>
      <span class="truncate flex-1">{{ props.channel.name }}</span>
      <span class="ml-auto flex items-center gap-1">
        <span v-if="props.hasUnread" class="h-2 w-2 flex-shrink-0 rounded-full bg-white" />
        <button
          :class="props.notificationLevel !== 'all' ? 'flex' : 'hidden group-hover:flex'"
          class="flex-shrink-0 items-center rounded p-0.5 text-text-muted hover:text-text-primary"
          @click.prevent.stop="emit('openNotifPopover')"
          title="Notification settings"
        >
          <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
        </button>
      </span>
    </router-link>
    <!-- Notification popover -->
    <div
      v-if="props.showNotifPopover"
      class="absolute right-0 top-full z-50 mt-1 min-w-32 rounded-lg bg-bg-primary p-1 shadow-lg ring-1 ring-bg-tertiary"
      @click.stop
    >
      <button
        v-for="opt in props.notifOptions"
        :key="opt.value"
        @click="emit('setNotifLevel', opt.value)"
        class="flex w-full items-center gap-2 rounded px-3 py-1.5 text-xs hover:bg-bg-hover"
        :class="props.notificationLevel === opt.value ? 'text-accent' : 'text-text-secondary'"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
