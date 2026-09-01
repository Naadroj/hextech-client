import { useEffect, useState } from 'react'
import { cn } from '../lib/cn'
import { getLcu } from '../lib/lcuBridge'

/** Cache module : les icônes d'items sont servies localement une fois. */
const cache = new Map<number, string | null>()
const pending = new Map<number, Promise<string | null>>()

function load(itemId: number): Promise<string | null> {
  const existing = pending.get(itemId)
  if (existing) return existing
  const p = (async () => {
    try {
      return await getLcu().getItemIcon(itemId)
    } catch {
      return null
    }
  })().then((url) => {
    cache.set(itemId, url)
    pending.delete(itemId)
    return url
  })
  pending.set(itemId, p)
  return p
}

export interface ItemIconProps {
  itemId: number
  size?: number
  className?: string
  title?: string
}

export function ItemIcon({ itemId, size = 40, className, title }: ItemIconProps) {
  const [url, setUrl] = useState<string | null>(() => cache.get(itemId) ?? null)

  useEffect(() => {
    if (itemId <= 0) {
      setUrl(null)
      return
    }
    if (cache.has(itemId)) {
      setUrl(cache.get(itemId) ?? null)
      return
    }
    let active = true
    void load(itemId).then((u) => {
      if (active) setUrl(u)
    })
    return () => {
      active = false
    }
  }, [itemId])

  return (
    <span
      className={cn('inline-grid shrink-0 place-items-center border border-gold-800 bg-hextech-black/60', className)}
      style={{ width: size, height: size }}
      title={title}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="h-2 w-2 rotate-45 bg-gold-800" />
      )}
    </span>
  )
}
