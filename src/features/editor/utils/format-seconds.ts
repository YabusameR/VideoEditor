/** Seconds as m:ss (rounded), e.g. 75.4 → "1:15". */
export function formatSeconds(seconds: number): string {
  const total = Math.max(0, Math.round(seconds))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${minutes}:${String(rest).padStart(2, '0')}`
}
