<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServersStore } from '@/stores/servers'
import { useToastStore } from '@/stores/toast'
import { useServers } from '@/composables/useServers'
import { backend } from '@/lib/backend'
import type { Ban, Profile } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const serversStore = useServersStore()
const toastStore = useToastStore()
const { fetchServers, updateServer, deleteServer, unbanMember } = useServers()

const serverId = ref(route.params.serverId as string)
const name = ref('')
const description = ref('')
const iconUrl = ref<string | null>(null)
const saving = ref(false)
const error = ref('')

const bans = ref<(Ban & { profile: Profile })[]>([])
const iconInputEl = ref<HTMLInputElement | null>(null)
const showDeleteConfirm = ref(false)
const deleteConfirmName = ref('')

async function fetchBans() {
  bans.value = await backend.bans.list(serverId.value)
}

async function handleUnban(userId: string) {
  await unbanMember(serverId.value, userId)
  await fetchBans()
}

onMounted(async () => {
  if (serversStore.servers.length === 0) {
    await fetchServers()
  }
  loadServer()
  fetchBans()
})

watch(() => route.params.serverId, () => {
  serverId.value = route.params.serverId as string
  loadServer()
})

function loadServer() {
  const server = serversStore.servers.find((s) => s.id === serverId.value)
  if (server) {
    name.value = server.name
    description.value = server.description
    iconUrl.value = server.icon_url
  }
}

function handleIconSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    error.value = 'Please select an image file'
    return
  }
  if (file.size > 512 * 1024) {
    error.value = 'Image must be under 512 KB'
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    iconUrl.value = reader.result as string
  }
  reader.readAsDataURL(file)
}

function removeIcon() {
  iconUrl.value = null
  if (iconInputEl.value) iconInputEl.value.value = ''
}

async function handleSave() {
  saving.value = true
  error.value = ''
  try {
    await updateServer(serverId.value, {
      name: name.value,
      description: description.value,
      icon_url: iconUrl.value,
    })
    toastStore.show('Settings saved', 'success')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (deleteConfirmName.value !== name.value) return
  await deleteServer(serverId.value)
  toastStore.show('Server deleted', 'success')
  router.push('/channels/@me')
}

function getServerInitial(n: string) {
  return n.split(/\s+/).map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-8">
    <div class="w-full max-w-2xl rounded-lg bg-bg-secondary p-8">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Server Settings</h1>
        <button
          @click="router.push(`/channels/${serverId}/${serverId}`)"
          class="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to server
        </button>
      </div>

      <div v-if="error" class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">
        {{ error }}
      </div>

      <form @submit.prevent="handleSave" class="space-y-4">
        <!-- Server Icon -->
        <div>
          <label class="mb-2 block text-sm text-text-secondary">Server Icon</label>
          <div class="flex items-center gap-4">
            <div
              class="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-bg-tertiary"
            >
              <img
                v-if="iconUrl"
                :src="iconUrl"
                :alt="name"
                class="h-full w-full object-cover"
              />
              <span v-else class="text-xl font-bold text-text-muted">{{ getServerInitial(name || 'S') }}</span>
            </div>
            <div class="flex flex-col gap-2">
              <input
                ref="iconInputEl"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleIconSelect"
              />
              <button
                type="button"
                @click="iconInputEl?.click()"
                class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover"
              >
                Upload Image
              </button>
              <button
                v-if="iconUrl"
                type="button"
                @click="removeIcon"
                class="rounded px-3 py-1.5 text-sm text-text-muted hover:text-danger"
              >
                Remove
              </button>
              <p class="text-xs text-text-muted">Max 512 KB. JPG, PNG, or GIF.</p>
            </div>
          </div>
        </div>

        <div>
          <label for="server-name" class="mb-1 block text-sm text-text-secondary">Server Name</label>
          <input
            id="server-name"
            v-model="name"
            type="text"
            required
            maxlength="100"
            class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div>
          <label for="server-desc" class="mb-1 block text-sm text-text-secondary">Description</label>
          <textarea
            id="server-desc"
            v-model="description"
            maxlength="1000"
            rows="3"
            class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
          />
        </div>

        <div class="flex items-center justify-between pt-2">
          <button
            type="submit"
            :disabled="saving"
            class="rounded bg-accent px-6 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ saving ? 'Saving...' : 'Save changes' }}
          </button>
          <button
            type="button"
            @click="showDeleteConfirm = true"
            class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete Server
          </button>
        </div>
      </form>

      <!-- Delete confirmation dialog -->
      <div v-if="showDeleteConfirm" class="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
        <h3 class="mb-2 font-semibold text-red-400">Delete Server</h3>
        <p class="mb-3 text-sm text-text-secondary">
          This action is irreversible. Type <span class="font-semibold text-text-primary">{{ name }}</span> to confirm.
        </p>
        <input
          v-model="deleteConfirmName"
          type="text"
          :placeholder="name"
          class="mb-3 w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-red-500"
        />
        <div class="flex gap-2">
          <button
            @click="handleDelete"
            :disabled="deleteConfirmName !== name"
            class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Delete Server
          </button>
          <button
            @click="showDeleteConfirm = false; deleteConfirmName = ''"
            class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- Ban list -->
      <div class="mt-8 border-t border-bg-tertiary pt-6">
        <h2 class="mb-4 text-lg font-semibold">Banned Members</h2>
        <p v-if="bans.length === 0" class="text-sm text-text-muted">No banned members.</p>
        <div v-else class="space-y-2">
          <div
            v-for="ban in bans"
            :key="ban.user_id"
            class="flex items-center gap-3 rounded-lg bg-bg-primary px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ ban.profile.display_name }}</p>
              <p class="text-xs text-text-muted">@{{ ban.profile.username }}</p>
              <p v-if="ban.reason" class="mt-0.5 text-xs text-text-secondary">Reason: {{ ban.reason }}</p>
            </div>
            <button
              @click="handleUnban(ban.user_id)"
              class="flex-shrink-0 rounded px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Unban
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
