import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Integration, SpaceIntegrationRequirement, UserIntegration } from '@/lib/types'

const { mockList, mockListConnectable, mockListSpaceRequirements, mockListUserIntegrations } = vi.hoisted(() => ({
  mockList: vi.fn(),
  mockListConnectable: vi.fn(),
  mockListSpaceRequirements: vi.fn(),
  mockListUserIntegrations: vi.fn(),
}))

vi.mock('@/lib/backend', () => ({
  isLocalMode: false,
  backend: {
    integrations: {
      list: mockList,
      listConnectable: mockListConnectable,
      listSpaceRequirements: mockListSpaceRequirements,
      listUserIntegrations: mockListUserIntegrations,
    },
  },
}))

import { useSpaceRequirements } from '@/composables/useSpaceRequirements'

function integration(overrides: Partial<Integration> = {}): Integration {
  return {
    id: 'int-1',
    name: 'Learn',
    slug: 'learn',
    description: '',
    icon_url: null,
    api_base_url: 'https://learn.example.com',
    api_key: '',
    app_url: null,
    signing_key: null,
    auth_mode: 'token_exchange',
    data_endpoint: '/data',
    default_ttl_seconds: 300,
    enabled: true,
    created_by: 'owner',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function requirement(serverId: string, integrationId: string, fieldKey: string, required = true): SpaceIntegrationRequirement {
  return {
    id: `${serverId}-${integrationId}-${fieldKey}`,
    server_id: serverId,
    integration_id: integrationId,
    field_key: fieldKey,
    required,
    created_at: '2026-01-01T00:00:00Z',
  }
}

function connection(integrationId: string): UserIntegration {
  return {
    id: `ui-${integrationId}`,
    user_id: 'member',
    integration_id: integrationId,
    external_user_id: null,
    connected_at: '2026-01-01T00:00:00Z',
    synced_data: null,
    synced_at: null,
    connection_token: null,
  }
}

// The requirements cache is module-level, so each test uses its own server id.
let serverSeq = 0
function nextServerId() {
  serverSeq += 1
  return `server-${serverSeq}`
}

describe('useSpaceRequirements.getMissingRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // A regular member cannot read the integrations table directly (only its
    // owner can), so the table read comes back empty for them.
    mockList.mockResolvedValue([])
    mockListConnectable.mockResolvedValue([integration()])
    mockListUserIntegrations.mockResolvedValue([])
  })

  it('reports a missing required integration to a non-admin member', async () => {
    const serverId = nextServerId()
    mockListSpaceRequirements.mockResolvedValue([
      requirement(serverId, 'int-1', 'level'),
      requirement(serverId, 'int-1', 'streak'),
    ])

    const { getMissingRequirements } = useSpaceRequirements()
    const missing = await getMissingRequirements(serverId, 'member')

    expect(missing).toHaveLength(1)
    expect(missing[0].integration.id).toBe('int-1')
    expect(missing[0].fieldKeys).toEqual(['level', 'streak'])
    expect(mockListConnectable).toHaveBeenCalledOnce()
    expect(mockList).not.toHaveBeenCalled()
  })

  it('reports nothing once the member has connected the integration', async () => {
    const serverId = nextServerId()
    mockListSpaceRequirements.mockResolvedValue([requirement(serverId, 'int-1', 'level')])
    mockListUserIntegrations.mockResolvedValue([connection('int-1')])

    const { getMissingRequirements } = useSpaceRequirements()
    expect(await getMissingRequirements(serverId, 'member')).toEqual([])
  })

  it('ignores optional requirements and integrations that are not connectable', async () => {
    const serverId = nextServerId()
    mockListSpaceRequirements.mockResolvedValue([
      requirement(serverId, 'int-1', 'level', false),
      requirement(serverId, 'int-gone', 'score'),
    ])

    const { getMissingRequirements } = useSpaceRequirements()
    expect(await getMissingRequirements(serverId, 'member')).toEqual([])
  })

  it('skips the integration lookups when the space has no requirements', async () => {
    const serverId = nextServerId()
    mockListSpaceRequirements.mockResolvedValue([])

    const { getMissingRequirements } = useSpaceRequirements()
    expect(await getMissingRequirements(serverId, 'member')).toEqual([])
    expect(mockListConnectable).not.toHaveBeenCalled()
    expect(mockListUserIntegrations).not.toHaveBeenCalled()
  })
})
