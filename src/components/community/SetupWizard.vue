<script setup lang="ts">
import { ref } from 'vue'
import { backend } from '@/lib/backend'
import { useCommunityStore } from '@/stores/community'
import { useToastStore } from '@/stores/toast'
import type { RegistrationMode } from '@/lib/types'

const emit = defineEmits<{ done: [] }>()
const communityStore = useCommunityStore()
const toastStore = useToastStore()

const step = ref(1)
const loading = ref(false)

const name = ref(communityStore.settings?.name ?? 'My Community')
const description = ref(communityStore.settings?.description ?? '')
const registrationMode = ref<RegistrationMode>(communityStore.settings?.registration_mode ?? 'open')
const rules = ref(communityStore.settings?.rules ?? '')

async function finish() {
  loading.value = true
  try {
    await backend.community.update({
      name: name.value.trim(),
      description: description.value.trim(),
      registration_mode: registrationMode.value,
      rules: rules.value.trim(),
    })
    // Mark setup as complete (migration 021 adds this column)
    await backend.community.update({ setup_complete: true } as Parameters<typeof backend.community.update>[0])
    toastStore.show('Community set up!', 'success')
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
        <p class="mt-0.5 text-sm text-text-secondary">Step {{ step }} of 3</p>
        <div class="mt-3 flex gap-1">
          <div v-for="i in 3" :key="i" class="h-1 flex-1 rounded-full" :class="i <= step ? 'bg-accent' : 'bg-bg-tertiary'" />
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
        <template v-else>
          <p class="text-sm text-text-secondary">Set community rules <span class="text-text-muted">(optional — you can update these later)</span></p>
          <textarea v-model="rules" rows="6" placeholder="1. Be respectful&#10;2. No spam&#10;..."
            class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" />
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

        <button
          v-if="step < 3"
          @click="step++"
          :disabled="step === 1 && !name.trim()"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >Continue</button>
        <button
          v-else
          @click="finish"
          :disabled="loading"
          class="rounded bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >{{ loading ? 'Saving...' : 'Finish Setup' }}</button>
      </div>
    </div>
  </div>
</template>
