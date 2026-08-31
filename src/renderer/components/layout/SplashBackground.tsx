import { useEffect, useState } from 'react'
import { getLcu } from '../../lib/lcuBridge'

/**
 * Fond façon client officiel : splash art du champion le plus maîtrisé
 * (servi localement par la LCU), sinon la seule texture Magic-Tech.
 */
export function SplashBackground({ connected }: { connected: boolean }) {
  const [splashUrl, setSplashUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!connected) {
      setSplashUrl(null)
      return
    }
    let active = true
    try {
      getLcu()
        .getSplashBackground()
        .then((url) => {
          if (active) setSplashUrl(url)
        })
        .catch(() => {})
    } catch {
      /* preload indisponible */
    }
    return () => {
      active = false
    }
  }, [connected])

  return (
    <div className="hx-bg" aria-hidden="true">
      {splashUrl && (
        <div
          key={splashUrl}
          className="hx-bg__splash"
          style={{ backgroundImage: `url("${splashUrl}")` }}
        />
      )}
      <div className="hx-bg__scrim" />
      <div className="hx-bg__grid" />
      <div className="hx-bg__glow" />
    </div>
  )
}
