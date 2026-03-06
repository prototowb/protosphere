<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { backend } from '@/lib/backend'
import { useToastStore } from '@/stores/toast'
import type { Profile } from '@/lib/types'

const toastStore = useToastStore()
const pendingUsers = ref<Profile[]>([])
const loading = ref(true)
const error = ref('')

async function loadPending() {
  loading.value = true
  try {
    pendingUsers.value = await backend.profiles.listPending()
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load pending users'
  } finally {
    loading.value = false
  }
}

async function approveUser(userId: string) {
  try {
    await backend.profiles.approve(userId)
    pendingUsers.value = pendingUsers.value.filter((u) => u.id !== userId)
    toastStore.show('User approved', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to approve user', 'error')
  }
}

async function rejectUser(userId: string) {
  try {
    await backend.profiles.reject(userId)
    pendingUsers.value = pendingUsers.value.filter((u) => u.id !== userId)
    toastStore.show('User rejected', 'info')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to reject user', 'error')
  }
}

onMounted(loadPending)
</script>

<template>
  <div class="mx-auto max-w-3xl p-6">
    <div class="mb-6">
      <h1 class="text-2xl font-bold">Registration Approvals</h1>
      <p class="mt-1 text-text-secondary">Review and approve or reject pending member requests.</p>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse rounded-lg bg-bg-secondary" />
    </div>

    <div v-else-if="error" class="rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error }}</div>

    <div v-else-if="pendingUsers.length === 0" class="rounded-lg bg-bg-secondary p-8 text-center text-text-muted">
      No pending approvals.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="user in pendingUsers"
        :key="user.id"
        class="flex items-center gap-4 rounded-lg bg-bg-secondary px-4 py-3"
      >
        <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 text-sm font-bold text-accent">
          {{ (user.display_name || user.username || '?').charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="font-medium">{{ user.display_name || user.username }}</p>
          <p class="text-sm text-text-muted">@{{ user.username }}</p>
        </div>
        <div class="flex gap-2">
          <button
            @click="approveUser(user.id)"
            class="rounded bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
          >Approve</button>
          <button
            @click="rejectUser(user.id)"
            class="rounded bg-red-600/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-600/30"
          >Reject</button>
        </div>
      </div>
    </div>
  </div>
</template>
