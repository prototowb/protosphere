<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServersStore } from '@/stores/servers'
import { useServers } from '@/composables/useServers'

const route = useRoute()
const router = useRouter()
const serversStore = useServersStore()
const { fetchServers, updateServer, deleteServer } = useServers()

const serverId = ref(route.params.serverId as string)
const name = ref('')
const description = ref('')
const saving = ref(false)
const saveSuccess = ref(false)
const error = ref('')

onMounted(async () => {
  if (serversStore.servers.length === 0) {
    await fetchServers()
  }
  loadServer()
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
  }
}

async function handleSave() {
  saving.value = true
  saveSuccess.value = false
  error.value = ''
  try {
    await updateServer(serverId.value, {
      name: name.value,
      description: description.value,
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 3000)
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (!confirm('Are you sure you want to delete this server? This cannot be undone.')) return
  await deleteServer(serverId.value)
  router.push('/channels/@me')
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

      <div v-if="saveSuccess" class="mb-4 rounded bg-green-500/10 px-4 py-3 text-sm text-green-400">
        Settings saved!
      </div>

      <form @submit.prevent="handleSave" class="space-y-4">
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
            @click="handleDelete"
            class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10"
          >
            Delete Server
          </button>
        </div>
      </form>
    </div>
  </div>
</template>
