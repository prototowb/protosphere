<script setup lang="ts">
import { ref } from 'vue'
import ChannelPermissionsPanel from '@/components/channel/ChannelPermissionsPanel.vue'

const props = defineProps<{
  name: string
  description: string
  slowmodeSeconds: number
  channelId?: string
  serverId?: string
}>()

const emit = defineEmits<{
  save: [data: { name: string; description: string; slowmodeSeconds: number }]
  close: []
}>()

const editName = ref(props.name)
const editDescription = ref(props.description)
const editSlowmode = ref(props.slowmodeSeconds)
const activeTab = ref<'general' | 'permissions'>('general')

const showPermissions = !!(props.channelId && props.serverId)

function submit() {
  if (!editName.value.trim()) return
  emit('save', {
    name: editName.value.trim(),
    description: editDescription.value.trim(),
    slowmodeSeconds: editSlowmode.value,
  })
}
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="emit('close')">
    <div class="w-full rounded-lg bg-bg-secondary p-6" :class="showPermissions ? 'max-w-2xl' : 'max-w-md'">
      <h2 class="mb-4 text-xl font-bold">Edit Channel</h2>

      <!-- Tabs (only if permissions available) -->
      <div v-if="showPermissions" class="mb-4 flex gap-1 border-b border-bg-tertiary">
        <button
          @click="activeTab = 'general'"
          class="px-4 py-2 text-sm transition-colors"
          :class="activeTab === 'general' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'"
        >
          General
        </button>
        <button
          @click="activeTab = 'permissions'"
          class="px-4 py-2 text-sm transition-colors"
          :class="activeTab === 'permissions' ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'"
        >
          Permissions
        </button>
      </div>

      <!-- General tab -->
      <div v-if="activeTab === 'general'">
        <form @submit.prevent="submit" class="space-y-4">
          <div>
            <label for="edit-channel-name" class="mb-1 block text-sm text-text-secondary">Channel Name</label>
            <input
              id="edit-channel-name"
              v-model="editName"
              type="text"
              required
              maxlength="50"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div>
            <label for="edit-channel-desc" class="mb-1 block text-sm text-text-secondary">Description</label>
            <input
              id="edit-channel-desc"
              v-model="editDescription"
              type="text"
              maxlength="200"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
              placeholder="What's this channel about?"
            />
          </div>
          <div>
            <label for="edit-channel-slowmode" class="mb-1 block text-sm text-text-secondary">Slowmode (seconds, 0 = off)</label>
            <input
              id="edit-channel-slowmode"
              v-model.number="editSlowmode"
              type="number"
              min="0"
              max="3600"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
            />
          </div>
          <div class="flex justify-end gap-2">
            <button type="button" @click="emit('close')" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
            <button type="submit" :disabled="!editName.trim()" class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50">Save</button>
          </div>
        </form>
      </div>

      <!-- Permissions tab -->
      <div v-else-if="activeTab === 'permissions' && channelId && serverId">
        <ChannelPermissionsPanel :channel-id="channelId" :server-id="serverId" />
        <div class="mt-4 flex justify-end">
          <button @click="emit('close')" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>
