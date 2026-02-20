<script setup lang="ts">
import { useUiStore } from '@/stores/ui'

const ui = useUiStore()
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Server Sidebar -->
    <aside
      v-if="ui.serverSidebarOpen"
      class="flex w-18 flex-col items-center gap-2 bg-bg-primary py-3"
    >
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-sm font-bold">
        DM
      </div>
      <div class="my-1 h-px w-8 bg-bg-tertiary" />
      <p class="text-[10px] text-text-muted">Servers</p>
    </aside>

    <!-- Channel Sidebar -->
    <aside
      v-if="ui.channelSidebarOpen"
      class="flex w-60 flex-col bg-bg-secondary"
    >
      <div class="flex h-12 items-center border-b border-bg-tertiary px-4">
        <h2 class="truncate font-semibold">Channels</h2>
      </div>
      <nav class="flex-1 overflow-y-auto p-2">
        <p class="px-2 text-sm text-text-muted"># general</p>
      </nav>
    </aside>

    <!-- Main Content -->
    <main class="flex flex-1 flex-col">
      <!-- Top Bar -->
      <header class="flex h-12 items-center border-b border-bg-tertiary bg-bg-primary px-4">
        <span class="text-text-secondary"># channel-name</span>
      </header>

      <!-- Message Area -->
      <div class="flex-1 overflow-y-auto p-4">
        <p class="text-text-muted">Messages will appear here.</p>
      </div>

      <!-- Message Input -->
      <div class="border-t border-bg-tertiary p-4">
        <div class="rounded-lg bg-bg-tertiary px-4 py-3">
          <p class="text-text-muted">Message input will go here</p>
        </div>
      </div>
    </main>

    <!-- Member Sidebar -->
    <aside
      v-if="ui.memberSidebarOpen"
      class="w-60 bg-bg-secondary"
    >
      <div class="p-4">
        <h3 class="mb-2 text-xs font-semibold uppercase text-text-muted">Members</h3>
        <p class="text-sm text-text-secondary">Member list will go here.</p>
      </div>
    </aside>
  </div>
</template>
