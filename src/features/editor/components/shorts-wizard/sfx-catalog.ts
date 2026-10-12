/**
 * Built-in sound effects. The WAV files in public/sfx are synthesized by
 * scripts/generate-sfx.mjs, so they carry no third-party license.
 */
export const SFX_IDS = [
  'pop',
  'click',
  'whoosh',
  'ding',
  'correct',
  'wrong',
  'boing',
  'impact',
  'sparkle',
] as const

export type SfxId = (typeof SFX_IDS)[number]

export function getSfxFileName(id: SfxId): string {
  return `sfx-${id}.wav`
}

export function getSfxUrl(id: SfxId): string {
  return `/sfx/${getSfxFileName(id)}`
}
