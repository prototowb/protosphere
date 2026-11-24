<script setup lang="ts">
import { RouterView } from 'vue-router'
import ToastContainer from '@/components/ui/ToastContainer.vue'
import ContextMenu from '@/components/ui/ContextMenu.vue'
import { useLoginRedirect } from '@/composables/useLoginRedirect'

useLoginRedirect()
</script>

<template>
  <RouterView />
  <ToastContainer />
  <ContextMenu />
</template>
