<script setup lang="ts">
import UserAvatar from '@/components/user/UserAvatar.vue'
import MessageAttachments from '@/components/messages/MessageAttachments.vue'
import RichText from '@/components/ui/RichText.vue'
import type { Attachment } from '@/lib/types'

defineProps<{
  sourceMessage: {
    content: string
    attachments?: Attachment[]
    profile: { display_name: string; avatar_url: string | null } | null
  } | null
  body: string | null
  authorName: string
  authorAvatarUrl: string | null
}>()
</script>

<template>
  <div class="mb-3 rounded-lg border border-bg-tertiary bg-bg-secondary overflow-hidden">
    <!-- Source message -->
    <div v-if="sourceMessage" class="px-4 pt-4 pb-3">
      <p class="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-muted">Original message</p>
      <div class="flex gap-2.5">
        <UserAvatar :src="sourceMessage.profile?.avatar_url" :alt="sourceMessage.profile?.display_name" size="sm" class="flex-shrink-0 mt-0.5" />
        <div class="min-w-0">
          <span class="text-sm font-semibold text-text-primary">{{ sourceMessage.profile?.display_name }}</span>
          <p class="mt-0.5 break-words text-sm text-text-secondary">{{ sourceMessage.content }}</p>
          <MessageAttachments v-if="sourceMessage.attachments?.length" :attachments="sourceMessage.attachments" class="mt-2" />
        </div>
      </div>
    </div>

    <!-- Reply indicator + OP body -->
    <div v-if="body" class="relative px-4 pb-4" :class="sourceMessage ? 'pt-0' : 'pt-4'">
      <!-- Vertical reply line -->
      <div v-if="sourceMessage" class="absolute left-8 top-0 bottom-4 w-0.5 bg-bg-tertiary" />
      <div v-if="sourceMessage" class="absolute left-8 top-0 h-4 w-4 rounded-bl-lg border-b border-l border-bg-tertiary bg-transparent" style="margin-left: 0" />

      <div class="flex gap-2.5" :class="sourceMessage ? 'ml-6 mt-3' : ''">
        <UserAvatar :src="authorAvatarUrl" :alt="authorName" size="sm" class="flex-shrink-0 mt-0.5" />
        <div class="min-w-0 flex-1 rounded-lg bg-bg-primary px-3 py-2.5">
          <span class="text-sm font-semibold text-text-primary">{{ authorName }}</span>
          <p class="mt-0.5 break-words text-sm text-text-secondary leading-relaxed"><RichText :text="body" /></p>
        </div>
      </div>
    </div>
  </div>
</template>
