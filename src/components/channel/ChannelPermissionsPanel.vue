<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { backend } from '@/lib/backend'
import { useAuthStore } from '@/stores/auth'
import { useRolesStore } from '@/stores/roles'
import { useToastStore } from '@/stores/toast'
import { Permission, deserializePermissions, serializePermissions, hasPermission } from '@/lib/permissions'
import type { PermissionBits } from '@/lib/permissions'
import type { ChannelRoleOverride, Role } from '@/lib/types'

const props = defineProps<{
  channelId: string
  serverId: string
}>()

const authStore = useAuthStore()
const rolesStore = useRolesStore()
const toastStore = useToastStore()

const overrides = ref<ChannelRoleOverride[]>([])
const loading = ref(true)
const saving = ref(false)
const selectedRoleId = ref<string | null>(null)
const editAllow = ref(0n)
const editDeny = ref(0n)

const roles = computed(() => rolesStore.getServerRoles(props.serverId))
const selectedRole = computed(() => roles.value.find((r) => r.id === selectedRoleId.value))

// Channel-relevant permissions (exclude space-management-only perms)
const CHANNEL_PERMS: { key: keyof typeof Permission; label: string }[] = [
  { key: 'VIEW_CHANNEL', label: 'View Channel' },
  { key: 'SEND_MESSAGES', label: 'Send Messages' },
  { key: 'ATTACH_FILES', label: 'Attach Files' },
  { key: 'EMBED_LINKS', label: 'Embed Links' },
  { key: 'MENTION_EVERYONE', label: 'Mention Everyone' },
  { key: 'MANAGE_MESSAGES', label: 'Manage Messages' },
  { key: 'ADD_REACTIONS', label: 'Add Reactions' },
]

onMounted(async () => {
  try {
    if (roles.value.length === 0) {
      const fetched = await backend.roles.list(props.serverId)
      rolesStore.setServerRoles(props.serverId, fetched)
    }
    overrides.value = await backend.roles.listChannelOverrides(props.channelId)
  } finally {
    loading.value = false
  }
})

function selectRole(role: Role) {
  selectedRoleId.value = role.id
  const existing = overrides.value.find((o) => o.role_id === role.id)
  editAllow.value = existing ? deserializePermissions(existing.allow) : 0n
  editDeny.value = existing ? deserializePermissions(existing.deny) : 0n
}

type OverrideState = 'inherit' | 'allow' | 'deny'

function getState(bit: PermissionBits): OverrideState {
  if ((editAllow.value & bit) !== 0n) return 'allow'
  if ((editDeny.value & bit) !== 0n) return 'deny'
  return 'inherit'
}

function cycle(bit: PermissionBits) {
  const current = getState(bit)
  // Clear both first
  editAllow.value &= ~bit
  editDeny.value &= ~bit
  // Cycle: inherit → allow → deny → inherit
  if (current === 'inherit') editAllow.value |= bit
  else if (current === 'allow') editDeny.value |= bit
  // deny → inherit (already cleared)
}

function getRoleBaseHas(bit: PermissionBits): boolean {
  if (!selectedRole.value) return false
  return hasPermission(deserializePermissions(selectedRole.value.permissions), bit)
}

const hasChanges = computed(() => {
  if (!selectedRoleId.value) return false
  const existing = overrides.value.find((o) => o.role_id === selectedRoleId.value)
  const existingAllow = existing ? deserializePermissions(existing.allow) : 0n
  const existingDeny = existing ? deserializePermissions(existing.deny) : 0n
  return editAllow.value !== existingAllow || editDeny.value !== existingDeny
})

