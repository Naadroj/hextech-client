import { useEffect, useState } from 'react'
import type { FeedbackReport } from '@shared/feedback-types'
import { FEEDBACK_COMMENT_MAX, FEEDBACK_REASON_LABELS } from '@shared/feedback-types'
import { Button, Frame, Tag } from '../components/hextech'
import { ItemIcon } from '../components/ItemIcon'
import { useFeedback } from '../lib/useFeedback'
import { useFeedbackQueue } from '../lib/useFeedbackQueue'
import { useStaticData } from '../lib/useStaticData'

/**
 * Relecture des signalements avant envoi.
 *
 * Le clic en jeu ne capture qu'un motif — c'est tout ce qu'on peut demander en
 * pleine partie. Le vrai contenu s'écrit ici, à froid : ce qu'on aurait acheté
 * et pourquoi. Et **rien ne part sans un clic sur « Envoyer »**.
 */

function when(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function ReportCard({
  report,
  version,
  onAnnotate,
  onDiscard,
}: {
  report: FeedbackReport
  version: string | null
  onAnnotate: (id: string, comment: string) => Promise<void>
  onDiscard: (id: string) => Promise<void>
}) {
  const [draft, setDraft] = useState(report.comment ?? '')
  const [saved, setSaved] = useState(false)
  // Le rapport peut être rechargé depuis le disque (envoi, autre onglet) :
  // on resynchronise tant que l'utilisateur n'a rien tapé de différent.
  useEffect(() => setDraft(report.comment ?? ''), [report.id, report.comment])

  const dirty = draft.trim() !== (report.comment ?? '')

  return (
    <div className="space-y-2 border border-gold-800/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        {report.itemId !== null && (
          <ItemIcon itemId={report.itemId} version={version} size={28} title={String(report.itemId)} />
        )}
        <span className="text-gold-100">{report.champion}</span>
        <Tag>{report.role}</Tag>
        <Tag tone="cyan">{FEEDBACK_REASON_LABELS[report.reasonCode]}</Tag>
        <span className="text-xs text-parchment">
          niv {report.level} · {report.completedItems} item(s)
        </span>
        <span className="ml-auto text-xs text-parchment">{when(report.createdAt)}</span>
      </div>

      <label className="block">
        <span className="sr-only">Précisions</span>
        <textarea
          value={draft}
          maxLength={FEEDBACK_COMMENT_MAX}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          rows={2}
          placeholder="Ce que tu aurais acheté à la place, et pourquoi…"
          className="w-full resize-y border border-gold-800/60 bg-hextech-black/60 p-2 text-sm text-gold-100 placeholder:text-parchment/60 focus:border-gold-700 focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          disabled={!dirty}
          onClick={async () => {
            await onAnnotate(report.id, draft)
            setSaved(true)
          }}
        >
          Enregistrer les précisions
        </Button>
        {saved && !dirty && <span className="text-xs text-ok">Enregistré</span>}
        <button
          type="button"
          onClick={() => void onDiscard(report.id)}
          className="ml-auto text-xs text-parchment hover:text-warn"
        >
          Jeter
        </button>
      </div>
    </div>
  )
}

export function Reports() {
  const version = useStaticData().summary?.version ?? null
  const { state } = useFeedback()
  const { reports, loading, pushing, result, annotate, discard, push } = useFeedbackQueue(
    state.pending,
  )

  const blocked = !state.enabled
    ? 'Les signalements sont désactivés dans les Réglages.'
    : !state.configured
      ? "Ce build n'embarque pas d'identifiants de base : l'envoi est inerte, les rapports restent en file."
      : null

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Frame title="Signalements en attente">
        <p className="text-parchment">
          Le bouton bug de l'overlay enregistre un motif, rien de plus — en pleine partie c'est tout
          ce qu'on peut demander. Complète-les ici, puis envoie quand tu veux. Rien ne part tout
          seul.
        </p>

        {blocked && (
          <div className="mt-3 border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
            {blocked}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button onClick={() => void push()} disabled={pushing || reports.length === 0 || !!blocked}>
            {pushing ? 'Envoi…' : `Envoyer ${reports.length || ''} en base`.trim()}
          </Button>
          {state.lastSentAt && (
            <span className="text-xs text-parchment">Dernier envoi : {when(state.lastSentAt)}</span>
          )}
          {result && (
            <span className={`text-xs ${result.error ? 'text-warn' : 'text-ok'}`}>
              {result.error === 'not-configured'
                ? "Envoi non configuré dans ce build."
                : result.error === 'disabled'
                  ? 'Signalements désactivés.'
                  : result.error === 'network'
                    ? `${result.sent} envoyé(s), ${result.remaining} conservé(s) — réessaie plus tard.`
                    : `${result.sent} signalement(s) envoyé(s).`}
            </span>
          )}
        </div>
      </Frame>

      {loading ? (
        <Frame>
          <p className="text-parchment">Lecture de la file…</p>
        </Frame>
      ) : reports.length === 0 ? (
        <Frame>
          <p className="text-parchment">
            Aucun signalement en attente. Clique sur l'icône bug de l'overlay quand un item proposé
            te paraît incohérent.
          </p>
        </Frame>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              version={version}
              onAnnotate={annotate}
              onDiscard={discard}
            />
          ))}
        </div>
      )}
    </div>
  )
}
