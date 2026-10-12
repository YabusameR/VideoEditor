#!/usr/bin/env node
/**
 * Synthesizes the built-in sound effects into public/sfx/*.wav.
 *
 * Every effect is generated from oscillators and seeded noise, so the files
 * are original to this project (no third-party samples or licenses).
 * Output is deterministic; re-run after editing a recipe:
 *   node scripts/generate-sfx.mjs
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const SAMPLE_RATE = 44100
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'sfx')
const TAU = Math.PI * 2

// Deterministic noise (mulberry32) so regenerated files are byte-identical.
function createNoise(seed) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2147483648 - 1
  }
}

function render(seconds, sampleAt) {
  const length = Math.round(seconds * SAMPLE_RATE)
  const samples = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    samples[i] = sampleAt(i / SAMPLE_RATE, i)
  }
  return samples
}

/** Phase-accumulating oscillator for pitch sweeps without clicks. */
function sweep(seconds, freqAt, shape, envAt) {
  let phase = 0
  return render(seconds, (t) => {
    phase += (TAU * freqAt(t)) / SAMPLE_RATE
    return shape(phase) * envAt(t)
  })
}

const sine = (p) => Math.sin(p)
const square = (p) => (Math.sin(p) >= 0 ? 1 : -1)
const expDecay = (rate) => (t) => Math.exp(-t * rate)
const attack = (t, a) => Math.min(1, t / a)

function mix(...tracks) {
  const length = Math.max(...tracks.map((track) => track.length))
  const out = new Float32Array(length)
  for (const track of tracks) {
    for (let i = 0; i < track.length; i++) out[i] += track[i]
  }
  return out
}

function offset(track, seconds) {
  const pad = Math.round(seconds * SAMPLE_RATE)
  const out = new Float32Array(track.length + pad)
  out.set(track, pad)
  return out
}

/** One-pole low-pass, cutoff may vary over time. */
function lowpass(track, cutoffAt) {
  const out = new Float32Array(track.length)
  let y = 0
  for (let i = 0; i < track.length; i++) {
    const rc = 1 / (TAU * cutoffAt(i / SAMPLE_RATE))
    const alpha = 1 / (1 + rc * SAMPLE_RATE)
    y += alpha * (track[i] - y)
    out[i] = y
  }
  return out
}

function normalize(track, peak = 0.89) {
  let max = 0
  for (const value of track) max = Math.max(max, Math.abs(value))
  const gain = max > 0 ? peak / max : 1
  // 5 ms fade-out guards against a click at the very end.
  const fade = Math.round(0.005 * SAMPLE_RATE)
  return track.map((value, i) => {
    const tail = Math.min(1, (track.length - 1 - i) / fade)
    return value * gain * tail
  })
}

function toWav(track) {
  const data = Buffer.alloc(track.length * 2)
  track.forEach((value, i) => {
    const clamped = Math.max(-1, Math.min(1, value))
    data.writeInt16LE(Math.round(clamped * 32767), i * 2)
  })
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVE', 8)
  header.write('fmt ', 12)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20) // PCM
  header.writeUInt16LE(1, 22) // mono
  header.writeUInt32LE(SAMPLE_RATE, 24)
  header.writeUInt32LE(SAMPLE_RATE * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

const RECIPES = {
  // ポン: quick downward blip
  pop: () =>
    sweep(
      0.12,
      (t) => 900 * Math.exp(-t * 28) + 180,
      sine,
      (t) => attack(t, 0.002) * expDecay(30)(t),
    ),

  // カチッ: tiny filtered click
  click: () => {
    const noise = createNoise(7)
    return lowpass(
      render(0.03, (t) => noise() * expDecay(220)(t)),
      () => 6000,
    )
  },

  // シュッ: filtered noise sweep
  whoosh: () => {
    const noise = createNoise(42)
    const body = render(0.7, (t) => noise() * Math.sin(Math.PI * Math.min(1, t / 0.7)) ** 2)
    return lowpass(body, (t) => 300 + 5200 * Math.sin(Math.PI * Math.min(1, t / 0.7)))
  },

  // チーン: bell with inharmonic partials
  ding: () =>
    mix(
      ...[
        [1320, 1, 3.2],
        [2640, 0.45, 4.5],
        [3630, 0.25, 6],
        [5280, 0.12, 8],
      ].map(([freq, gain, decay]) =>
        sweep(
          1.6,
          () => freq,
          sine,
          (t) => gain * attack(t, 0.003) * expDecay(decay)(t),
        ),
      ),
    ),

  // ピンポン: correct-answer two-note chime
  correct: () => {
    const note = (freq) =>
      mix(
        sweep(0.55, () => freq, sine, (t) => attack(t, 0.004) * expDecay(5)(t)),
        sweep(0.55, () => freq * 2, sine, (t) => 0.3 * attack(t, 0.004) * expDecay(7)(t)),
      )
    return mix(note(1047), offset(note(1319), 0.22))
  },

  // ブブー: wrong-answer buzzer
  wrong: () => {
    const buzz = (start) =>
      offset(
        lowpass(
          sweep(0.32, () => 155, square, (t) => attack(t, 0.01) * (t < 0.28 ? 1 : 1 - (t - 0.28) / 0.04)),
          () => 2400,
        ),
        start,
      )
    return mix(buzz(0), buzz(0.4))
  },

  // ボヨン: springy wobble
  boing: () =>
    sweep(
      0.6,
      (t) => 220 + 140 * Math.exp(-t * 4) * Math.sin(TAU * 11 * t) + 120 * (1 - t / 0.6),
      sine,
      (t) => attack(t, 0.005) * expDecay(4.5)(t),
    ),

  // ドン: deep impact
  impact: () => {
    const noise = createNoise(99)
    return mix(
      sweep(0.6, (t) => 45 + 110 * Math.exp(-t * 18), sine, (t) => attack(t, 0.002) * expDecay(6)(t)),
      lowpass(
        render(0.15, (t) => 0.6 * noise() * expDecay(40)(t)),
        () => 1800,
      ),
    )
  },

  // キラーン: sparkling arpeggio
  sparkle: () => {
    const notes = [1568, 2093, 2637, 3136, 4186]
    return mix(
      ...notes.map((freq, i) =>
        offset(
          sweep(0.7, () => freq, sine, (t) => 0.6 * attack(t, 0.002) * expDecay(7)(t)),
          i * 0.06,
        ),
      ),
    )
  },
}

// Square-wave sounds are far louder than sines at the same peak; trim them so
// all effects land at a similar perceived level.
const PEAKS = { wrong: 0.4 }

mkdirSync(OUT_DIR, { recursive: true })
for (const [name, recipe] of Object.entries(RECIPES)) {
  const wav = toWav(normalize(recipe(), PEAKS[name]))
  writeFileSync(join(OUT_DIR, `sfx-${name}.wav`), wav)
  console.log(`sfx/sfx-${name}.wav  ${(wav.length / 1024).toFixed(1)} KiB`)
}
