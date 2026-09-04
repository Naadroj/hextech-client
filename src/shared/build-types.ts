/**
 * Types du **squelette de build** (phase A4.3) : par champion + rôle, les items
 * que les joueurs hi-elo achètent réellement, avec leur taux de pick et leur
 * position d'achat moyenne. Dérivé empiriquement des parties moissonnées
 * (`scripts/build-skeletons.ts` → `resources/builds.json`), **séparé** du
 * catalogue Riot (`snapshot.json`).
 *
 * Le moteur (A4) s'en sert comme *prior* : les items du `core` reçoivent un
 * bonus de score pondéré par `pickRate` et par l'écart entre `avgSlot` et le
 * nombre de légendaires déjà finis. L'heuristique situationnelle (menace, tempo,
 * antisoin…) reste la couche de départage / override.
 *
 * Aucune logique lourde ici — seulement des formes de données + l'indexation.
 */

/** Rôles normalisés (mêmes valeurs que `InferredRole` côté contexte). */
export type BuildRole = 'TOP' | 'JUNGLE' | 'MID' | 'BOT' | 'SUPPORT'

/** `teamPosition` Riot ou `InferredRole` → `BuildRole` (`null` si inconnu). */
export function normalizeBuildRole(raw: string | undefined | null): BuildRole | null {
  switch ((raw ?? '').toUpperCase()) {
    case 'TOP':
      return 'TOP'
    case 'JUNGLE':
      return 'JUNGLE'
    case 'MID':
    case 'MIDDLE':
      return 'MID'
    case 'BOT':
    case 'BOTTOM':
    case 'ADC':
      return 'BOT'
    case 'SUPPORT':
    case 'UTILITY':
      return 'SUPPORT'
    default:
      return null
  }
}

export interface BuildItem {
  id: number
  /** Fraction des parties de ce champion+rôle où l'item a été acheté (0..1). */
  pickRate: number
  /**
   * Position d'achat moyenne parmi les légendaires (1 = tout premier légendaire).
   * `0` pour les bottes (hors séquence de légendaires).
   */
  avgSlot: number
}

/** Axe de dégâts d'une variante de build (champions jouables AD **ou** AP). */
export type BuildAxis = 'physical' | 'magic'

export interface RoleBuild {
  role: BuildRole
  /**
   * Variante d'axe. Absent = entrée **combinée** (tous les échantillons du
   * couple), utilisée en mode « auto ». Présent = build des seuls joueurs qui
   * sont allés de ce côté — n'existe que pour les champions réellement
   * bimodaux (Shaco AD vs AP), pas pour les hybrides mono-chemin (Kaïsa).
   */
  axis?: BuildAxis
  /** Nombre d'échantillons (joueur × partie) agrégés. */
  games: number
  /**
   * `true` = entrée **poolée** (champion trop peu vu, échantillons de rôle
   * regroupés). Sert de repli quand l'entrée `slug|role` exacte manque — mais
   * **uniquement pour un rôle listé dans `pooledRoles`** : jamais de build d'un
   * rôle vers un autre (ex. build jungle proposé à un joueur top).
   */
  roleAgnostic?: boolean
  /** Rôles réellement observés dans le pool (restreint le repli `getBuild`). */
  pooledRoles?: BuildRole[]
  /**
   * Renseigné quand le couple était trop peu vu sur le patch courant et a été
   * complété avec le patch précédent (ex. `"16.16→16.17"`). Absent = patch pur.
   */
  patchSpan?: string
  /** Objets de départ les plus fréquents (achetés < 80 s), `pickRate` décroissant. */
  starters?: BuildItem[]
  /** Bottes les plus fréquentes, `pickRate` décroissant. */
  boots: BuildItem[]
  /** Légendaires du squelette (`pickRate` ≥ seuil core), `pickRate` décroissant. */
  core: BuildItem[]
  /** Légendaires vus mais sous le seuil core (options situationnelles). */
  situational: BuildItem[]
}

export interface ChampionBuild {
  slug: string
  roles: RoleBuild[]
}

/** Contenu de `resources/builds.json`. */
export interface BuildBookFile {
  /** Patch des parties agrégées (doit correspondre au snapshot pour les ids d'items). */
  patch: string
  generatedAt: string
  /** Nombre total de parties distinctes lues. */
  sampleGames: number
  /** Seuils utilisés à la génération (documentation). */
  params: { minGames: number; coreMinPickRate: number; situationalMinPickRate: number }
  builds: ChampionBuild[]
}

/** Accès indexé, en lecture seule, à un `BuildBookFile`. */
export interface BuildBook {
  readonly patch: string
  readonly sampleGames: number
  /** Nombre de couples champion+rôle couverts. */
  readonly entryCount: number
  /**
   * `slug` insensible à la casse/ponctuation ; `role` Riot ou InferredRole.
   * `axis` sélectionne une variante si elle existe, sinon l'entrée combinée.
   */
  getBuild(slug: string, role: string, axis?: BuildAxis): RoleBuild | undefined
  /** `true` si le couple a deux variantes d'axe (→ proposer le switch AD/AP). */
  hasAxisVariants(slug: string, role: string): boolean
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Livre de builds vide — comportement moteur = pré-A4.3 (aucun prior). */
export const EMPTY_BUILD_BOOK: BuildBook = {
  patch: '',
  sampleGames: 0,
  entryCount: 0,
  getBuild: () => undefined,
  hasAxisVariants: () => false,
}

export function indexBuildBook(file: BuildBookFile): BuildBook {
  /** Entrées combinées (sans `axis`). */
  const byKey = new Map<string, RoleBuild>()
  /** Variantes d'axe : `slug|ROLE|axis`. */
  const byAxis = new Map<string, RoleBuild>()
  /** slug → entrée poolée (repli quand le rôle exact manque). */
  const pooled = new Map<string, RoleBuild>()
  for (const champ of file.builds ?? []) {
    for (const rb of champ.roles ?? []) {
      const base = `${norm(champ.slug)}|${rb.role}`
      if (rb.axis) byAxis.set(`${base}|${rb.axis}`, rb)
      else byKey.set(base, rb)
      if (rb.roleAgnostic) pooled.set(norm(champ.slug), rb)
    }
  }
  const variantsFor = (s: string, r: BuildRole): number =>
    (byAxis.has(`${s}|${r}|physical`) ? 1 : 0) + (byAxis.has(`${s}|${r}|magic`) ? 1 : 0)

  return {
    patch: file.patch,
    sampleGames: file.sampleGames,
    entryCount: byKey.size,
    hasAxisVariants: (slug, role) => {
      const r = normalizeBuildRole(role)
      return !!r && variantsFor(norm(slug), r) === 2
    },
    getBuild: (slug, role, axis) => {
      const s = norm(slug)
      const r = normalizeBuildRole(role)
      if (!r) return undefined
      // Variante d'axe demandée et disponible → elle prime.
      if (axis) {
        const variant = byAxis.get(`${s}|${r}|${axis}`)
        if (variant) return variant
      }
      const exact = byKey.get(`${s}|${r}`)
      if (exact) return exact
      const p = pooled.get(s)
      if (!p) return undefined
      // Repli poolé : seulement si le rôle demandé fait partie des rôles observés
      // (ou `pooledRoles` absent = ancien format → tolérant).
      return !p.pooledRoles || p.pooledRoles.includes(r) ? p : undefined
    },
  }
}
