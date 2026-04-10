<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useProfile } from '@/composables/useProfile'
import EmojiIcon from '@/components/ui/EmojiIcon.vue'

const emit = defineEmits<{ done: [] }>()

const router = useRouter()
const authStore = useAuthStore()
const { profile, fetchProfile } = useProfile()

const step = ref(0)
const saving = ref(false)

// Profile setup state
const displayName = ref('')
const bio = ref('')

const TOTAL_STEPS = 4

const isLast = computed(() => step.value === TOTAL_STEPS - 1)

function next() {
  if (step.value < TOTAL_STEPS - 1) step.value++
}

async function finish() {
  if (!authStore.user?.id) return
  saving.value = true

  // Save display name / bio if changed
  const updates: Record<string, string> = {}
  if (displayName.value.trim() && displayName.value.trim() !== profile.value?.display_name) {
    updates.display_name = displayName.value.trim()
  }
  if (bio.value.trim() && bio.value.trim() !== profile.value?.bio) {
    updates.bio = bio.value.trim()
  }
  if (Object.keys(updates).length) {
    await backend.profiles.update(authStore.user.id, updates).catch(() => {})
  }

  await backend.profiles.completeOnboarding(authStore.user.id).catch(() => {})
  await fetchProfile()
  saving.value = false
  emit('done')
}

async function skip() {
  if (!authStore.user?.id) return
  await backend.profiles.completeOnboarding(authStore.user.id).catch(() => {})
  emit('done')
}

function goToSettings() {
  finish().then(() => router.push('/settings'))
}

// Initialise profile fields when profile loads
function initProfileFields() {
  if (profile.value) {
    displayName.value = profile.value.display_name ?? ''
    bio.value = profile.value.bio ?? ''
  }
}

// Watch for profile to arrive (it may load after mount)
onMounted(initProfileFields)
watch(() => profile.value?.id, initProfileFields)
</script>

<template>
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div class="absolute inset-0 bg-black/70" />

    <div class="relative z-10 w-full max-w-lg rounded-2xl bg-bg-secondary shadow-2xl overflow-hidden flex flex-col">

      <!-- Progress bar -->
      <div class="h-1 bg-bg-tertiary">
        <div
          class="h-full bg-accent transition-all duration-300"
          :style="{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }"
        />
      </div>

      <!-- Step content -->
      <div class="flex-1 p-8 min-h-[340px] flex flex-col">

        <!-- Step 0: Welcome -->
        <template v-if="step === 0">
          <div class="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <div class="text-5xl"><EmojiIcon emoji="👋" size="3rem" /></div>
            <h2 class="text-2xl font-bold text-text-primary">Welcome to Protosphere</h2>
            <p class="text-text-secondary text-sm max-w-sm">
              Let's take a quick tour so you know how this community works. It only takes a minute.
            </p>
            <p class="text-xs text-text-muted mt-2">Step 1 of {{ TOTAL_STEPS }}</p>
          </div>
        </template>

        <!-- Step 1: Message rules -->
        <template v-else-if="step === 1">
          <h2 class="text-xl font-bold text-text-primary mb-1">How messages work</h2>
          <p class="text-sm text-text-muted mb-6">This community uses ephemeral messaging to keep things fresh.</p>

          <div class="space-y-4 flex-1">
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="💬" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">Channel messages expire after 3 days</p>
                <p class="text-xs text-text-muted mt-0.5">Text chat is intentionally short-lived — like real conversation.</p>
              </div>
            </div>
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="✉️" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">DMs are kept for 6 months</p>
                <p class="text-xs text-text-muted mt-0.5">Private conversations stick around longer, but still expire eventually.</p>
              </div>
            </div>
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="📌" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">Forum posts are permanent</p>
                <p class="text-xs text-text-muted mt-0.5">Promote a message to a forum post to save it forever. Great for important discussions.</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Step 2: Platform tour -->
        <template v-else-if="step === 2">
          <h2 class="text-xl font-bold text-text-primary mb-1">Finding your way around</h2>
          <p class="text-sm text-text-muted mb-6">Here's a quick map of the interface.</p>

          <div class="space-y-4 flex-1">
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="🗂️" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">Spaces sidebar</p>
                <p class="text-xs text-text-muted mt-0.5">The left sidebar lists community spaces. Each space has its own channels and forum section.</p>
              </div>
            </div>
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="📋" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">Forum section</p>
                <p class="text-xs text-text-muted mt-0.5">Below the channels in each space you'll find the forum — permanent posts with voting and discussion.</p>
              </div>
            </div>
            <div class="flex items-start gap-4 rounded-lg bg-bg-tertiary/60 p-4">
              <div class="flex-shrink-0 text-2xl"><EmojiIcon emoji="💌" size="1.8rem" /></div>
              <div>
                <p class="font-semibold text-text-primary text-sm">Direct Messages</p>
                <p class="text-xs text-text-muted mt-0.5">Click the DMs link in the top bar to open private conversations with other members.</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Step 3: Profile setup -->
        <template v-else-if="step === 3">
          <h2 class="text-xl font-bold text-text-primary mb-1">Set up your profile</h2>
          <p class="text-sm text-text-muted mb-6">Let the community know who you are. You can always update this in Settings.</p>

          <div class="space-y-4 flex-1">
            <div>
              <label class="block text-xs font-medium text-text-muted mb-1">Display name</label>
              <input
                v-model="displayName"
                maxlength="50"
                placeholder="Your display name"
                class="w-full rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:ring-1 focus:ring-accent"
              />
            </div>
            <div>
              <label class="block text-xs font-medium text-text-muted mb-1">Bio <span class="text-text-muted font-normal">(optional)</span></label>
              <textarea
                v-model="bio"
                maxlength="160"
                rows="3"
                placeholder="Tell the community a bit about yourself…"
                class="w-full rounded-lg bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder-text-muted outline-none focus:ring-1 focus:ring-accent resize-none"
              />
            </div>
            <button
              @click="goToSettings"
              class="text-xs text-accent hover:underline"
            >
              Add avatar, pronouns, website and more in Settings →
            </button>
          </div>
        </template>

      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between border-t border-bg-tertiary px-8 py-4">
        <!-- Progress dots -->
        <div class="flex items-center gap-1.5">
          <button
            v-for="i in TOTAL_STEPS"
            :key="i"
            @click="step = i - 1"
            class="h-2 rounded-full transition-all duration-200"
            :class="step === i - 1 ? 'w-5 bg-accent' : 'w-2 bg-bg-hover hover:bg-text-muted'"
          />
        </div>

        <div class="flex items-center gap-3">
          <button
            v-if="!isLast"
            @click="skip"
            class="text-sm text-text-muted hover:text-text-secondary"
          >
            Skip tour
          </button>
          <button
            v-if="!isLast"
            @click="next"
            class="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover"
          >
            Next
          </button>
          <button
            v-else
            @click="finish"
            :disabled="saving"
            class="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
          >
            {{ saving ? 'Saving…' : 'Get started' }}
          </button>
        </div>
      </div>

    </div>
  </div>
</template>
