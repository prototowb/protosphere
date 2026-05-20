<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useIntegrations } from '@/composables/useIntegrations'
import { useAuthStore } from '@/stores/auth'
import { useToastStore } from '@/stores/toast'
import { supabase } from '@/lib/supabase'
import IntegrationCard from '@/components/integrations/IntegrationCard.vue'
import type { Integration, IntegrationFieldSchema, IntegrationFieldType, FieldVisibility } from '@/lib/types'

const authStore = useAuthStore()
const toastStore = useToastStore()
const {
  integrations,
  loading,
  fetchIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  listFieldSchemas,
  createFieldSchema,
  deleteFieldSchema,
} = useIntegrations()

// ── Views ─────────────────────────────────────────────────────
const view = ref<'list' | 'create' | 'detail'>('list')
const selectedIntegration = ref<Integration | null>(null)
const fieldSchemas = ref<IntegrationFieldSchema[]>([])

// ── Create form ───────────────────────────────────────────────
const form = ref({
  name: '',
  slug: '',
  description: '',
  api_base_url: '',
  api_key: '',
  app_url: '',
  signing_key: '',
  data_endpoint: '',
  auth_mode: 'same_domain_cookie' as Integration['auth_mode'],
  default_ttl_seconds: 300,
})
const saving = ref(false)

// ── Field form ────────────────────────────────────────────────
const showFieldForm = ref(false)
const fieldForm = ref({
  field_key: '',
  label: '',
  field_type: 'text' as IntegrationFieldType,
  default_visibility: 'public' as FieldVisibility,
})

onMounted(fetchIntegrations)

