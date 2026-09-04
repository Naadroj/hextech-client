import type { BuildAxis } from '@shared/build-types'

/**
 * Segmenté « Auto · AD · AP » : dit au coach sur quel type de stuff on part.
 *
 * Toujours disponible en partie, même si le livre de builds n'a pas deux
 * variantes pour ce champion — c'est une **orientation**, pas une consultation
 * de statistiques : forcer un axe retire l'axe opposé du slot principal et rien
 * d'autre. Les items neutres (armure, résistance magique, antisoin, QSS, stase)
 * n'appartiennent à aucun axe et restent proposés, donc on peut toujours partir
 * tanky si la partie le demande.
 *
 * Pas de bouton « Hybride » : « Auto » l'est déjà. Il ne veut pas dire « aucun
 * axe » mais « déduis-le de ce que j'ai acheté » — sur un inventaire mixte il
 * laisse justement les deux côtés en lice.
 */

const OPTIONS: { value: BuildAxis | null; label: string; title: string }[] = [
  { value: null, label: 'Auto', title: 'Axe déduit des items déjà achetés' },
  { value: 'physical', label: 'AD', title: 'Forcer le build AD' },
  { value: 'magic', label: 'AP', title: 'Forcer le build AP' },
]

export function AxisSwitch({
  value,
  onChange,
  dense = false,
}: {
  value: BuildAxis | null
  onChange: (axis: BuildAxis | null) => void
  /** Variante réduite pour l'overlay in-game. */
  dense?: boolean
}) {
  const pad = dense ? 'px-1.5 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
  return (
    <div
      role="group"
      aria-label="Axe de dégâts"
      className="inline-flex divide-x divide-gold-800/70 overflow-hidden rounded border border-gold-800/70"
    >
      {OPTIONS.map((o) => {
        const on = value === o.value
        return (
          <button
            key={o.label}
            type="button"
            aria-pressed={on}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={`${pad} font-display uppercase tracking-hexwide transition-colors ${
              on ? 'bg-gold-800/60 text-gold-100' : 'text-gold-700 hover:text-gold-100'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Ordre du cycle du bouton compact. */
const CYCLE: (BuildAxis | null)[] = [null, 'physical', 'magic']

const SHORT: Record<string, string> = { auto: 'AUTO', physical: 'AD', magic: 'AP' }

/**
 * Bouton unique du mode réduit : un clic passe à l'axe suivant (Auto → AD →
 * AP → Auto). Le segmenté complet ne tient pas dans une carte de 130 px.
 */
export function AxisCycleButton({
  value,
  onChange,
}: {
  value: BuildAxis | null
  onChange: (axis: BuildAxis | null) => void
}) {
  const label = SHORT[value ?? 'auto']
  const next = CYCLE[(CYCLE.indexOf(value) + 1) % CYCLE.length]
  return (
    <button
      type="button"
      aria-label={`Axe de dégâts : ${label}`}
      title={`Axe de dégâts : ${label} — cliquer pour passer à ${SHORT[next ?? 'auto']}`}
      onClick={() => onChange(next)}
      className={`rounded-sm border px-1 py-0.5 font-display text-[9px] uppercase leading-tight tracking-hexwide ${
        value
          ? 'border-gold-800 bg-gold-800/60 text-gold-100'
          : 'border-gold-800/60 text-gold-700 hover:text-gold-100'
      }`}
    >
      {label}
    </button>
  )
}
