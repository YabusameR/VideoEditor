/**
 * Structural edits on a subtitle cue list: split a cue at the text caret,
 * merge a cue into the previous one, and move the boundary between two
 * touching cues. Pure functions — callers write the result back to the
 * timeline item that owns the cues.
 *
 * Cue text may carry markup (`<i>`, `{\anN}` …); edits work on the plain
 * text and re-apply the cue's whole-cue formatting via {@link buildCueText}.
 */

import { buildCueText, getCueFormatFlags, parseSubtitleCueText } from './subtitle-cue-format'

export interface EditableCue {
  id: string
  startSeconds: number
  endSeconds: number
  text: string
}

/** Shortest cue an edit may produce. */
export const MIN_EDIT_CUE_SECONDS = 0.05

/** Two cues closer than this are treated as touching (one shared boundary). */
const TOUCHING_EPSILON_SECONDS = 0.05

const WORD_CHAR = /[A-Za-z0-9]/

/**
 * Split a cue into two at `plainCaret` (an index into the cue's plain text).
 * Time is divided in proportion to the text on each side. Returns null when
 * there is nothing to split (caret at an edge, or the cue is too short).
 */
export function splitCueAtCaret<T extends EditableCue>(
  cues: readonly T[],
  cueId: string,
  plainCaret: number,
  newId: string = crypto.randomUUID(),
): T[] | null {
  const index = cues.findIndex((cue) => cue.id === cueId)
  const cue = cues[index]
  if (!cue) return null

  const parsed = parseSubtitleCueText(cue.text)
  const plain = parsed.plainText
  const before = plain.slice(0, plainCaret).trimEnd()
  const after = plain.slice(plainCaret).trimStart()
  if (!before || !after) return null

  const duration = cue.endSeconds - cue.startSeconds
  if (duration < MIN_EDIT_CUE_SECONDS * 2) return null
  const ratio = plainCaret / plain.length
  const splitSeconds = clamp(
    cue.startSeconds + duration * ratio,
    cue.startSeconds + MIN_EDIT_CUE_SECONDS,
    cue.endSeconds - MIN_EDIT_CUE_SECONDS,
  )

  const flags = getCueFormatFlags(parsed)
  const first = { ...cue, endSeconds: splitSeconds, text: buildCueText(before, flags, cue.text) }
  const second = {
    ...cue,
    id: newId,
    startSeconds: splitSeconds,
    text: buildCueText(after, flags, cue.text),
  }
  return [...cues.slice(0, index), first, second, ...cues.slice(index + 1)]
}

/**
 * Merge a cue into the one before it. The merged cue keeps the previous
 * cue's id and formatting and spans both time ranges. `caret` is where the
 * join happened in the merged plain text (to restore the text cursor).
 */
export function mergeCueWithPrevious<T extends EditableCue>(
  cues: readonly T[],
  cueId: string,
): { cues: T[]; mergedId: string; caret: number } | null {
  const index = cues.findIndex((cue) => cue.id === cueId)
  const previous = cues[index - 1]
  const cue = cues[index]
  if (!previous || !cue) return null

  const previousParsed = parseSubtitleCueText(previous.text)
  const previousPlain = previousParsed.plainText
  const currentPlain = parseSubtitleCueText(cue.text).plainText
  // Latin words need a space between them; Japanese and other CJK text don't.
  const separator =
    WORD_CHAR.test(previousPlain.slice(-1)) && WORD_CHAR.test(currentPlain.slice(0, 1)) ? ' ' : ''

  const merged = {
    ...previous,
    endSeconds: Math.max(previous.endSeconds, cue.endSeconds),
    text: buildCueText(
      previousPlain + separator + currentPlain,
      getCueFormatFlags(previousParsed),
      previous.text,
    ),
  }
  return {
    cues: [...cues.slice(0, index - 1), merged, ...cues.slice(index + 1)],
    mergedId: previous.id,
    caret: previousPlain.length + separator.length,
  }
}

/** Whether cue `index` ends where cue `index + 1` starts. */
export function cuesTouch(cues: readonly EditableCue[], index: number): boolean {
  const left = cues[index]
  const right = cues[index + 1]
  return (
    !!left && !!right && Math.abs(right.startSeconds - left.endSeconds) < TOUCHING_EPSILON_SECONDS
  )
}

/** Clamp a proposed boundary time between cue `index` and `index + 1`. */
export function clampCueBoundary(
  cues: readonly EditableCue[],
  index: number,
  seconds: number,
): number {
  const left = cues[index]
  const right = cues[index + 1]
  if (!left || !right) return seconds
  return clamp(
    seconds,
    left.startSeconds + MIN_EDIT_CUE_SECONDS,
    right.endSeconds - MIN_EDIT_CUE_SECONDS,
  )
}

/**
 * Move the shared boundary between cue `index` and `index + 1`: the left cue
 * now ends, and the right cue starts, at `seconds` (clamped so neither cue
 * gets shorter than {@link MIN_EDIT_CUE_SECONDS}).
 */
export function moveCueBoundary<T extends EditableCue>(
  cues: readonly T[],
  index: number,
  seconds: number,
): T[] {
  const left = cues[index]
  const right = cues[index + 1]
  if (!left || !right) return [...cues]
  const boundary = clampCueBoundary(cues, index, seconds)
  const next = [...cues]
  next[index] = { ...left, endSeconds: boundary }
  next[index + 1] = { ...right, startSeconds: boundary }
  return next
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}
