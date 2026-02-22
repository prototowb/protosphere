<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useServersStore } from '@/stores/servers'
import { useToastStore } from '@/stores/toast'
import { useServers } from '@/composables/useServers'
import { useRoles } from '@/composables/useRoles'
import { useRolesStore } from '@/stores/roles'
import { backend } from '@/lib/backend'
import { Permission, hasPermission, deserializePermissions, serializePermissions } from '@/lib/permissions'
import type { PermissionBits } from '@/lib/permissions'
import type { Ban, Profile, Role } from '@/lib/types'

const route = useRoute()
const router = useRouter()
const serversStore = useServersStore()
const rolesStore = useRolesStore()
const toastStore = useToastStore()
const { fetchServers, updateServer, deleteServer, unbanMember } = useServers()
const { fetchServerRoles, createRole, updateRole, deleteRole } = useRoles()

const serverId = ref(route.params.serverId as string)
const activeTab = ref<'overview' | 'roles' | 'bans'>('overview')

// ── Overview tab ──────────────────────────────────────────────────────────────
const name = ref('')
const description = ref('')
const iconUrl = ref<string | null>(null)
const saving = ref(false)
const error = ref('')
const iconInputEl = ref<HTMLInputElement | null>(null)
const showDeleteConfirm = ref(false)
const deleteConfirmName = ref('')

// ── Bans tab ──────────────────────────────────────────────────────────────────
const bans = ref<(Ban & { profile: Profile })[]>([])

async function fetchBans() {
  bans.value = await backend.bans.list(serverId.value)
}

async function handleUnban(userId: string) {
  await unbanMember(serverId.value, userId)
  await fetchBans()
}

// ── Roles tab ─────────────────────────────────────────────────────────────────
const roles = computed(() => rolesStore.getServerRoles(serverId.value))

const editingRole = ref<Role | null>(null)
const editRoleName = ref('')
const editRoleColor = ref('')
const editRolePermissions = ref(0n)
const editRoleDefault = ref(false)
const savingRole = ref(false)
const showCreateRole = ref(false)
const newRoleName = ref('')
const creatingRole = ref(false)

const PERMISSION_GROUPS: { label: string; perms: { key: keyof typeof Permission; label: string }[] }[] = [
  {
    label: 'Space Management',
    perms: [
      { key: 'MANAGE_SPACE', label: 'Manage Space' },
      { key: 'MANAGE_ROLES', label: 'Manage Roles' },
      { key: 'MANAGE_INVITES', label: 'Manage Invites' },
      { key: 'VIEW_AUDIT_LOG', label: 'View Audit Log' },
    ],
  },
  {
    label: 'Channels',
    perms: [
      { key: 'VIEW_CHANNEL', label: 'View Channels' },
      { key: 'MANAGE_CHANNELS', label: 'Manage Channels' },
      { key: 'MANAGE_CATEGORIES', label: 'Manage Categories' },
    ],
  },
  {
    label: 'Messages',
    perms: [
      { key: 'SEND_MESSAGES', label: 'Send Messages' },
      { key: 'ATTACH_FILES', label: 'Attach Files' },
      { key: 'EMBED_LINKS', label: 'Embed Links' },
      { key: 'MENTION_EVERYONE', label: 'Mention Everyone' },
      { key: 'MANAGE_MESSAGES', label: 'Manage Messages' },
      { key: 'ADD_REACTIONS', label: 'Add Reactions' },
    ],
  },
  {
    label: 'Moderation',
    perms: [
      { key: 'KICK_MEMBERS', label: 'Kick Members' },
      { key: 'BAN_MEMBERS', label: 'Ban Members' },
      { key: 'MUTE_MEMBERS', label: 'Mute Members' },
      { key: 'MANAGE_BANS', label: 'Manage Bans' },
    ],
  },
  {
    label: 'Profile',
    perms: [
      { key: 'CHANGE_NICKNAME', label: 'Change Nickname' },
      { key: 'MANAGE_NICKNAMES', label: 'Manage Nicknames' },
    ],
  },
  {
    label: 'Advanced',
    perms: [
      { key: 'ADMINISTRATOR', label: 'Administrator (bypasses all checks)' },
    ],
  },
]

