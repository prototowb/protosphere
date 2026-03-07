import { vi } from 'vitest'

// ── BroadcastChannel mock ────────────────────────────────────────────────────
class MockBroadcastChannel {
  name: string
  onmessage: ((event: MessageEvent) => void) | null = null
  static instances: MockBroadcastChannel[] = []

  constructor(name: string) {
    this.name = name
    MockBroadcastChannel.instances.push(this)
  }

  postMessage(data: unknown) {
    // Broadcast to all other instances with the same channel name
    MockBroadcastChannel.instances
      .filter((ch) => ch !== this && ch.name === this.name && ch.onmessage)
      .forEach((ch) => ch.onmessage!(new MessageEvent('message', { data })))
  }

  close = vi.fn()

  static reset() {
    MockBroadcastChannel.instances = []
  }
}

globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel

// ── window.location.reload mock ──────────────────────────────────────────────
Object.defineProperty(window, 'location', {
  value: { ...window.location, reload: vi.fn() },
  writable: true,
})
