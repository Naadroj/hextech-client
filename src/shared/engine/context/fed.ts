import type { LiveItem, LivePlayer, LiveScores } from '../../live-types'
import type { StaticData } from '../../staticdata-types'
import type { FedAssessment } from './types'
import { playerKey } from './live-adapter'

/**
 * « Fed-o-meter » : estime l'avance/le retard de chaque joueur, **auto-calibré**
 * sur la moyenne du lobby — pas de constante d'or par minute à maintenir.
 *
 * Signaux (on n'a pas l'or des autres joueurs) : valeur en or des items portés,
 * niveau, et un proxy KDA. Chacun comparé à la moyenne des 10.
 */

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))

/** Valeur en or cumulée des items portés (via le catalogue, repli sur `price`). */
export function itemGoldValue(items: LiveItem[], staticData: StaticData): number {
  return (items ?? []).reduce((sum, it) => {
    const known = staticData.getItem(it.itemID)?.goldTotal
    return sum + (known ?? it.price ?? 0)
  }, 0)
}

/** Proxy KDA borné : `(2·kills + assists) / max(1, deaths)`. */
export function kdaProxy(s: LiveScores): number {
  return (s.kills * 2 + s.assists) / Math.max(1, s.deaths)
}

export function assessFed(
  players: LivePlayer[],
  staticData: StaticData,
): Map<string, FedAssessment> {
  const rows = players.map((p) => ({
    key: playerKey(p),
    slug: p.championName,
    gold: itemGoldValue(p.items, staticData),
    level: p.level,
    kda: kdaProxy(p.scores),
  }))

  const n = rows.length || 1
  const mean = (sel: (r: (typeof rows)[number]) => number): number =>
    rows.reduce((a, r) => a + sel(r), 0) / n

  const avgGold = mean((r) => r.gold)
  const avgLevel = mean((r) => r.level)
  const avgKda = mean((r) => r.kda)
  const goldScale = Math.max(800, avgGold * 0.5)

  const out = new Map<string, FedAssessment>()
  for (const r of rows) {
    const score =
      0.5 * ((r.gold - avgGold) / goldScale) +
      0.3 * clamp((r.level - avgLevel) / 2, -1.5, 1.5) +
      0.2 * clamp((r.kda - avgKda) / 3, -1.5, 2)
    out.set(r.key, {
      key: r.key,
      slug: r.slug,
      score: clamp(score, -1.5, 2.5),
      itemGoldValue: r.gold,
      kdaProxy: r.kda,
    })
  }
  return out
}
