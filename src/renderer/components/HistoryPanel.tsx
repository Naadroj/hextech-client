import { useState } from 'react'
import type { HistoryStep } from '@shared/history-types'
import { Frame, Tag } from './hextech'
import { ItemIcon } from './ItemIcon'
import { useHistoryGame, useHistoryList } from '../lib/useHistory'

/**
 * Historique local des propositions. Sert à relire une partie après coup :
 * « à quel moment il m'a dit d'acheter ça, et pourquoi ». Rien ne quitte la
 * machine — c'est de la lecture de fichiers dans `userData/history`.
 */

function clock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function day(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function StepRow({ step, version }: { step: HistoryStep; version: string | null }) {
  return (
    <li className="flex items-start gap-3 py-1.5">
      <span className="w-12 shrink-0 pt-0.5 text-right font-display text-[11px] text-gold-700">
        {clock(step.t)}
      </span>
      {step.primary ? (
        <ItemIcon itemId={step.primary.itemId} version={version} size={28} title={step.primary.name} />
      ) : (
        <span className="h-[28px] w-[28px] shrink-0 border border-gold-800 bg-hextech-black/60" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm text-gold-100">{step.primary?.name ?? 'Aucune reco'}</span>
          <span className="text-[11px] text-parchment">
            niv {step.level} · {step.gold} or
          </span>
          {step.axis && <Tag>{step.axis === 'physical' ? 'AD forcé' : 'AP forcé'}</Tag>}
        </div>
        {step.primary?.reason && (
          <p className="text-[11px] leading-snug text-gold-100/70">• {step.primary.reason}</p>
        )}
      </div>
    </li>
  )
}

export function HistoryPanel({
  version,
  reloadKey,
}: {
  version: string | null
  /** Change à chaque nouveau conseil pour que la partie en cours apparaisse. */
  reloadKey?: unknown
}) {
  const { games } = useHistoryList(reloadKey)
  const [openId, setOpenId] = useState<string | null>(null)
  const game = useHistoryGame(openId)

  return (
    <Frame title="Historique des propositions">
      {games.length === 0 ? (
        <p className="text-parchment">
          Rien pour l'instant. Chaque partie jouée avec le coach actif laisse ici le fil de ses
          propositions — les 20 dernières sont conservées, en local uniquement.
        </p>
      ) : (
        <ul className="divide-y divide-gold-800/40">
          {games.map((g) => {
            const open = openId === g.id
            return (
              <li key={g.id}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setOpenId(open ? null : g.id)}
                  className="flex w-full items-center gap-3 py-2 text-left hover:bg-gold-800/10"
                >
                  <span className="text-gold-700">{open ? '▾' : '▸'}</span>
                  {g.lastItem && (
                    <ItemIcon itemId={g.lastItem.itemId} version={version} size={24} title={g.lastItem.name} />
                  )}
                  <span className="text-gold-100">{g.champion}</span>
                  <Tag>{g.role}</Tag>
                  <span className="text-xs text-parchment">
                    {g.steps} proposition{g.steps > 1 ? 's' : ''}
                  </span>
                  <span className="ml-auto text-xs text-parchment">{day(g.startedAt)}</span>
                </button>
                {open && (
                  <ul className="border-l border-gold-800/40 pb-3 pl-2">
                    {game?.steps.length ? (
                      game.steps.map((s, i) => <StepRow key={i} step={s} version={version} />)
                    ) : (
                      <li className="py-2 text-sm text-parchment">Aucune étape enregistrée.</li>
                    )}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Frame>
  )
}
