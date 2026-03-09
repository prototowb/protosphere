import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockGet, mockSet } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSet: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: true,
  backend: {
    notification_preferences: {
      get: mockGet,
      set: mockSet,
    },
  },
}))

// Re-import fresh after mock reset — composable uses module-level cache,
// so we isolate each test by resetting mocks and only testing cache behaviour
// within a single import lifetime.
import { useNotificationPreferences } from '@/composables/useNotificationPreferences'

describe('useNotificationPreferences', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset the module-level cache between tests by clearing the ref
    const { levelCache } = useNotificationPreferences()
    levelCache.value = {}
  })

  it('getCached returns "all" for unknown channel', () => {
    const { getCached } = useNotificationPreferences()
    expect(getCached('unknown-channel')).toBe('all')
  })

  it('loadLevel fetches from backend and caches result', async () => {
    mockGet.mockResolvedValue({ level: 'mentions' })
    const { loadLevel, getCached } = useNotificationPreferences()

    const level = await loadLevel('user-1', 'channel-1')

    expect(level).toBe('mentions')
    expect(mockGet).toHaveBeenCalledWith('user-1', 'channel-1')
    expect(getCached('channel-1')).toBe('mentions')
  })

  it('loadLevel returns "all" when backend returns null', async () => {
    mockGet.mockResolvedValue(null)
    const { loadLevel } = useNotificationPreferences()

    const level = await loadLevel('user-1', 'channel-null')
    expect(level).toBe('all')
  })

  it('second loadLevel call for same channel uses cache (no second backend call)', async () => {
    mockGet.mockResolvedValue({ level: 'none' })
    const { loadLevel } = useNotificationPreferences()

    await loadLevel('user-1', 'channel-2')
    await loadLevel('user-1', 'channel-2')

    expect(mockGet).toHaveBeenCalledTimes(1)
  })

  it('setLevel calls backend and updates cache', async () => {
    mockSet.mockResolvedValue({ level: 'mentions' })
    const { setLevel, getCached } = useNotificationPreferences()

    await setLevel('user-1', 'channel-3', 'mentions')

    expect(mockSet).toHaveBeenCalledWith('user-1', 'channel-3', 'mentions')
    expect(getCached('channel-3')).toBe('mentions')
  })
})
