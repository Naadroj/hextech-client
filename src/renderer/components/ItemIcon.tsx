import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { getLcu } from '../lib/lcuBridge'

/**
 * Icône d'item. Source par défaut : le CDN Data Dragon (`version` fournie par
 * le résumé du catalogue) — fonctionne sans le client League. Repli sur l'asset
 * local de la LCU si le CDN échoue, puis losange par défaut.
 */

const ddragonUrl = (version: string, itemId: number): string =>
  `https://ddragon.leagueoflegends.com/cdn/${version}/img/item/${itemId}.png`

/** Cache module des URLs LCU (résolues une fois). */
const lcuCache = new Map<number, string | null>()
const lcuPending = new Map<number, Promise<string | null>>()

function loadLcu(itemId: number): Promise<string | null> {
  const existing = lcuPending.get(itemId)
  if (existing) return existing
  const p = (async () => {
    try {
      return await getLcu().getItemIcon(itemId)
    } catch {
      return null
    }
  })().then((url) => {
    lcuCache.set(itemId, url)
    lcuPending.delete(itemId)
    return url
  })
  lcuPending.set(itemId, p)
  return p
}

export interface ItemIconProps {
  itemId: number
  /** Version de patch Data Dragon (ex. `16.17.1`) pour l'URL CDN. */
  version?: string | null
  size?: number
  className?: string
  title?: string
}

export function ItemIcon({ itemId, version, size = 40, className, title }: ItemIconProps) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    if (itemId <= 0) {
      setSrc(null)
      return
    }
    // 1) CDN Data Dragon si on connaît la version.
    if (version) {
      setSrc(ddragonUrl(version, itemId))
      return
    }
    // 2) Repli LCU (client ouvert, hors ligne).
    let active = true
    setSrc(lcuCache.get(itemId) ?? null)
    if (!lcuCache.has(itemId)) {
      void loadLcu(itemId).then((u) => {
        if (active) setSrc(u)
      })
    }
    return () => {
      active = false
    }
  }, [itemId, version])

  const onError = (): void => {
    // CDN KO → tenter la LCU, sinon losange.
    if (lcuCache.get(itemId)) {
      setSrc(lcuCache.get(itemId) ?? null)
      return
    }
    void loadLcu(itemId).then((u) => setSrc(u))
  }

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center border border-gold-800 bg-hextech-black/60',
        className,
      )}
      style={{ width: size, height: size }}
      title={title}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" onError={onError} />
      ) : (
        <span className="h-2 w-2 rotate-45 bg-gold-800" />
      )}
    </span>
  )
}
