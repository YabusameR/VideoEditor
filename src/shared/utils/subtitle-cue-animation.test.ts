import { describe, expect, it } from 'vite-plus/test'
import { evaluateSubtitleCueAnimation } from './subtitle-cue-animation'

describe('evaluateSubtitleCueAnimation', () => {
  it('is settled without an animation or between the entrance and exit', () => {
    expect(evaluateSubtitleCueAnimation(undefined, 0, 2)).toBeNull()
    expect(evaluateSubtitleCueAnimation({ in: 'fade', out: 'fade' }, 1, 2)).toBeNull()
  })

  it('fades each cue in from its own start', () => {
    const animation = { in: 'fade' as const, durationSeconds: 0.2 }
    expect(evaluateSubtitleCueAnimation(animation, 0, 2)?.opacity).toBe(0)
    expect(evaluateSubtitleCueAnimation(animation, 0.1, 2)?.opacity).toBeGreaterThan(0.5)
    expect(evaluateSubtitleCueAnimation(animation, 0.2, 2)).toBeNull()
  })

  it('fades out toward the cue end', () => {
    const animation = { out: 'fade' as const, durationSeconds: 0.2 }
    expect(evaluateSubtitleCueAnimation(animation, 1.7, 2)).toBeNull()
    const nearEnd = evaluateSubtitleCueAnimation(animation, 1.99, 2)!
    expect(nearEnd.opacity).toBeLessThan(0.2)
  })

  it('slides in from below and leaves upward', () => {
    expect(evaluateSubtitleCueAnimation({ in: 'slide-up' }, 0, 2)?.offsetY).toBeGreaterThan(0)
    expect(evaluateSubtitleCueAnimation({ out: 'slide-up' }, 1.99, 2)?.offsetY).toBeLessThan(0)
  })

  it('pops and zooms through scale', () => {
    expect(evaluateSubtitleCueAnimation({ in: 'pop' }, 0, 2)?.scale).toBeCloseTo(0.6)
    expect(evaluateSubtitleCueAnimation({ in: 'zoom-in' }, 0, 2)?.scale).toBeCloseTo(1.4)
    expect(evaluateSubtitleCueAnimation({ out: 'shrink' }, 2, 2)?.scale).toBeCloseTo(0.6)
  })

  it('caps the length to half of a short cue so entrance and exit never overlap', () => {
    const animation = { in: 'fade' as const, out: 'fade' as const, durationSeconds: 1 }
    expect(evaluateSubtitleCueAnimation(animation, 0.2, 0.4)).toBeNull()
    expect(evaluateSubtitleCueAnimation(animation, 0.1, 0.4)?.opacity).toBeLessThan(1)
  })
})
