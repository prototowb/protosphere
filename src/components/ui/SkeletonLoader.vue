<script setup lang="ts">
defineProps<{
  width?: string
  height?: string
  rounded?: boolean
  circle?: boolean
  lines?: number
}>()
</script>

<template>
  <div v-if="lines && lines > 1" class="space-y-2">
    <div
      v-for="i in lines"
      :key="i"
      class="animate-pulse rounded bg-bg-tertiary"
      :style="{ height: height ?? '16px', width: i === lines && lines > 1 ? '70%' : (width ?? '100%') }"
    />
  </div>
  <div
    v-else
    class="animate-pulse bg-bg-tertiary"
    :class="[circle ? 'rounded-full' : rounded ? 'rounded-lg' : 'rounded']"
    :style="{ width: width ?? '100%', height: height ?? '16px' }"
  />
</template>