function autoSlug() {
  form.value.slug = form.value.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

async function handleCreate() {
  if (!authStore.user) return
  saving.value = true
  try {
    await createIntegration({ ...form.value, created_by: authStore.user.id })
    toastStore.show('Integration created', 'success')
    form.value = { name: '', slug: '', description: '', api_base_url: '', api_key: '', app_url: '', signing_key: '', data_endpoint: '', auth_mode: 'same_domain_cookie', default_ttl_seconds: 300 }
    view.value = 'list'
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to create', 'error')
  } finally {
    saving.value = false
  }
}

async function openDetail(integration: Integration) {
  selectedIntegration.value = integration
  initEditForm(integration)
  fieldSchemas.value = await listFieldSchemas(integration.id)
  view.value = 'detail'
}

async function toggleEnabled(integration: Integration) {
  try {
    await updateIntegration(integration.id, { enabled: !integration.enabled })
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to toggle', 'error')
  }
}

async function handleDelete(id: string) {
  await deleteIntegration(id)
  toastStore.show('Integration deleted', 'success')
  view.value = 'list'
}

async function handleAddField() {
  if (!selectedIntegration.value) return
  const schema = await createFieldSchema({
    integration_id: selectedIntegration.value.id,
    ...fieldForm.value,
    sort_order: fieldSchemas.value.length,
  })
  fieldSchemas.value = [...fieldSchemas.value, schema]
  fieldForm.value = { field_key: '', label: '', field_type: 'text', default_visibility: 'public' }
  showFieldForm.value = false
}

async function handleDeleteField(id: string) {
  await deleteFieldSchema(id)
  fieldSchemas.value = fieldSchemas.value.filter((s) => s.id !== id)
}

// ── Detail editing ───────────────────────────────────────────
const editForm = ref({
  name: '',
  description: '',
  api_base_url: '',
  api_key: '',
  app_url: '',
  signing_key: '',
  data_endpoint: '',
  auth_mode: 'same_domain_cookie' as Integration['auth_mode'],
  default_ttl_seconds: 300,
})
const editSaving = ref(false)
const testing = ref(false)

function initEditForm(integration: Integration) {
  editForm.value = {
    name: integration.name,
    description: integration.description,
    api_base_url: integration.api_base_url,
    api_key: integration.api_key,
    app_url: integration.app_url ?? '',
    signing_key: integration.signing_key ?? '',
    data_endpoint: integration.data_endpoint,
    auth_mode: integration.auth_mode,
    default_ttl_seconds: integration.default_ttl_seconds,
  }
}

async function handleSaveDetail() {
  if (!selectedIntegration.value) return
  editSaving.value = true
  try {
    await updateIntegration(selectedIntegration.value.id, editForm.value)
    selectedIntegration.value = { ...selectedIntegration.value, ...editForm.value }
    toastStore.show('Integration updated', 'success')
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to update', 'error')
  } finally {
    editSaving.value = false
  }
}

async function handleTestConnection() {
  testing.value = true
  const url = editForm.value.api_base_url.trim().replace(/\/$/, '') + editForm.value.data_endpoint.trim()
  try {
    const headers: Record<string, string> = {}
    if (editForm.value.api_key) headers['apikey'] = editForm.value.api_key
    const resp = await fetch(url, { method: 'GET', headers })
    if (resp.ok) {
      toastStore.show(`Connection successful (${resp.status})`, 'success')
    } else {
      toastStore.show(`Connection returned ${resp.status} ${resp.statusText}`, 'error')
    }
  } catch {
    toastStore.show('Connection failed — check URL and CORS', 'error')
  } finally {
    testing.value = false
  }
}

const authModes: { value: Integration['auth_mode']; label: string; desc: string }[] = [
  { value: 'same_domain_cookie', label: 'SSO (Cookie)', desc: 'Automatic login via shared parent domain cookie' },
  { value: 'auth_bridge', label: 'Auth Bridge', desc: 'External app sends users via signed JWT redirect' },
  { value: 'token_exchange', label: 'Token Exchange', desc: 'User pastes a connection token manually' },
]

const fieldTypes: IntegrationFieldType[] = ['number', 'text', 'badge', 'list', 'activity_feed', 'progress_bar']

function generateSigningKey(target: 'create' | 'edit') {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const key = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  if (target === 'create') {
    form.value.signing_key = key
  } else {
    editForm.value.signing_key = key
  }
}

// ── Remote schema discovery ──────────────────────────────────
interface RemoteField {
  key: string
  label: string
  type: IntegrationFieldType
}
const remoteFields = ref<RemoteField[]>([])
const fetchingSchema = ref(false)
const selectedRemoteFields = ref<Set<string>>(new Set())

const availableRemoteFields = computed(() => {
  const existingKeys = new Set(fieldSchemas.value.map((s) => s.field_key))
  return remoteFields.value.filter((f) => !existingKeys.has(f.key))
})

async function fetchRemoteSchema() {
  if (!selectedIntegration.value) return
  fetchingSchema.value = true
  remoteFields.value = []
  selectedRemoteFields.value = new Set()

  const integration = selectedIntegration.value
  const url = integration.api_base_url.trim().replace(/\/$/, '') + integration.data_endpoint.trim()

  try {
    // Build common headers — Supabase Edge Functions require the apikey header
    const baseHeaders: Record<string, string> = {}
    if (integration.api_key) {
      baseHeaders['apikey'] = integration.api_key
    }

    // Try schema-only mode first (no auth needed, supported by compliant endpoints)
    let resp = await fetch(url + '?schema=true', { headers: baseHeaders })

    if (!resp.ok) {
      // Fall back to authenticated data endpoint
      const headers: Record<string, string> = { ...baseHeaders }
      if (supabase) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`
        }
      }
      resp = await fetch(url, { headers })
    }

    if (!resp.ok) throw new Error(`API returned ${resp.status}`)
    const payload = await resp.json()

    const fields = payload.fields ?? payload
    if (typeof fields !== 'object' || fields === null) throw new Error('No fields object in response')

    const parsed: RemoteField[] = []
    const unknownTypes: string[] = []
    for (const [key, val] of Object.entries(fields)) {
      const f = val as Record<string, unknown>
      const rawType = typeof f.type === 'string' ? f.type : null
      const isKnown = rawType && fieldTypes.includes(rawType as IntegrationFieldType)
      if (rawType && !isKnown) unknownTypes.push(`'${rawType}'`)
      parsed.push({
        key,
        label: typeof f.label === 'string' ? f.label : key,
        type: isKnown ? rawType as IntegrationFieldType : 'text',
      })
    }
    remoteFields.value = parsed
    if (unknownTypes.length > 0) {
      toastStore.show(`Unknown field type${unknownTypes.length > 1 ? 's' : ''} ${unknownTypes.join(', ')} — defaulted to text`, 'info')
    }
    if (parsed.length === 0) {
      toastStore.show('No fields found in API response', 'info')
    }
  } catch (e: unknown) {
    toastStore.show(e instanceof Error ? e.message : 'Failed to fetch schema', 'error')
  } finally {
    fetchingSchema.value = false
  }
}

function toggleRemoteField(key: string) {
  const s = new Set(selectedRemoteFields.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  selectedRemoteFields.value = s
}

async function importSelectedFields() {
  if (!selectedIntegration.value) return
  const toImport = remoteFields.value.filter((f) => selectedRemoteFields.value.has(f.key))
  for (const f of toImport) {
    const schema = await createFieldSchema({
      integration_id: selectedIntegration.value.id,
      field_key: f.key,
      label: f.label,
      field_type: f.type,
      default_visibility: 'public',
      sort_order: fieldSchemas.value.length,
    })
    fieldSchemas.value = [...fieldSchemas.value, schema]
  }
  toastStore.show(`Imported ${toImport.length} field(s)`, 'success')
  selectedRemoteFields.value = new Set()
  remoteFields.value = []
}
</script>

<template>
  <div class="flex flex-1 flex-col overflow-y-auto p-6">
    <!-- ── List view ─────────────────────────────────────────── -->
    <template v-if="view === 'list'">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-text-primary">Integrations</h1>
        <button
          @click="view = 'create'"
          class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >Add Integration</button>
      </div>

      <div v-if="loading" class="grid gap-3 sm:grid-cols-2">
        <div v-for="i in 4" :key="i" class="h-24 animate-pulse rounded-lg bg-bg-secondary" />
      </div>

      <div v-else-if="integrations.length === 0" class="rounded-lg bg-bg-secondary p-8 text-center text-sm text-text-muted">
        No integrations registered yet. Add one to connect external apps.
      </div>

      <div v-else class="grid gap-3 sm:grid-cols-2">
        <IntegrationCard
          v-for="integration in integrations"
          :key="integration.id"
          :integration="integration"
          @click="openDetail(integration)"
        />
      </div>
    </template>

    <!-- ── Create view ───────────────────────────────────────── -->
    <template v-if="view === 'create'">
      <div class="mb-6 flex items-center gap-3">
        <button @click="view = 'list'" class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 class="text-2xl font-bold text-text-primary">Add Integration</h1>
      </div>

      <form class="mx-auto max-w-2xl space-y-5" @submit.prevent="handleCreate">
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Name</label>
          <input v-model="form.name" @input="autoSlug" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" placeholder="TypeScript Learning Platform" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Slug</label>
          <input v-model="form.slug" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="ts-learning" />
          <p class="mt-1 text-xs text-text-muted">URL-safe identifier. Auto-generated from name.</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Description</label>
          <textarea v-model="form.description" rows="2" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent resize-none" placeholder="Track your coding progress..." />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">API Base URL</label>
          <input v-model="form.api_base_url" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="https://typescript.protocode.xyz" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Data Endpoint</label>
          <input v-model="form.data_endpoint" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="/functions/v1/protosphere-user-data" />
          <p class="mt-1 text-xs text-text-muted">Path appended to base URL when fetching user data.</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">API Key <span class="text-text-muted font-normal">(optional)</span></label>
          <input v-model="form.api_key" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="sb_publishable_..." />
          <p class="mt-1 text-xs text-text-muted">Publishable key for the external API (required for Supabase Edge Functions).</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">App URL <span class="text-text-muted font-normal">(optional, dev only)</span></label>
          <input v-model="form.app_url" class="w-full rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="http://localhost:5175" />
          <p class="mt-1 text-xs text-text-muted">Frontend URL of the external app. Enables one-click "Open" in dev mode.</p>
        </div>
        <div v-if="form.auth_mode === 'auth_bridge'">
          <label class="mb-1 block text-sm font-medium text-text-secondary">Signing Key</label>
          <div class="flex gap-2">
            <input v-model="form.signing_key" class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent font-mono text-sm" placeholder="Generate or paste a key..." readonly />
            <button type="button" @click="generateSigningKey('create')" class="shrink-0 rounded bg-bg-tertiary px-3 py-2 text-sm text-text-primary hover:bg-bg-hover transition-colors">Generate</button>
          </div>
          <p class="mt-1 text-xs text-text-muted">HMAC-SHA256 secret shared with the external app for signing auth bridge JWTs.</p>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Auth Mode</label>
          <div class="grid gap-2 sm:grid-cols-3">
            <label
              v-for="mode in authModes"
              :key="mode.value"
              class="cursor-pointer rounded border p-3 transition-colors"
              :class="form.auth_mode === mode.value ? 'border-accent bg-accent/10' : 'border-bg-tertiary hover:border-bg-hover'"
            >
              <input v-model="form.auth_mode" type="radio" :value="mode.value" class="sr-only" />
              <p class="text-sm font-medium text-text-primary">{{ mode.label }}</p>
              <p class="mt-0.5 text-xs text-text-muted">{{ mode.desc }}</p>
            </label>
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium text-text-secondary">Cache TTL (seconds)</label>
          <input v-model.number="form.default_ttl_seconds" type="number" min="0" class="w-32 rounded border border-bg-tertiary bg-bg-primary px-3 py-2 text-text-primary outline-none focus:border-accent" />
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" @click="view = 'list'" class="rounded-md px-4 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors">Cancel</button>
          <button type="submit" :disabled="saving" class="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50">
            {{ saving ? 'Creating...' : 'Create Integration' }}
          </button>
        </div>
      </form>
    </template>

    <!-- ── Detail view ───────────────────────────────────────── -->
    <template v-if="view === 'detail' && selectedIntegration">
      <div class="mb-6 flex items-center gap-3">
        <button @click="view = 'list'" class="rounded p-1 text-text-muted hover:bg-bg-hover hover:text-text-primary">
          <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <h1 class="text-2xl font-bold text-text-primary">{{ selectedIntegration.name }}</h1>
        <span class="rounded-full px-2 py-0.5 text-xs font-medium" :class="selectedIntegration.enabled ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'">
          {{ selectedIntegration.enabled ? 'Enabled' : 'Disabled' }}
        </span>
      </div>

      <div class="mx-auto max-w-2xl space-y-6">
        <!-- Editable config -->
        <section>
          <h2 class="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">Configuration</h2>
          <form class="space-y-3 rounded-lg bg-bg-secondary p-4" @submit.prevent="handleSaveDetail">
            <div class="flex justify-between text-sm"><span class="text-text-muted pt-1.5">Slug</span><span class="font-mono text-text-secondary pt-1.5">{{ selectedIntegration.slug }}</span></div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">Name</label>
              <input v-model="editForm.name" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">Description</label>
              <textarea v-model="editForm.description" rows="2" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent resize-none" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">API Base URL</label>
              <input v-model="editForm.api_base_url" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">Data Endpoint</label>
              <input v-model="editForm.data_endpoint" required class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" />
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">API Key</label>
              <input v-model="editForm.api_key" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" placeholder="sb_publishable_..." />
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">App URL (dev)</label>
              <input v-model="editForm.app_url" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" placeholder="http://localhost:5175" />
            </div>
            <div v-if="editForm.auth_mode === 'auth_bridge'">
              <label class="mb-1 block text-xs text-text-muted">Signing Key</label>
              <div class="flex gap-2">
                <input v-model="editForm.signing_key" class="flex-1 rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" readonly />
                <button type="button" @click="generateSigningKey('edit')" class="shrink-0 rounded bg-bg-tertiary px-2 py-1.5 text-xs text-text-primary hover:bg-bg-hover transition-colors">Generate</button>
              </div>
              <p class="mt-1 text-xs text-text-muted">Share this key securely with the external app developer.</p>
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">Auth Mode</label>
              <select v-model="editForm.auth_mode" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent">
                <option v-for="mode in authModes" :key="mode.value" :value="mode.value">{{ mode.label }}</option>
              </select>
            </div>
            <div>
              <label class="mb-1 block text-xs text-text-muted">Cache TTL (seconds)</label>
              <input v-model.number="editForm.default_ttl_seconds" type="number" min="0" class="w-32 rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
            </div>
            <div class="flex items-center gap-2 pt-1">
              <button type="submit" :disabled="editSaving" class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors disabled:opacity-50">
                {{ editSaving ? 'Saving...' : 'Save Changes' }}
              </button>
              <button type="button" @click="handleTestConnection" :disabled="testing" class="rounded-md border border-bg-tertiary px-3 py-1.5 text-xs text-text-secondary hover:bg-bg-hover transition-colors disabled:opacity-50">
                {{ testing ? 'Testing...' : 'Test Connection' }}
              </button>
            </div>
          </form>
        </section>

        <!-- Field schemas -->
        <section>
          <div class="mb-3 flex items-center justify-between">
            <h2 class="text-xs font-semibold uppercase tracking-wide text-text-muted">Data Fields</h2>
            <div class="flex items-center gap-2">
              <button
                @click="fetchRemoteSchema"
                :disabled="fetchingSchema"
                class="rounded-md border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent/10 transition-colors disabled:opacity-50"
              >{{ fetchingSchema ? 'Fetching...' : 'Fetch from API' }}</button>
              <button
                @click="showFieldForm = !showFieldForm; remoteFields = []"
                class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
              >{{ showFieldForm ? 'Cancel' : 'Add Manually' }}</button>
            </div>
          </div>

          <!-- Remote field picker -->
          <div v-if="remoteFields.length > 0" class="mb-4 rounded-lg border border-accent/30 bg-bg-secondary p-4">
            <p class="mb-3 text-xs text-text-muted">Select fields to import from the API response:</p>
            <div class="space-y-1.5">
              <label
                v-for="rf in availableRemoteFields"
                :key="rf.key"
                class="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors"
                :class="selectedRemoteFields.has(rf.key) ? 'bg-accent/10' : 'hover:bg-bg-hover'"
              >
                <input
                  type="checkbox"
                  :checked="selectedRemoteFields.has(rf.key)"
                  @change="toggleRemoteField(rf.key)"
                  class="accent-accent"
                />
                <span class="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-mono text-text-muted">{{ rf.key }}</span>
                <span class="text-sm text-text-primary">{{ rf.label }}</span>
                <span class="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">{{ rf.type }}</span>
              </label>
            </div>
            <div v-if="remoteFields.length > 0 && availableRemoteFields.length === 0" class="py-2 text-center text-xs text-text-muted">
              All discovered fields are already registered.
            </div>
            <div class="mt-3 flex items-center justify-between">
              <button
                @click="remoteFields = []"
                class="text-xs text-text-muted hover:text-text-primary"
              >Dismiss</button>
              <button
                v-if="selectedRemoteFields.size > 0"
                @click="importSelectedFields"
                class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
              >Import {{ selectedRemoteFields.size }} field(s)</button>
            </div>
          </div>

          <!-- Manual add field form -->
          <form v-if="showFieldForm" class="mb-4 space-y-3 rounded-lg border border-accent/30 bg-bg-secondary p-4" @submit.prevent="handleAddField">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs text-text-muted">Field Key</label>
                <input v-model="fieldForm.field_key" required placeholder="xp" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent font-mono" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-text-muted">Label</label>
                <input v-model="fieldForm.label" required placeholder="Experience Points" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent" />
              </div>
              <div>
                <label class="mb-1 block text-xs text-text-muted">Type</label>
                <select v-model="fieldForm.field_type" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent">
                  <option v-for="t in fieldTypes" :key="t" :value="t">{{ t }}</option>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs text-text-muted">Default Visibility</label>
                <select v-model="fieldForm.default_visibility" class="w-full rounded border border-bg-tertiary bg-bg-primary px-2 py-1.5 text-sm text-text-primary outline-none focus:border-accent">
                  <option value="public">Public</option>
                  <option value="private">Only me</option>
                  <option value="hidden">Hidden</option>
                </select>
              </div>
            </div>
            <div class="flex justify-end">
              <button type="submit" class="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent-hover transition-colors">Add Field</button>
            </div>
          </form>

          <!-- Field list -->
          <div v-if="fieldSchemas.length === 0" class="rounded-lg bg-bg-secondary p-4 text-center text-sm text-text-muted">
            No fields defined yet. Add fields to specify what data this integration exposes.
          </div>
          <div v-else class="space-y-1">
            <div
              v-for="schema in fieldSchemas"
              :key="schema.id"
              class="flex items-center justify-between rounded-lg bg-bg-secondary px-4 py-2.5"
            >
              <div class="flex items-center gap-3 min-w-0">
                <span class="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] font-mono text-text-muted">{{ schema.field_key }}</span>
                <span class="text-sm text-text-primary truncate">{{ schema.label }}</span>
                <span class="rounded bg-bg-tertiary px-1.5 py-0.5 text-[10px] text-text-muted">{{ schema.field_type }}</span>
              </div>
              <button
                @click="handleDeleteField(schema.id)"
                class="flex-shrink-0 rounded p-1 text-text-muted hover:bg-bg-hover hover:text-red-400 transition-colors"
              >
                <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </div>
        </section>

        <!-- Actions -->
        <section class="flex gap-2 border-t border-bg-tertiary pt-4">
          <button
            @click="toggleEnabled(selectedIntegration)"
            class="rounded-md border border-bg-tertiary px-3 py-2 text-sm text-text-secondary hover:bg-bg-hover transition-colors"
          >{{ selectedIntegration.enabled ? 'Disable' : 'Enable' }}</button>
          <button
            @click="handleDelete(selectedIntegration.id)"
            class="rounded-md bg-red-600/20 px-3 py-2 text-sm font-medium text-red-400 hover:bg-red-600/30 transition-colors"
          >Delete Integration</button>
        </section>
      </div>
    </template>
  </div>
</template>
