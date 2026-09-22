import { describe, expect, it } from 'vitest'
import { describeUpdateState, updateStatusLabel } from '~/composables/usePwaUpdate'
import type { UpdateStatus } from '~/composables/usePwaUpdate'

describe('describeUpdateState', () => {
  it('reports unsupported when there is no service worker runtime', () => {
    expect(describeUpdateState(undefined)).toBe('unsupported')
  })

  it('reports an update when a new worker is waiting', () => {
    expect(describeUpdateState({
      needRefresh: true,
      registrationError: false,
      swActivated: true,
    })).toBe('update-available')
  })

  it('prefers a waiting update over a registration error', () => {
    // A worker cannot be waiting unless it registered, so the error flag is stale here —
    // and an update the player can actually apply should not be hidden behind it.
    expect(describeUpdateState({
      needRefresh: true,
      registrationError: true,
      swActivated: true,
    })).toBe('update-available')
  })

  it('reports an error when registration failed', () => {
    expect(describeUpdateState({
      needRefresh: false,
      registrationError: true,
      swActivated: false,
    })).toBe('error')
  })

  it('reports installing while the first worker is still precaching', () => {
    expect(describeUpdateState({
      needRefresh: false,
      registrationError: false,
      swActivated: false,
    })).toBe('installing')
  })

  it('reports up to date once the worker is active and nothing is waiting', () => {
    expect(describeUpdateState({
      needRefresh: false,
      registrationError: false,
      swActivated: true,
    })).toBe('up-to-date')
  })
})

describe('updateStatusLabel', () => {
  const statuses: UpdateStatus[] = [
    'unsupported',
    'installing',
    'up-to-date',
    'update-available',
    'error',
  ]

  it('gives every status its own non-empty label', () => {
    const labels = statuses.map(updateStatusLabel)
    expect(labels.every(l => l.length > 0)).toBe(true)
    expect(new Set(labels).size).toBe(statuses.length)
  })
})
