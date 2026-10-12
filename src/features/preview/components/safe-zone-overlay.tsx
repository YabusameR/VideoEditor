import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { SHORTS_SAFE_ZONE_INSETS, useShortsStore } from '@/shared/state/shorts'

/**
 * Shades the parts of a vertical frame that TikTok / Reels / Shorts cover with
 * their own UI (caption, buttons, header), so text and faces stay clear of them.
 * Rendered inside the player container; never intercepts pointer events and is
 * not part of the export.
 */
export const SafeZoneOverlay = memo(function SafeZoneOverlay() {
  const { t } = useTranslation()
  const platform = useShortsStore((s) => s.safeZonePlatform)
  if (platform === 'off') return null

  const inset = SHORTS_SAFE_ZONE_INSETS[platform]
  const pct = (value: number) => `${value * 100}%`
  const shade = 'absolute bg-black/45'

  return (
    <div className="pointer-events-none absolute inset-0 z-[7]" data-safe-zone-overlay={platform}>
      <div className={`${shade} left-0 right-0 top-0`} style={{ height: pct(inset.top) }} />
      <div className={`${shade} bottom-0 left-0 right-0`} style={{ height: pct(inset.bottom) }} />
      <div
        className={`${shade} left-0`}
        style={{ top: pct(inset.top), bottom: pct(inset.bottom), width: pct(inset.left) }}
      />
      <div
        className={`${shade} right-0`}
        style={{ top: pct(inset.top), bottom: pct(inset.bottom), width: pct(inset.right) }}
      />
      <div
        className="absolute border border-dashed border-white/70"
        style={{
          top: pct(inset.top),
          bottom: pct(inset.bottom),
          left: pct(inset.left),
          right: pct(inset.right),
        }}
      />
      <div className="absolute left-1.5 top-1.5 rounded-sm bg-black/65 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
        {t('shorts.safeZone.overlayLabel', {
          platform: t(`shorts.safeZone.platforms.${platform}`),
        })}
      </div>
    </div>
  )
})
