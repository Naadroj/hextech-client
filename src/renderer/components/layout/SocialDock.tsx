import { useState } from 'react'
import { SectionHeader } from '../hextech'

/**
 * Panneau d'amis docké à droite, façon client officiel. Contenu réel câblé en
 * Phase 8 (endpoints `/lol-chat`). Ici : structure + état replié/déplié.
 */
export function SocialDock() {
  const [collapsed, setCollapsed] = useState(false)

  if (collapsed) {
    return (
      <aside className="hx-social w-10" aria-label="Amis (replié)">
        <button
          type="button"
          className="hx-social__toggle"
          aria-label="Déplier le panneau des amis"
          onClick={() => setCollapsed(false)}
        >
          &#9664;
        </button>
        <span className="mt-4 self-center font-display text-[10px] uppercase tracking-hexwide text-gold-700 [writing-mode:vertical-rl]">
          Amis
        </span>
      </aside>
    )
  }

  return (
    <aside className="hx-social w-64" aria-label="Amis">
      <button
        type="button"
        className="hx-social__toggle"
        aria-label="Replier le panneau des amis"
        onClick={() => setCollapsed(true)}
      >
        &#9654;
      </button>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        <SectionHeader>Amis</SectionHeader>
        <p className="text-xs text-parchment">
          La liste d'amis et le chat arrivent en Phase 8. La structure est en place.
        </p>

        <div className="mt-4 space-y-4 opacity-60">
          {['En jeu', 'En ligne', 'Hors ligne'].map((group) => (
            <div key={group}>
              <div className="hx-social__group">{group}</div>
              <div className="hx-social__friend">
                <span className="dot bg-gold-800" />
                <span className="h-3 w-32 bg-gold-900/60" />
              </div>
              <div className="hx-social__friend">
                <span className="dot bg-gold-800" />
                <span className="h-3 w-24 bg-gold-900/60" />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-gold-800 px-3 py-2 font-display text-[10px] uppercase tracking-hexwide text-gold-700">
        Statut : hors ligne
      </div>
    </aside>
  )
}
