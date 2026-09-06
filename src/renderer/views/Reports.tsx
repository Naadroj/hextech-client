import { useEffect, useMemo, useState } from 'react'
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
 *
 * On envoie ce qu'on veut, quand on veut : un rapport isolé, une sélection, ou
 * tout. Une fois parti, un rapport reste listé mais devient **verrouillé** — la
 * ligne est en base, le modifier ici ne la changerait pas là-bas.
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
  selected,
  onToggle,
  onAnnotate,
  onDiscard,
  onSend,
  busy,
}: {
  report: FeedbackReport
  version: string | null
  selected: boolean
  onToggle: (id: string) => void
  onAnnotate: (id: string, comment: string) => Promise<void>
  onDiscard: (id: string) => Promise<void>
  onSend: (id: string) => Promise<void>
  busy: boolean
}) {
  const sent = !!report.sentAt
  const [draft, setDraft] = useState(report.comment ?? '')
  const [saved, setSaved] = useState(false)
  // Le rapport peut être rechargé depuis le disque (envoi, autre onglet) :
  // on resynchronise tant que l'utilisateur n'a rien tapé de différent.
  useEffect(() => setDraft(report.comment ?? ''), [report.id, report.comment])

  const dirty = draft.trim() !== (report.comment ?? '')

  return (
    <div
      className={`space-y-2 border p-3 ${
        sent ? 'border-gold-800/25 bg-hextech-black/20' : 'border-gold-800/50'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!sent && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggle(report.id)}
            aria-label={`Sélectionner le signalement ${report.champion}`}
            className="size-4 accent-gold-700"
          />
        )}
        {report.itemId !== null && (
          <ItemIcon itemId={report.itemId} version={version} size={28} title={String(report.itemId)} />
        )}
        <span className={sent ? 'text-parchment' : 'text-gold-100'}>{report.champion}</span>
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
          readOnly={sent}
          disabled={sent}
          onChange={(e) => {
            setDraft(e.target.value)
            setSaved(false)
          }}
          rows={2}
          placeholder={
            sent ? 'Aucune précision' : "Ce que tu aurais acheté à la place, et pourquoi…"
          }
          className={`w-full resize-y border p-2 text-sm placeholder:text-parchment/60 focus:outline-none ${
            sent
              ? 'cursor-not-allowed border-gold-800/30 bg-hextech-black/30 text-parchment'
              : 'border-gold-800/60 bg-hextech-black/60 text-gold-100 focus:border-gold-700'
          }`}
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        {sent ? (
          <span className="text-xs text-ok">Envoyé le {when(report.sentAt as string)} · verrouillé</span>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty}
              onClick={async () => {
                await onAnnotate(report.id, draft)
                setSaved(true)
              }}
            >
              Enregistrer les précisions
            </Button>
            {saved && !dirty && <span className="text-xs text-ok">Enregistré</span>}
            <Button
              variant="gold"
              size="sm"
              disabled={busy}
              // Les précisions non enregistrées ne partiraient pas : on les
              // enregistre d'abord plutôt que de les perdre silencieusement.
              onClick={async () => {
                if (dirty) await onAnnotate(report.id, draft)
                await onSend(report.id)
              }}
            >
              Envoyer celui-ci
            </Button>
          </>
        )}
        <button
          type="button"
          onClick={() => void onDiscard(report.id)}
          className="ml-auto text-xs text-parchment hover:text-warn"
          title={sent ? 'Retire de cette liste — la ligne reste en base' : undefined}
        >
          {sent ? 'Retirer de la liste' : 'Jeter'}
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
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const waiting = useMemo(() => reports.filter((r) => !r.sentAt), [reports])
  const done = useMemo(() => reports.filter((r) => r.sentAt), [reports])

  // Une sélection ne doit pas survivre aux rapports qu'elle désigne : après un
  // envoi ou un rejet, les ids disparus sont oubliés.
  useEffect(() => {
    setSelected((prev) => {
      const alive = new Set(waiting.map((r) => r.id))
      const next = new Set([...prev].filter((id) => alive.has(id)))
      return next.size === prev.size ? prev : next
    })
  }, [waiting])

  const toggle = (id: string): void =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const blocked = !state.enabled
    ? 'Les signalements sont désactivés dans les Réglages.'
    : !state.configured
      ? "Ce build n'embarque pas d'identifiants de base : l'envoi est inerte, les rapports restent en file."
      : null

  const canSend = !pushing && !blocked
  const allSelected = waiting.length > 0 && selected.size === waiting.length

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Frame title="Signalements">
        <p className="text-parchment">
          Le bouton bug de l'overlay enregistre un motif, rien de plus — en pleine partie c'est tout
          ce qu'on peut demander. Complète-les ici, puis envoie ceux que tu veux. Rien ne part tout
          seul, et un rapport envoyé n'est plus modifiable.
        </p>

        {blocked && (
          <div className="mt-3 border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
            {blocked}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => void push([...selected])}
            disabled={!canSend || selected.size === 0}
          >
            {pushing ? 'Envoi…' : `Envoyer la sélection (${selected.size})`}
          </Button>
          <Button
            variant="ghost"
            onClick={() => void push()}
            disabled={!canSend || waiting.length === 0}
          >
            Tout envoyer ({waiting.length})
          </Button>
          {waiting.length > 0 && (
            <button
              type="button"
              onClick={() => setSelected(allSelected ? new Set() : new Set(waiting.map((r) => r.id)))}
              className="text-xs text-parchment underline-offset-2 hover:text-gold-100 hover:underline"
            >
              {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
            </button>
          )}
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
                    ? `${result.sent} envoyé(s), ${result.remaining} en attente.`
                    : `${result.sent} signalement(s) envoyé(s).`}
            </span>
          )}
        </div>

        {/* Le message brut de la base : c'est lui qui désigne le vrai coupable. */}
        {result?.detail && (
          <div className="mt-3 border border-warn/50 bg-warn/10 px-3 py-2">
            <div className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
              Réponse de la base
            </div>
            <p className="mt-1 break-words font-mono text-xs text-warn">{result.detail}</p>
          </div>
        )}
      </Frame>

      {loading ? (
        <Frame>
          <p className="text-parchment">Lecture de la file…</p>
        </Frame>
      ) : reports.length === 0 ? (
        <Frame>
          <p className="text-parchment">
            Aucun signalement. Clique sur l'icône bug de l'overlay quand un item proposé te paraît
            incohérent.
          </p>
        </Frame>
      ) : (
        <>
          {waiting.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                En attente ({waiting.length})
              </h2>
              {waiting.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  version={version}
                  selected={selected.has(r.id)}
                  onToggle={toggle}
                  onAnnotate={annotate}
                  onDiscard={discard}
                  onSend={(id) => push([id])}
                  busy={!canSend}
                />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                Envoyés ({done.length})
              </h2>
              {done.map((r) => (
                <ReportCard
                  key={r.id}
                  report={r}
                  version={version}
                  selected={false}
                  onToggle={toggle}
                  onAnnotate={annotate}
                  onDiscard={discard}
                  onSend={(id) => push([id])}
                  busy
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
