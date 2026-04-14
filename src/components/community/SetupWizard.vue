<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useCommunityStore } from '@/stores/community'
import { useServersStore } from '@/stores/servers'
import { useToastStore } from '@/stores/toast'
import { useServers } from '@/composables/useServers'
import type { RegistrationMode } from '@/lib/types'

const emit = defineEmits<{ done: [] }>()
const router = useRouter()
const authStore = useAuthStore()
const communityStore = useCommunityStore()
const serversStore = useServersStore()
const toastStore = useToastStore()
const { fetchServers } = useServers()

const TOTAL_STEPS = 4
const step = ref(1)
const loading = ref(false)

// Step 1-3: Community settings
const name = ref(communityStore.settings?.name ?? 'My Community')
const description = ref(communityStore.settings?.description ?? '')
const registrationMode = ref<RegistrationMode>(communityStore.settings?.registration_mode ?? 'open')
const rules = ref(communityStore.settings?.rules ?? '')

// Step 4: First space
const spaceName = ref('General')
const spaceDescription = ref('General discussion')
const creatingSpace = ref(false)
const spaceCreated = ref(false)

async function saveAndNext() {
  if (step.value < TOTAL_STEPS) {
    step.value++
    return
  }
  await finish()
}

async function createFirstSpace() {
  if (!authStore.user?.id || !spaceName.value.trim()) return
  creatingSpace.value = true
  try {
    const server = await backend.servers.create(
      { name: spaceName.value.trim(), description: spaceDescription.value.trim() },
      authStore.user.id,
    )
    serversStore.servers.push(server)
    await fetchServers()
    spaceCreated.value = true
    toastStore.show('Space created!', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to create space', 'error')
  } finally {
    creatingSpace.value = false
  }
}

async function finish() {
  loading.value = true
  try {
    await backend.community.update({
      name: name.value.trim(),
      description: description.value.trim(),
      registration_mode: registrationMode.value,
      rules: rules.value.trim(),
      setup_complete: true,
    } as Parameters<typeof backend.community.update>[0])
    toastStore.show('Community set up!', 'success')
    // Navigate to first space if one was created
    const firstSpace = serversStore.servers[0]
    if (firstSpace) {
      router.push(`/channels/${firstSpace.id}/${firstSpace.id}`)
    }
    emit('done')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Setup failed', 'error')
  } finally {
    loading.value = false
  }
}

const MODES: { value: RegistrationMode; label: string; description: string }[] = [
  { value: 'open', label: 'Open', description: 'Anyone can register' },
  { value: 'approval', label: 'Approval Required', description: 'Admins review each request' },
  { value: 'invite_only', label: 'Invite Only', description: 'Requires an invite token' },
  { value: 'closed', label: 'Closed', description: 'No new registrations' },
]
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
    <div class="w-full max-w-lg rounded-xl bg-bg-secondary shadow-2xl overflow-hidden">
      <!-- Header -->
      <div class="bg-accent/10 border-b border-bg-tertiary px-6 py-4">
        <h2 class="text-lg font-bold">Welcome! Let's set up your community</h2>
        <p class="mt-0.5 text-sm text-text-secondary">Step {{ step }} of {{ TOTAL_STEPS }}</p>
        <div class="mt-3 flex gap-1">
          <div v-for="i in TOTAL_STEPS" :key="i" class="h-1 flex-1 rounded-full" :class="i <= step ? 'bg-accent' : 'bg-bg-tertiary'" />
        </div>
      </div>

      <div class="p-6 space-y-4">
        <!-- Step 1: Name & Description -->
        <template v-if="step === 1">
          <div>
            <label class="mb-1 block text-sm font-medium">Community Name</label>
            <input v-model="name" type="text" maxlength="64"
              class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
          </div>
          <div>
            <label class="mb-1 block text-sm font-medium">Description <span class="text-text-muted">(optional)</span></label>
            <textarea v-model="description" rows="3" maxlength="512"
              class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
          </div>
        </template>

        <!-- Step 2: Registration Mode -->
        <template v-else-if="step === 2">
          <p class="text-sm text-text-secondary">How should new members join?</p>
          <div class="space-y-2">
            <label
              v-for="mode in MODES"
              :key="mode.value"
              class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors"
              :class="registrationMode === mode.value ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:bg-bg-hover'"
            >
              <input type="radio" v-model="registrationMode" :value="mode.value" class="mt-0.5" />
              <div>
                <p class="font-medium">{{ mode.label }}</p>
                <p class="text-xs text-text-muted">{{ mode.description }}</p>
              </div>
            </label>
          </div>
        </template>

        <!-- Step 3: Rules -->
        <template v-else-if="step === 3">
          <p class="text-sm text-text-secondary">Set community rules <span class="text-text-muted">(optional — you can update these later)</span></p>
          <textarea v-model="rules" rows="6" placeholder="1. Be respectful&#10;2. No spam&#10;..."
            class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" />
        </template>

        <!-- Step 4: Create first space -->
        <template v-else>
          <p class="text-sm text-text-secondary">Create your first space — a channel hub for your community. You can add more later from "My Community".</p>

          <div v-if="!spaceCreated" class="space-y-3">
            <div>
              <label class="mb-1 block text-sm font-medium">Space Name</label>
              <input v-model="spaceName" type="text" maxlength="50"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">Description <span class="text-text-muted">(optional)</span></label>
              <input v-model="spaceDescription" type="text" maxlength="200"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
            </div>
            <button
              @click="createFirstSpace"
              :disabled="creatingSpace || !spaceName.trim()"
              class="rounded bg-bg-tertiary px-4 py-2 text-sm font-medium text-text-primary hover:bg-bg-hover disabled:opacity-50"
            >
              {{ creatingSpace ? 'Creating…' : 'Create Space' }}
            </button>
          </div>

          <div v-else class="flex items-center gap-3 rounded-lg bg-green-500/10 px-4 py-3 text-sm text-green-400">
            <svg class="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            <span>Space "<strong>{{ spaceName }}</strong>" created.</span>
          </div>

          <p class="text-xs text-text-muted">You can skip this and create spaces later from "My Community" in the sidebar.</p>
        </template>
      </div>

      <!-- Footer -->
      <div class="flex justify-between border-t border-bg-tertiary px-6 py-4">
        <button
          v-if="step > 1"
          @click="step--"
          class="rounded px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover"
        >Back</button>
        <span v-else />

        <div class="flex items-center gap-2">
          <button
            v-if="step === TOTAL_STEPS"
            @click="finish"
            :disabled="loading"
            class="rounded px-4 py-2 text-sm text-text-muted hover:bg-bg-hover disabled:opacity-50"
          >
            {{ spaceCreated ? 'Skip' : 'Skip for now' }}
          </button>
          <button
            v-if="step < TOTAL_STEPS"
            @click="saveAndNext"
            :disabled="step === 1 && !name.trim()"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >Continue</button>
          <button
            v-else
            @click="finish"
            :disabled="loading"
            class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >{{ loading ? 'Finishing…' : (spaceCreated ? 'Finish Setup' : 'Finish Without Space') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
