/**
 * Per-cue entrance/exit animation for subtitle segments. Each cue animates
 * at its own start and end — so the animation plays on every caption change,
 * not just at the start and end of the whole segment.
 *
 * Shared by the DOM preview and the canvas renderer so both agree.
 */

import type {
  SubtitleCueAnimation,
  SubtitleCueInAnimation,
  SubtitleCueOutAnimation,
} from '@/types/timeline'

export const SUBTITLE_CUE_IN_ANIMATIONS: readonly SubtitleCueInAnimation[] = [
  'fade',
  'pop',
  'slide-up',
  'zoom-in',
]
export const SUBTITLE_CUE_OUT_ANIMATIONS: readonly SubtitleCueOutAnimation[] = [
  'fade',
  'shrink',
  'slide-up',
]

export const DEFAULT_SUBTITLE_CUE_ANIMATION_SECONDS = 0.25

export interface SubtitleCueAnimationState {
  opacity: number
  scale: number
  /** Vertical offset in multiples of the font size (positive = down). */
  offsetY: number
}

/** How far a slide moves the text, in multiples of the font size. */
const SLIDE_DISTANCE = 0.6

/**
 * Animation state of the active cue, `secondsIntoCue` after it starts.
 * Returns null while the cue is settled (no transform needed).
 */
export function evaluateSubtitleCueAnimation(
  animation: SubtitleCueAnimation | undefined,
  secondsIntoCue: number,
  cueDurationSeconds: number,
): SubtitleCueAnimationState | null {
  if (!animation || (!animation.in && !animation.out) || cueDurationSeconds <= 0) return null
  const length = Math.min(
    animation.durationSeconds ?? DEFAULT_SUBTITLE_CUE_ANIMATION_SECONDS,
    cueDurationSeconds / 2,
  )
  if (length <= 0) return null

  const state: SubtitleCueAnimationState = { opacity: 1, scale: 1, offsetY: 0 }
  let active = false

  if (animation.in && secondsIntoCue < length) {
    applyIn(state, animation.in, clamp01(secondsIntoCue / length))
    active = true
  }
  const secondsLeft = cueDurationSeconds - secondsIntoCue
  if (animation.out && secondsLeft < length) {
    applyOut(state, animation.out, clamp01(secondsLeft / length))
    active = true
  }
  return active ? state : null
}

/** `progress` runs 0 → 1 as the cue enters. */
function applyIn(
  state: SubtitleCueAnimationState,
  kind: SubtitleCueInAnimation,
  progress: number,
): void {
  const eased = easeOutCubic(progress)
  switch (kind) {
    case 'fade':
      state.opacity *= eased
      break
    case 'pop':
      state.opacity *= Math.min(1, progress * 2)
      state.scale *= 0.6 + 0.4 * easeOutBack(progress)
      break
    case 'slide-up':
      state.opacity *= eased
      state.offsetY += (1 - eased) * SLIDE_DISTANCE
      break
    case 'zoom-in':
      state.opacity *= eased
      state.scale *= 1.4 - 0.4 * eased
      break
  }
}

/** `remaining` runs 1 → 0 as the cue leaves. */
function applyOut(
  state: SubtitleCueAnimationState,
  kind: SubtitleCueOutAnimation,
  remaining: number,
): void {
  const eased = easeOutCubic(remaining)
  switch (kind) {
    case 'fade':
      state.opacity *= eased
      break
    case 'shrink':
      state.opacity *= eased
      state.scale *= 0.6 + 0.4 * eased
      break
    case 'slide-up':
      state.opacity *= eased
      state.offsetY -= (1 - eased) * SLIDE_DISTANCE
      break
  }
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeOutBack(t: number): number {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2
}
