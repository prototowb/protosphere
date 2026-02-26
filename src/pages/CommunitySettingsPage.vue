<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCommunityStore } from '@/stores/community'
import { useCommunity } from '@/composables/useCommunity'
import { useToastStore } from '@/stores/toast'
import type { RegistrationMode } from '@/lib/types'

const router = useRouter()
const communityStore = useCommunityStore()
const { fetchCommunity, updateCommunity } = useCommunity()
const toastStore = useToastStore()

onMounted(() => fetchCommunity())

const saving = ref(false)
const name = ref('')
const description = ref('')
const rules = ref('')
const welcomeMessage = ref('')
const registrationMode = ref<RegistrationMode>('open')

watch(
  () => communityStore.settings,
  (s) => {
    if (s) {
      name.value = s.name
      description.value = s.description
      rules.value = s.rules
      welcomeMessage.value = s.welcome_message
      registrationMode.value = s.registration_mode
    }
  },
  { immediate: true },
)

async function handleSave() {
  saving.value = true
  try {
    await updateCommunity({
      name: name.value.trim(),
      description: description.value.trim(),
      rules: rules.value.trim(),
      welcome_message: welcomeMessage.value.trim(),
      registration_mode: registrationMode.value,
    })
    toastStore.show('Community settings saved', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to save settings', 'error')
  } finally {
    saving.value = false
  }
}

const REGISTRATION_OPTIONS: { value: RegistrationMode; label: string; desc: string }[] = [
  { value: 'open', label: 'Open', desc: 'Anyone can register' },
  { value: 'approval', label: 'Approval', desc: 'Admin must approve' },
  { value: 'invite_only', label: 'Invite Only', desc: 'Invite code required' },
  { value: 'closed', label: 'Closed', desc: 'No new registrations' },
]
</script>

<template>
  <div class="flex h-screen overflow-hidden bg-bg-primary">
    <!-- Page header -->
    <div class="flex flex-1 flex-col">
      <header class="flex h-14 flex-shrink-0 items-center gap-3 border-b border-bg-tertiary px-6">
        <button
          @click="router.back()"
          class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary"
          title="Back"
        >
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 class="text-lg font-semibold">Community Settings</h1>
      </header>

      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-2xl space-y-6">

          <!-- Identity section -->
          <section>
            <h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Community Identity</h2>
            <div class="space-y-4 rounded-lg bg-bg-secondary p-4">
              <div>
                <label class="mb-1 block text-sm font-medium text-text-secondary">Community Name</label>
                <input
                  v-model="name"
                  type="text"
                  maxlength="100"
                  class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
                  placeholder="My Community"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-text-secondary">Description</label>
                <textarea
                  v-model="description"
                  maxlength="1000"
                  rows="3"
                  class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent"
                  placeholder="What's this community about?"
                />
              </div>
            </div>
          </section>

          <!-- Registration section -->
          <section>
            <h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Registration</h2>
            <div class="rounded-lg bg-bg-secondary p-4">
              <label class="mb-2 block text-sm font-medium text-text-secondary">Registration Mode</label>
              <div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <label
                  v-for="opt in REGISTRATION_OPTIONS"
                  :key="opt.value"
                  class="cursor-pointer rounded border p-3 text-center transition-colors"
                  :class="registrationMode === opt.value ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:border-bg-hover'"
                >
                  <input v-model="registrationMode" type="radio" :value="opt.value" class="sr-only" />
                  <p class="text-sm font-medium">{{ opt.label }}</p>
                  <p class="mt-0.5 text-[11px] text-text-muted">{{ opt.desc }}</p>
                </label>
              </div>
            </div>
          </section>

          <!-- Rules section -->
          <section>
            <h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Community Rules</h2>
            <div class="rounded-lg bg-bg-secondary p-4">
              <textarea
                v-model="rules"
                maxlength="5000"
                rows="6"
                class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                placeholder="1. Be respectful&#10;2. No spam&#10;..."
              />
              <p class="mt-1 text-xs text-text-muted">Shown to new members during onboarding.</p>
            </div>
          </section>

          <!-- Welcome message section -->
          <section>
            <h2 class="mb-4 text-xs font-semibold uppercase tracking-wide text-text-muted">Welcome Message</h2>
            <div class="rounded-lg bg-bg-secondary p-4">
              <textarea
                v-model="welcomeMessage"
                maxlength="2000"
                rows="4"
                class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-sm text-text-primary outline-none focus:border-accent"
                placeholder="Welcome to our community! We're glad you're here."
              />
              <p class="mt-1 text-xs text-text-muted">Displayed to new members after joining.</p>
            </div>
          </section>

          <!-- Save button -->
          <div class="flex justify-end">
            <button
              @click="handleSave"
              :disabled="saving"
              class="rounded bg-accent px-6 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ saving ? 'Saving…' : 'Save Changes' }}
            </button>
          </div>

        </div>
      </div>
    </div>
  </div>
</template>
