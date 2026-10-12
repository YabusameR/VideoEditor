import { afterEach, describe, expect, it } from 'vite-plus/test'
import { act, cleanup, render } from '@testing-library/react'
import { useShortsStore } from '@/shared/state/shorts'
import { SafeZoneOverlay } from './safe-zone-overlay'

describe('SafeZoneOverlay', () => {
  afterEach(() => {
    cleanup()
    act(() => useShortsStore.getState().setSafeZonePlatform('off'))
  })

  it('renders nothing when the guide is off', () => {
    act(() => useShortsStore.getState().setSafeZonePlatform('off'))
    const { container } = render(<SafeZoneOverlay />)
    expect(container.querySelector('[data-safe-zone-overlay]')).toBeNull()
  })

  it('shades the selected platform UI zones without capturing pointer events', () => {
    act(() => useShortsStore.getState().setSafeZonePlatform('tiktok'))
    const { container } = render(<SafeZoneOverlay />)
    const overlay = container.querySelector('[data-safe-zone-overlay="tiktok"]')
    expect(overlay).not.toBeNull()
    expect(overlay?.className).toContain('pointer-events-none')
  })

  it('persists the chosen platform', () => {
    act(() => useShortsStore.getState().setSafeZonePlatform('reels'))
    expect(localStorage.getItem('shorts:safeZonePlatform')).toBe('reels')
  })
})
