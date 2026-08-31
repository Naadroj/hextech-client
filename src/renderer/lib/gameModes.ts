import type { GameQueue } from '@shared/lcu-types'

/**
 * Regroupe les files LCU en catégories imbriquées pour le sélecteur de mode
 * (menu à deux niveaux : catégorie → file). Purement dérivé de la liste
 * `/lol-game-queues/v1/queues`, enrichi d'un libellé et d'un ordre curés.
 */

export type ModeItemKind = 'queue' | 'practice' | 'custom'

export interface ModeItem {
  key: string
  label: string
  subtitle: string
  isRanked: boolean
  available: boolean
  unavailableReason?: string
  kind: ModeItemKind
  queueId?: number
}

export interface ModeCategory {
  id: string
  label: string
  items: ModeItem[]
}

/** Libellé + priorité d'affichage pour les files connues. */
const QUEUE_META: Record<number, { label: string; subtitle: string; priority: number }> = {
  400: { label: 'Draft normale', subtitle: "Faille de l'invocateur · sélection alternée", priority: 1 },
  420: { label: 'Classé Solo/Duo', subtitle: "Faille de l'invocateur · classé", priority: 0 },
  430: { label: 'Partie normale', subtitle: "Faille de l'invocateur · sélection à l'aveugle", priority: 3 },
  440: { label: 'Classé Flexible', subtitle: 'File classée à 5', priority: 2 },
  450: { label: 'ARAM', subtitle: 'Abîme hurlant · champions aléatoires', priority: 0 },
  480: { label: 'Swiftplay', subtitle: "Faille de l'invocateur · format rapide", priority: 4 },
  490: { label: 'Partie rapide', subtitle: "Faille de l'invocateur · Quickplay", priority: 5 },
  830: { label: 'Coop vs IA — Intro', subtitle: 'Bots · très facile', priority: 0 },
  840: { label: 'Coop vs IA — Débutant', subtitle: 'Bots · facile', priority: 1 },
  850: { label: 'Coop vs IA — Intermédiaire', subtitle: 'Bots · moyen', priority: 2 },
  870: { label: 'Coop vs IA — Intro', subtitle: 'Bots · très facile', priority: 0 },
  880: { label: 'Coop vs IA — Débutant', subtitle: 'Bots · facile', priority: 1 },
  890: { label: 'Coop vs IA — Intermédiaire', subtitle: 'Bots · moyen', priority: 2 },
  900: { label: 'ARURF', subtitle: 'Ultra Rapid Fire aléatoire', priority: 1 },
  1020: { label: 'Un pour tous', subtitle: 'Cinq exemplaires du même champion', priority: 2 },
  1300: { label: 'Nexus Blitz', subtitle: 'Carte courte et événements', priority: 3 },
  1700: { label: 'Arène', subtitle: '2v2v2v2 · anneaux de la colère', priority: 0 },
  1710: { label: 'Arène', subtitle: '2v2v2v2 · anneaux de la colère', priority: 0 },
  1900: { label: 'URF', subtitle: 'Ultra Rapid Fire', priority: 0 },
}

const UNAVAILABLE_REASON: Record<string, string> = {
  PlatformDisabled: 'Indisponible actuellement',
  DoesntMeetRequirements: 'Niveau insuffisant',
  NotAvailableOnPlatform: 'Indisponible sur ce serveur',
}

function toItem(q: GameQueue): ModeItem {
  const meta = QUEUE_META[q.id]
  const available = q.queueAvailability === 'Available'
  return {
    key: `queue:${q.id}`,
    label: meta?.label ?? q.name,
    subtitle: meta?.subtitle ?? (q.description || q.shortName),
    isRanked: q.isRanked,
    available,
    unavailableReason: available
      ? undefined
      : (UNAVAILABLE_REASON[q.queueAvailability] ?? 'Indisponible'),
    kind: 'queue',
    queueId: q.id,
  }
}

function priority(q: GameQueue): number {
  return QUEUE_META[q.id]?.priority ?? 50
}

interface CategoryDef {
  id: string
  label: string
  match: (q: GameQueue) => boolean
}

const CATEGORY_DEFS: CategoryDef[] = [
  {
    id: 'rift',
    label: "Faille de l'invocateur",
    match: (q) => q.category === 'PvP' && q.mapId === 11 && q.gameMode === 'CLASSIC',
  },
  {
    id: 'aram',
    label: 'ARAM',
    match: (q) => q.category === 'PvP' && (q.mapId === 12 || q.gameMode === 'ARAM'),
  },
  {
    id: 'rotating',
    label: 'Modes en rotation',
    match: (q) =>
      q.category === 'PvP' &&
      q.gameMode !== 'CLASSIC' &&
      q.gameMode !== 'ARAM' &&
      q.gameMode !== 'CHERRY' &&
      q.mapId !== 30,
  },
  {
    id: 'arena',
    label: 'Arène',
    match: (q) => q.gameMode === 'CHERRY' || q.mapId === 30,
  },
  {
    id: 'coop',
    label: "Coopération contre l'IA",
    match: (q) => q.category === 'VersusAi',
  },
]

/** Construit les catégories imbriquées à partir des files live. */
export function groupQueues(queues: GameQueue[]): ModeCategory[] {
  const categories: ModeCategory[] = []

  for (const def of CATEGORY_DEFS) {
    const items = queues
      .filter(def.match)
      .sort((a, b) => priority(a) - priority(b) || a.name.localeCompare(b.name))
      .map(toItem)
    if (items.length > 0) categories.push({ id: def.id, label: def.label, items })
  }

  categories.push({
    id: 'custom',
    label: 'Personnalisée',
    items: [
      {
        key: 'practice',
        label: "Outil d'entraînement",
        subtitle: 'Practice Tool · seul avec les bots',
        isRanked: false,
        available: true,
        kind: 'practice',
      },
      {
        key: 'custom',
        label: 'Partie personnalisée',
        subtitle: "Faille de l'invocateur · 5v5 privé",
        isRanked: false,
        available: true,
        kind: 'custom',
      },
    ],
  })

  return categories
}