async function saveOverride() {
  if (!selectedRoleId.value) return
  saving.value = true
  try {
    // If both allow and deny are 0, remove the override
    if (editAllow.value === 0n && editDeny.value === 0n) {
      await backend.roles.deleteChannelOverride(props.channelId, selectedRoleId.value)
      overrides.value = overrides.value.filter((o) => o.role_id !== selectedRoleId.value)
      if (authStore.user?.id) {
        backend.audit_log.log(props.serverId, authStore.user.id, 'channel_override.removed', 'channel', props.channelId, {
          role_id: selectedRoleId.value, role_name: selectedRole.value?.name,
        }).catch(() => {})
      }
    } else {
      const result = await backend.roles.setChannelOverride(
        props.channelId,
        selectedRoleId.value,
        serializePermissions(editAllow.value),
        serializePermissions(editDeny.value),
      )
      const idx = overrides.value.findIndex((o) => o.role_id === selectedRoleId.value)
      if (idx >= 0) overrides.value[idx] = result
      else overrides.value.push(result)
      if (authStore.user?.id) {
        backend.audit_log.log(props.serverId, authStore.user.id, 'channel_override.changed', 'channel', props.channelId, {
          role_id: selectedRoleId.value, role_name: selectedRole.value?.name,
          allow: serializePermissions(editAllow.value),
          deny: serializePermissions(editDeny.value),
        }).catch(() => {})
      }
    }
    toastStore.show('Channel permissions saved', 'success')
  } catch {
    toastStore.show('Failed to save permissions', 'error')
  } finally {
    saving.value = false
  }
}

function resetOverride() {
  if (!selectedRoleId.value) return
  const existing = overrides.value.find((o) => o.role_id === selectedRoleId.value)
  editAllow.value = existing ? deserializePermissions(existing.allow) : 0n
  editDeny.value = existing ? deserializePermissions(existing.deny) : 0n
}
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-8">
    <div class="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
  </div>

  <div v-else class="flex gap-4 min-h-[280px]">
    <!-- Role list -->
    <div class="w-40 flex-shrink-0 space-y-1">
      <p class="mb-2 text-xs font-semibold uppercase text-text-muted">Roles</p>
      <button
        v-for="role in roles"
        :key="role.id"
        @click="selectRole(role)"
        class="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-sm text-left transition-colors"
        :class="selectedRoleId === role.id ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
      >
        <span
          class="h-2.5 w-2.5 flex-shrink-0 rounded-full"
          :style="role.color ? `background:${role.color}` : 'background:var(--color-text-muted)'"
        />
        <span class="truncate">{{ role.name }}</span>
        <span
          v-if="overrides.some((o) => o.role_id === role.id)"
          class="ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent"
          title="Has overrides"
        />
      </button>
    </div>

    <!-- Override editor -->
    <div v-if="selectedRole" class="flex-1 min-w-0">
      <p class="mb-3 text-sm text-text-secondary">
        Override permissions for <span class="font-medium text-text-primary">{{ selectedRole.name }}</span> in this channel.
        Click to cycle: <span class="text-text-muted">Inherit</span> &rarr; <span class="text-green-400">Allow</span> &rarr; <span class="text-red-400">Deny</span>
      </p>

      <div class="space-y-1.5">
        <button
          v-for="perm in CHANNEL_PERMS"
          :key="perm.key"
          @click="cycle(Permission[perm.key])"
          class="flex w-full items-center gap-3 rounded px-3 py-2 text-sm text-left transition-colors hover:bg-bg-hover"
        >
          <!-- State indicator -->
          <span
            class="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-xs font-bold"
            :class="{
              'bg-bg-tertiary text-text-muted': getState(Permission[perm.key]) === 'inherit',
              'bg-green-500/20 text-green-400': getState(Permission[perm.key]) === 'allow',
              'bg-red-500/20 text-red-400': getState(Permission[perm.key]) === 'deny',
            }"
          >
            <template v-if="getState(Permission[perm.key]) === 'inherit'">&mdash;</template>
            <template v-else-if="getState(Permission[perm.key]) === 'allow'">&#10003;</template>
            <template v-else>&#10005;</template>
          </span>
          <span class="flex-1">{{ perm.label }}</span>
          <!-- Base role indicator -->
          <span
            class="text-xs"
            :class="getRoleBaseHas(Permission[perm.key]) ? 'text-text-muted' : 'text-text-muted/50'"
          >
            base: {{ getRoleBaseHas(Permission[perm.key]) ? 'yes' : 'no' }}
          </span>
        </button>
      </div>

      <div v-if="hasChanges" class="mt-4 flex gap-2">
        <button
          @click="saveOverride"
          :disabled="saving"
          class="rounded bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
        >
          {{ saving ? 'Saving...' : 'Save' }}
        </button>
        <button @click="resetOverride" class="rounded px-3 py-1.5 text-sm text-text-muted hover:text-text-primary">
          Reset
        </button>
      </div>
    </div>

    <div v-else class="flex flex-1 items-center justify-center text-sm text-text-muted">
      Select a role to configure overrides
    </div>
  </div>
</template>
