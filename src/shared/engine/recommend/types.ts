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

export interface Recommendation {
  /** Meilleur item légendaire à acheter ensuite (`null` si aucun candidat). */
  primary: ItemRecommendation | null
  /** 2 alternatives suivantes. */
  alternatives: ItemRecommendation[]
  /** Meilleures bottes si le joueur n'en a pas encore (`null` sinon). */
  boots: ItemRecommendation | null
  context: {
    representativeTargetSlug: string | null
    threatSummary: string
    /** `carry` | `combattant` | `tank` | `utilitaire`. */
    weightProfile: string
  }
}
