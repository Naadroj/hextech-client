import type { BuildAxis } from '@shared/build-types'

/**
 * Segmenté « Auto · AD · AP » pour les champions jouables sur les deux axes
 * (Shaco, Kayle, Gragas…). N'a de sens que si le livre de builds contient deux
 * variantes pour le couple champion + rôle — sinon `axisSwitchAvailable` est
 * faux et l'appelant ne rend rien.
 *
 * « Auto » ne veut pas dire « rien » : c'est la déduction par l'inventaire déjà
 * acheté. Forcer un axe ne fait que retirer l'axe opposé du slot principal ; les
 * items neutres (armure, antisoin, QSS) restent proposables.
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

/** Pastille « AD »/« AP » du mode réduit ; rien tant qu'on est en auto. */
export function AxisBadge({ axis }: { axis: BuildAxis | null }) {
  if (!axis) return null
  return (
    <span
      aria-label={axis === 'physical' ? 'Axe forcé AD' : 'Axe forcé AP'}
      className="rounded-sm border border-gold-800/70 px-1 font-display text-[9px] uppercase leading-tight tracking-hexwide text-gold-100"
    >
      {axis === 'physical' ? 'AD' : 'AP'}
    </span>
  )
}
