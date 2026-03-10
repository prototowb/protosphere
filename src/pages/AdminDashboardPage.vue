<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAdminStats } from '@/composables/useAdminStats'

const router = useRouter()
const { stats, loading, loadStats } = useAdminStats()

onMounted(loadStats)
</script>

<template>
  <div class="flex flex-1 flex-col overflow-y-auto p-6">
    <h1 class="mb-6 text-2xl font-bold text-text-primary">Admin Dashboard</h1>

    <div v-if="loading" class="grid grid-cols-2 gap-4">
      <div v-for="i in 4" :key="i" class="rounded-xl bg-bg-secondary p-6 animate-pulse">
        <div class="mb-2 h-8 w-16 rounded bg-bg-tertiary" />
        <div class="h-4 w-24 rounded bg-bg-tertiary" />
      </div>
    </div>

    <div v-else class="grid grid-cols-2 gap-4">
      <!-- Members -->
      <div class="rounded-xl bg-bg-secondary p-6">
        <p class="mb-1 text-3xl font-bold text-text-primary">{{ stats.members }}</p>
        <p class="mb-4 text-sm text-text-secondary">Members</p>
        <button
          @click="router.push('/community/members')"
          class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
        >
          View Directory
        </button>
      </div>

      <!-- Pending Approvals -->
      <div class="rounded-xl bg-bg-secondary p-6">
        <p class="mb-1 text-3xl font-bold" :class="stats.pendingApprovals > 0 ? 'text-warning' : 'text-text-primary'">
          {{ stats.pendingApprovals }}
        </p>
        <p class="mb-4 text-sm text-text-secondary">Pending Approvals</p>
        <button
          @click="router.push('/admin/approvals')"
          class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Review
        </button>
      </div>

      <!-- Open Reports -->
      <div class="rounded-xl bg-bg-secondary p-6">
        <p class="mb-1 text-3xl font-bold" :class="stats.openReports > 0 ? 'text-danger' : 'text-text-primary'">
          {{ stats.openReports }}
        </p>
        <p class="mb-4 text-sm text-text-secondary">Open Reports</p>
        <button
          @click="router.push('/admin/modqueue')"
          class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Review
        </button>
      </div>

      <!-- Spaces -->
      <div class="rounded-xl bg-bg-secondary p-6">
        <p class="mb-1 text-3xl font-bold text-text-primary">{{ stats.spaces }}</p>
        <p class="mb-4 text-sm text-text-secondary">Spaces</p>
        <button
          @click="router.push('/admin/community')"
          class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Manage
        </button>
      </div>
    </div>

    <!-- Quick links -->
    <div class="mt-6">
      <h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-text-muted">Quick Links</h2>
      <div class="flex flex-wrap gap-2">
        <router-link
          to="/admin/community"
          class="rounded-md border border-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          Community Settings
        </router-link>
        <router-link
          to="/admin/approvals"
          class="rounded-md border border-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          Approvals Queue
        </router-link>
        <router-link
          to="/admin/modqueue"
          class="rounded-md border border-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          Mod Queue
        </router-link>
        <router-link
          to="/community/members"
          class="rounded-md border border-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover hover:text-text-primary transition-colors"
        >
          Member Directory
        </router-link>
      </div>
    </div>
  </div>
</template>
