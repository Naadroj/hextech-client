import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { getLcu } from '../lib/lcuBridge'

/** Cache module : les icônes de champions sont servies localement une fois. */
const cache = new Map<number, string | null>()
const pending = new Map<number, Promise<string | null>>()

function load(championId: number): Promise<string | null> {
  const existing = pending.get(championId)
  if (existing) return existing
  const p = (async () => {
    try {
      return await getLcu().getChampionIcon(championId)
    } catch {
      return null
    }
  })().then((url) => {
    cache.set(championId, url)
    pending.delete(championId)
    return url
  })
  pending.set(championId, p)
  return p
}

export interface ChampionIconProps {
  championId: number
  size?: number
  className?: string
  title?: string
}

export function ChampionIcon({ championId, size = 40, className, title }: ChampionIconProps) {
  const [url, setUrl] = useState<string | null>(() => cache.get(championId) ?? null)

  useEffect(() => {
    if (championId <= 0) {
      setUrl(null)
      return
    }
    if (cache.has(championId)) {
      setUrl(cache.get(championId) ?? null)
      return
    }
    let active = true
    void load(championId).then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [championId])

  return (
    <span
      className={cn('hx-champ-icon', className)}
      style={{ width: size, height: size }}
      title={title}
    >
      {url ? <img src={url} alt="" /> : <span className="hx-champ-icon__fallback" />}
    </span>
  )
}
