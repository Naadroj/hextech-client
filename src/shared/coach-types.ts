import type { Recommendation } from './engine/recommend/types'

/**
 * Conseil d'itémisation poussé du process principal vers le renderer (vue
 * Coach, A5). Le moteur (A2→A4) tourne côté main ; seul ce résumé transite.
 */
export interface CoachAdvice {
  /** `idle` = pas de partie en cours ; `active` = conseil disponible. */
  status: 'idle' | 'active'
  /**
   * `stale` : la partie référence des champions absents du catalogue (patch
   * plus récent que le snapshot) — recommandations dégradées, pas d'erreur.
   */
  dataWarning: 'stale' | null
  /** Horodatage local (ms) du calcul. */
  computedAt: number
  gameTimeSeconds: number
  self: {
    slug: string
    role: string
    level: number
    currentGold: number
    /** `physical` | `magic` | `true` | `mixed`. */
    profilePrimary: string
    /** -1,5 … +2,5. */
    fed: number
    isManaConstrained: boolean
  } | null
  threat: {
    physical: number
    magic: number
    true: number
    burst: number
    primarySlug: string | null
    primaryFed: number
  } | null
  recommendation: Recommendation | null
}

export const IDLE_ADVICE: CoachAdvice = {
  status: 'idle',
  dataWarning: null,
  computedAt: 0,
  gameTimeSeconds: 0,
  self: null,
  threat: null,
  recommendation: null,
}