function openEditRole(role: Role) {
  editingRole.value = role
  editRoleName.value = role.name
  editRoleColor.value = role.color ?? ''
  editRolePermissions.value = deserializePermissions(role.permissions)
  editRoleDefault.value = role.is_default
}

function closeEditRole() {
  editingRole.value = null
}

function togglePermission(bit: PermissionBits) {
  if ((editRolePermissions.value & bit) !== 0n) {
    editRolePermissions.value &= ~bit
  } else {
    editRolePermissions.value |= bit
  }
}

function roleHasPermission(bit: PermissionBits) {
  return hasPermission(editRolePermissions.value, bit)
}

async function handleSaveRole() {
  if (!editingRole.value) return
  savingRole.value = true
  try {
    await updateRole(editingRole.value.id, serverId.value, {
      name: editRoleName.value.trim(),
      color: editRoleColor.value || null,
      permissions: serializePermissions(editRolePermissions.value),
      is_default: editRoleDefault.value,
    })
    await fetchServerRoles(serverId.value)
    closeEditRole()
    toastStore.show('Role saved', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to save role', 'error')
  } finally {
    savingRole.value = false
  }
}

async function handleDeleteRole(role: Role) {
  if (!confirm(`Delete role "${role.name}"? This will remove it from all members.`)) return
  try {
    await deleteRole(role.id, serverId.value)
    if (editingRole.value?.id === role.id) closeEditRole()
    toastStore.show('Role deleted', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to delete role', 'error')
  }
}

async function handleCreateRole() {
  const trimmed = newRoleName.value.trim()
  if (!trimmed) return
  creatingRole.value = true
  try {
    await createRole({ server_id: serverId.value, name: trimmed })
    newRoleName.value = ''
    showCreateRole.value = false
    toastStore.show('Role created', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to create role', 'error')
  } finally {
    creatingRole.value = false
  }
}

// ── General setup ─────────────────────────────────────────────────────────────
onMounted(async () => {
  if (serversStore.servers.length === 0) await fetchServers()
  loadServer()
  fetchBans()
  fetchServerRoles(serverId.value)
})

watch(() => route.params.serverId, () => {
  serverId.value = route.params.serverId as string
  loadServer()
  fetchBans()
  fetchServerRoles(serverId.value)
})

function loadServer() {
  const server = serversStore.servers.find((s) => s.id === serverId.value)
  if (server) {
    name.value = server.name
    description.value = server.description
    iconUrl.value = server.icon_url
  }
}

function handleIconSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) { error.value = 'Please select an image file'; return }
  if (file.size > 512 * 1024) { error.value = 'Image must be under 512 KB'; return }
  const reader = new FileReader()
  reader.onload = () => { iconUrl.value = reader.result as string }
  reader.readAsDataURL(file)
}

function removeIcon() {
  iconUrl.value = null
  if (iconInputEl.value) iconInputEl.value.value = ''
}

async function handleSave() {
  saving.value = true
  error.value = ''
  try {
    await updateServer(serverId.value, { name: name.value, description: description.value, icon_url: iconUrl.value })
    toastStore.show('Settings saved', 'success')
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

async function handleDelete() {
  if (deleteConfirmName.value !== name.value) return
  await deleteServer(serverId.value)
  toastStore.show('Server deleted', 'success')
  router.push('/channels/@me')
}

function getServerInitial(n: string) {
  return n.split(/\s+/).map((w) => w[0]).join('').substring(0, 2).toUpperCase()
}
</script>

<template>
  <div class="flex min-h-screen items-center justify-center px-4 py-8">
    <div class="w-full max-w-2xl rounded-lg bg-bg-secondary p-8">
      <!-- Header -->
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Server Settings</h1>
        <button
          @click="router.push(`/channels/${serverId}/${serverId}`)"
          class="text-sm text-text-secondary hover:text-text-primary"
        >
          Back to server
        </button>
      </div>

      <!-- Tabs -->
      <div class="mb-6 flex gap-1 border-b border-bg-tertiary">
        <button
          v-for="tab in (['overview', 'roles', 'bans'] as const)"
          :key="tab"
          @click="activeTab = tab; closeEditRole()"
          class="px-4 py-2 text-sm capitalize transition-colors"
          :class="activeTab === tab ? 'border-b-2 border-accent text-accent' : 'text-text-muted hover:text-text-primary'"
        >
          {{ tab }}
        </button>
      </div>

      <!-- ── Overview tab ─────────────────────────────────────────────────── -->
      <div v-if="activeTab === 'overview'">
        <div v-if="error" class="mb-4 rounded bg-red-500/10 px-4 py-3 text-sm text-red-400">{{ error }}</div>

        <form @submit.prevent="handleSave" class="space-y-4">
          <div>
            <label class="mb-2 block text-sm text-text-secondary">Server Icon</label>
            <div class="flex items-center gap-4">
              <div class="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-bg-tertiary">
                <img v-if="iconUrl" :src="iconUrl" :alt="name" class="h-full w-full object-cover" />
                <span v-else class="text-xl font-bold text-text-muted">{{ getServerInitial(name || 'S') }}</span>
              </div>
              <div class="flex flex-col gap-2">
                <input ref="iconInputEl" type="file" accept="image/*" class="hidden" @change="handleIconSelect" />
                <button type="button" @click="iconInputEl?.click()" class="rounded bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-hover">Upload Image</button>
                <button v-if="iconUrl" type="button" @click="removeIcon" class="rounded px-3 py-1.5 text-sm text-text-muted hover:text-danger">Remove</button>
                <p class="text-xs text-text-muted">Max 512 KB. JPG, PNG, or GIF.</p>
              </div>
            </div>
          </div>
          <div>
            <label for="server-name" class="mb-1 block text-sm text-text-secondary">Server Name</label>
            <input id="server-name" v-model="name" type="text" required maxlength="100" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
          </div>
          <div>
            <label for="server-desc" class="mb-1 block text-sm text-text-secondary">Description</label>
            <textarea id="server-desc" v-model="description" maxlength="1000" rows="3" class="w-full resize-none rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
          </div>
          <div class="flex items-center justify-between pt-2">
            <button type="submit" :disabled="saving" class="rounded bg-accent px-6 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50">
              {{ saving ? 'Saving...' : 'Save changes' }}
            </button>
            <button type="button" @click="showDeleteConfirm = true" class="rounded border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10">
              Delete Server
            </button>
          </div>
        </form>

        <div v-if="showDeleteConfirm" class="mt-6 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
          <h3 class="mb-2 font-semibold text-red-400">Delete Server</h3>
          <p class="mb-3 text-sm text-text-secondary">This action is irreversible. Type <span class="font-semibold text-text-primary">{{ name }}</span> to confirm.</p>
          <input v-model="deleteConfirmName" type="text" :placeholder="name" class="mb-3 w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-red-500" />
          <div class="flex gap-2">
            <button @click="handleDelete" :disabled="deleteConfirmName !== name" class="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-30 disabled:cursor-not-allowed">Delete Server</button>
            <button @click="showDeleteConfirm = false; deleteConfirmName = ''" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">Cancel</button>
          </div>
        </div>
      </div>

      <!-- ── Roles tab ────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'roles'" class="flex gap-4">
        <!-- Role list -->
        <div class="w-48 flex-shrink-0">
          <div class="space-y-1">
            <button
              v-for="role in roles"
              :key="role.id"
              @click="openEditRole(role)"
              class="flex w-full items-center gap-2 rounded px-3 py-2 text-sm text-left transition-colors"
              :class="editingRole?.id === role.id ? 'bg-accent/20 text-accent' : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'"
            >
              <span
                class="h-3 w-3 flex-shrink-0 rounded-full"
                :style="role.color ? `background:${role.color}` : 'background:var(--color-text-muted)'"
              />
              <span class="truncate">{{ role.name }}</span>
            </button>
          </div>

          <button
            @click="showCreateRole = !showCreateRole; editingRole = null"
            class="mt-3 flex w-full items-center gap-1 rounded px-3 py-2 text-sm text-text-muted hover:bg-bg-hover hover:text-text-primary"
          >
            <span class="text-base leading-none">+</span> Create Role
          </button>

          <div v-if="showCreateRole" class="mt-2 flex gap-1">
            <input
              v-model="newRoleName"
              type="text"
              placeholder="Role name"
              maxlength="50"
              class="min-w-0 flex-1 rounded border border-bg-tertiary bg-bg-primary px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
              @keydown.enter="handleCreateRole"
              @keydown.escape="showCreateRole = false; newRoleName = ''"
            />
            <button
              @click="handleCreateRole"
              :disabled="creatingRole || !newRoleName.trim()"
              class="rounded bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        <!-- Role editor -->
        <div v-if="editingRole" class="flex-1 min-w-0">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="font-semibold">{{ editingRole.name }}</h2>
            <button
              v-if="!editingRole.is_system"
              @click="handleDeleteRole(editingRole)"
              class="text-xs text-red-400 hover:text-red-300"
            >
              Delete role
            </button>
          </div>

          <!-- Name & color -->
          <div class="mb-4 flex gap-3">
            <div class="flex-1">
              <label class="mb-1 block text-xs font-medium text-text-muted uppercase">Role Name</label>
              <input
                v-model="editRoleName"
                type="text"
                maxlength="50"
                :disabled="editingRole.is_system"
                class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent disabled:opacity-50"
              />
            </div>
            <div class="w-24">
              <label class="mb-1 block text-xs font-medium text-text-muted uppercase">Color</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="editRoleColor"
                  type="color"
                  class="h-8 w-8 cursor-pointer rounded border-0 bg-transparent p-0"
                />
                <input
                  v-model="editRoleColor"
                  type="text"
                  maxlength="7"
                  placeholder="#ffffff"
                  class="min-w-0 flex-1 rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-xs text-text-primary outline-none focus:border-accent"
                />
              </div>
            </div>
          </div>

          <!-- Default role toggle -->
          <label class="mb-4 flex cursor-pointer items-center gap-2">
            <input v-model="editRoleDefault" type="checkbox" class="accent-accent" />
            <span class="text-sm text-text-secondary">Auto-assign to new members</span>
          </label>

          <!-- Permission checkboxes -->
          <div class="space-y-4">
            <div v-for="group in PERMISSION_GROUPS" :key="group.label">
              <p class="mb-2 text-xs font-semibold uppercase text-text-muted">{{ group.label }}</p>
              <div class="space-y-1.5">
                <label
                  v-for="perm in group.perms"
                  :key="perm.key"
                  class="flex cursor-pointer items-center gap-2"
                >
                  <input
                    type="checkbox"
                    :checked="roleHasPermission(Permission[perm.key])"
                    @change="togglePermission(Permission[perm.key])"
                    class="accent-accent"
                  />
                  <span class="text-sm text-text-secondary">{{ perm.label }}</span>
                </label>
              </div>
            </div>
          </div>

          <div class="mt-6 flex gap-2">
            <button
              @click="handleSaveRole"
              :disabled="savingRole"
              class="rounded bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover disabled:opacity-50"
            >
              {{ savingRole ? 'Saving...' : 'Save Role' }}
            </button>
            <button @click="closeEditRole" class="rounded px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
              Cancel
            </button>
          </div>
        </div>

        <div v-else class="flex flex-1 items-center justify-center text-sm text-text-muted">
          Select a role to edit permissions
        </div>
      </div>

      <!-- ── Bans tab ──────────────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'bans'">
        <p v-if="bans.length === 0" class="text-sm text-text-muted">No banned members.</p>
        <div v-else class="space-y-2">
          <div
            v-for="ban in bans"
            :key="ban.user_id"
            class="flex items-center gap-3 rounded-lg bg-bg-primary px-4 py-3"
          >
            <div class="min-w-0 flex-1">
              <p class="font-medium">{{ ban.profile.display_name }}</p>
              <p class="text-xs text-text-muted">@{{ ban.profile.username }}</p>
              <p v-if="ban.reason" class="mt-0.5 text-xs text-text-secondary">Reason: {{ ban.reason }}</p>
            </div>
            <button
              @click="handleUnban(ban.user_id)"
              class="flex-shrink-0 rounded px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-bg-hover hover:text-text-primary"
            >
              Unban
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
