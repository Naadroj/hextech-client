/**
 * Types du **recommandeur** (A4) : consomme un `GameAssessment` (A3) + le
 * catalogue statique et produit le prochain achat conseillé + alternatives +
 * justifications. Pur.
 */

export interface ScoreBreakdown {
  /** Gain fractionnaire de débit de dégâts (proxy A2). */
  offense: number
  /** Gain fractionnaire de PV effectifs contre le profil de menace. */
  defense: number
  /** Bonus situationnel (antisoin, QSS, stase, mana, axe de résistance…). */
  utility: number
  /** Rapport valeur-or des stats / prix, recentré autour de 0. */
  costEfficiency: number
  /** Pénalité de tempo (≤ 0) — coût d'opportunité du détour hors axe de dégâts. */
  tempo: number
  /**
   * Prior de build (≥ 0, A4.3) — bonus quand l'item appartient au squelette
   * hi-elo du champion + rôle. Absent si aucun livre de builds n'est fourni.
   */
  buildPrior?: number
  /**
   * Pénalité de timing (≤ 0) — « mauvais moment pour cet achat », ex. un
   * stat-stick de PV brut (Warmog, Heartsteel) en 1er/2e item hors squelette.
   */
  timing?: number
}

export type ItemKind = 'legendary' | 'component' | 'boots'

export interface ItemRecommendation {
  itemId: number
  name: string
  kind: ItemKind
  goldTotal: number
  /** L'or actuel couvre le prix total. */
  affordableNow: boolean
  /** Or manquant pour l'acheter maintenant (0 si abordable). */
  goldShort: number
  /** Score agrégé pondéré par le contexte. */
  score: number
  breakdown: ScoreBreakdown
  /** 1 à 3 phrases de justification, en français. */
  reasons: string[]
}

/** Une étape du chemin de build hi-elo (squelette), avec l'état de possession. */
export interface BuildPathStep {
  itemId: number
  name: string
  /** `true` si le joueur possède déjà cet item (légendaire fini). */
  owned: boolean
  /** Position d'achat typique (`avgSlot` du squelette). */
  slot: number
}

/** Métadonnées du squelette hi-elo utilisé (ou `null` si reco purement heuristique). */
export interface SkeletonInfo {
  games: number
  roleAgnostic: boolean
  /** `"16.16→16.17"` si complété avec le patch précédent. */
  patchSpan: string | null
  /** Objets de départ conseillés `{ itemId, name, pickRate }`. */
  starters: { itemId: number; name: string; pickRate: number }[]
}

export interface Recommendation {
  /** Meilleur item légendaire à acheter ensuite (`null` si aucun candidat). */
  primary: ItemRecommendation | null
  /** 2 alternatives suivantes. */
  alternatives: ItemRecommendation[]
  /** Meilleures bottes si le joueur n'en a pas encore (`null` sinon). */
  boots: ItemRecommendation | null
  /** Séquence de cœur de build hi-elo (ordonnée), items possédés marqués. `[]` si pas de squelette. */
  buildPath: BuildPathStep[]
  /** Infos sur le squelette utilisé, ou `null` si reco heuristique pure. */
  skeleton: SkeletonInfo | null
  context: {
    representativeTargetSlug: string | null
    threatSummary: string
    /** `carry` | `combattant` | `tank` | `utilitaire`. */
    weightProfile: string
  }
}
