// Domain rules for external integrations (pure — no I/O).

import type { FieldVisibility } from './types'

/** Abort an integration fetch after this long. */
export const INTEGRATION_FETCH_TIMEOUT_MS = 10_000

/** Largest synced payload we will store (serialised JSON, bytes ≈ chars). */
export const MAX_INTEGRATION_PAYLOAD_CHARS = 64 * 1024

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * Throw unless `url` is safe to send a user credential to: https anywhere, or
 * plain http only to a loopback host (local development).
 */
export function assertIntegrationUrl(url: string): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Integration URL is not a valid absolute URL')
  }
  if (parsed.protocol === 'https:') return
  if (parsed.protocol === 'http:' && LOCAL_HOSTS.has(parsed.hostname)) return
  throw new Error('Integration URL must use https')
}

/**
 * Parse and validate an integration API response body into the stored
 * `synced_data` shape: a plain object of `{ [field_key]: { value, ... } }`.
 * Accepts either `{ fields: {...} }` or the bare fields object.
 */
export function parseIntegrationPayload(body: string): Record<string, unknown> {
  if (body.length > MAX_INTEGRATION_PAYLOAD_CHARS) {
    throw new Error('Integration payload is too large')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    throw new Error('Integration API returned invalid JSON')
  }
  const fields = isPlainObject(parsed) && isPlainObject(parsed.fields) ? parsed.fields : parsed
  if (!isPlainObject(fields)) {
    throw new Error('Integration payload must be an object of fields')
  }
  const out: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(fields)) {
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue
    if (isPlainObject(entry) && 'value' in entry) out[key] = entry
  }
  return out
}

/** Whether a field with this effective visibility is shown to the viewer. */
export function isFieldVisibleTo(visibility: FieldVisibility, viewerIsOwner: boolean): boolean {
  if (visibility === 'public') return true
  if (visibility === 'private') return viewerIsOwner
  return false
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
