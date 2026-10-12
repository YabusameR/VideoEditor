import { describe, expect, it } from 'vite-plus/test'
import {
  clampCueBoundary,
  cuesTouch,
  mergeCueWithPrevious,
  moveCueBoundary,
  splitCueAtCaret,
} from './subtitle-cue-edit'

const cue = (id: string, startSeconds: number, endSeconds: number, text: string) => ({
  id,
  startSeconds,
  endSeconds,
  text,
})

describe('splitCueAtCaret', () => {
  it('splits text at the caret and time in proportion', () => {
    const result = splitCueAtCaret([cue('a', 0, 4, 'こんにちは世界')], 'a', 5, 'b')

    expect(result).toEqual([
      cue('a', 0, 4 * (5 / 7), 'こんにちは'),
      cue('b', 4 * (5 / 7), 4, '世界'),
    ])
  })

  it('trims whitespace around the split and keeps neighbours untouched', () => {
    const result = splitCueAtCaret(
      [cue('x', 0, 1, 'before'), cue('a', 1, 3, 'hello world'), cue('y', 3, 4, 'after')],
      'a',
      5,
      'b',
    )

    expect(result?.map((c) => c.text)).toEqual(['before', 'hello', 'world', 'after'])
    expect(result?.[0]).toEqual(cue('x', 0, 1, 'before'))
  })

  it('keeps whole-cue formatting and alignment on both halves', () => {
    const result = splitCueAtCaret([cue('a', 0, 2, '{\\an8}<i>ab</i>')], 'a', 1, 'b')

    expect(result?.map((c) => c.text)).toEqual(['{\\an8}<i>a</i>', '{\\an8}<i>b</i>'])
  })

  it('refuses splits at the edges or on cues too short to divide', () => {
    expect(splitCueAtCaret([cue('a', 0, 2, 'abc')], 'a', 0)).toBeNull()
    expect(splitCueAtCaret([cue('a', 0, 2, 'abc')], 'a', 3)).toBeNull()
    expect(splitCueAtCaret([cue('a', 0, 0.05, 'abc')], 'a', 1)).toBeNull()
    expect(splitCueAtCaret([cue('a', 0, 2, 'abc')], 'missing', 1)).toBeNull()
  })
})

describe('mergeCueWithPrevious', () => {
  it('joins Japanese text without a space and spans both ranges', () => {
    const result = mergeCueWithPrevious([cue('a', 0, 1, 'こんにちは'), cue('b', 1, 3, '世界')], 'b')

    expect(result).toEqual({
      cues: [cue('a', 0, 3, 'こんにちは世界')],
      mergedId: 'a',
      caret: 5,
    })
  })

  it('inserts a space between Latin words', () => {
    const result = mergeCueWithPrevious([cue('a', 0, 1, 'hello'), cue('b', 1, 2, 'world')], 'b')

    expect(result?.cues[0]?.text).toBe('hello world')
    expect(result?.caret).toBe(6)
  })

  it('is a no-op for the first cue', () => {
    expect(mergeCueWithPrevious([cue('a', 0, 1, 'x')], 'a')).toBeNull()
  })

  it('round-trips with split', () => {
    const original = [cue('a', 0, 2, 'こんにちは世界')]
    const split = splitCueAtCaret(original, 'a', 5, 'b')!
    expect(mergeCueWithPrevious(split, 'b')?.cues).toEqual(original)
  })
})

describe('cue boundaries', () => {
  const cues = [cue('a', 0, 1, 'one'), cue('b', 1, 2, 'two'), cue('c', 2.5, 3, 'three')]

  it('detects touching cues', () => {
    expect(cuesTouch(cues, 0)).toBe(true)
    expect(cuesTouch(cues, 1)).toBe(false)
    expect(cuesTouch(cues, 2)).toBe(false)
  })

  it('moves the shared boundary of two cues', () => {
    expect(moveCueBoundary(cues, 0, 1.4).slice(0, 2)).toEqual([
      cue('a', 0, 1.4, 'one'),
      cue('b', 1.4, 2, 'two'),
    ])
  })

  it('never collapses either cue', () => {
    expect(clampCueBoundary(cues, 0, -5)).toBeCloseTo(0.05)
    expect(clampCueBoundary(cues, 0, 99)).toBeCloseTo(1.95)
  })
})
