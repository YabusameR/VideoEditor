import { create } from 'zustand'

/**
 * Short-video mode UI state: which platform's UI safe zone is overlaid on the
 * preview, and the target length the toolbar's duration gauge measures against.
 * Purely presentational — never touches project/timeline state.
 */
export type ShortsSafeZonePlatform = 'off' | 'tiktok' | 'reels' | 'shorts'

export const SHORTS_SAFE_ZONE_PLATFORMS: readonly ShortsSafeZonePlatform[] = [
  'off',
  'tiktok',
  'reels',
  'shorts',
]

/** Target durations (seconds) offered by the duration gauge. */
export const SHORTS_TARGET_DURATIONS: readonly number[] = [15, 30, 60, 90, 180]

/**
 * Approximate areas covered by each platform's overlay UI, as fractions of the
 * 9:16 frame. Content placed outside these insets stays visible.
 */
export const SHORTS_SAFE_ZONE_INSETS: Record<
  Exclude<ShortsSafeZonePlatform, 'off'>,
  { top: number; bottom: number; left: number; right: number }
> = {
  tiktok: { top: 0.0677, bottom: 0.2, left: 0.0556, right: 0.1481 },
  reels: { top: 0.1042, bottom: 0.2083, left: 0.0556, right: 0.1204 },
  shorts: { top: 0.0781, bottom: 0.2083, left: 0.0556, right: 0.1481 },
}

const SAFE_ZONE_STORAGE_KEY = 'shorts:safeZonePlatform'
const TARGET_DURATION_STORAGE_KEY = 'shorts:targetDurationSec'
const DEFAULT_TARGET_DURATION_SEC = 60

function loadSafeZonePlatform(): ShortsSafeZonePlatform {
  try {
    const stored = localStorage.getItem(SAFE_ZONE_STORAGE_KEY)
    if (SHORTS_SAFE_ZONE_PLATFORMS.includes(stored as ShortsSafeZonePlatform)) {
      return stored as ShortsSafeZonePlatform
    }
  } catch {
    /* noop */
  }
  return 'off'
}

function loadTargetDuration(): number {
  try {
    const stored = Number(localStorage.getItem(TARGET_DURATION_STORAGE_KEY))
    if (SHORTS_TARGET_DURATIONS.includes(stored)) return stored
  } catch {
    /* noop */
  }
  return DEFAULT_TARGET_DURATION_SEC
}

interface ShortsState {
  safeZonePlatform: ShortsSafeZonePlatform
  targetDurationSec: number
  setSafeZonePlatform: (platform: ShortsSafeZonePlatform) => void
  setTargetDurationSec: (seconds: number) => void
}

export const useShortsStore = create<ShortsState>((set) => ({
  safeZonePlatform: loadSafeZonePlatform(),
  targetDurationSec: loadTargetDuration(),
  setSafeZonePlatform: (safeZonePlatform) => {
    try {
      localStorage.setItem(SAFE_ZONE_STORAGE_KEY, safeZonePlatform)
    } catch {
      /* noop */
    }
    set({ safeZonePlatform })
  },
  setTargetDurationSec: (targetDurationSec) => {
    try {
      localStorage.setItem(TARGET_DURATION_STORAGE_KEY, String(targetDurationSec))
    } catch {
      /* noop */
    }
    set({ targetDurationSec })
  },
}))
