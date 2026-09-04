import { useEffect, useRef, useState } from 'react'
import type { CoachAdvice } from '@shared/coach-types'
import { AxisBadge, AxisSwitch } from '../components/AxisSwitch'
import { ItemIcon } from '../components/ItemIcon'
import { useAxisSwitch } from '../lib/useAxisSwitch'
import { useCoach } from '../lib/useCoach'
import { useStaticData } from '../lib/useStaticData'
import { getOverlay, setOverlayInteractive } from '../lib/overlayBridge'
import { getFeedback } from '../lib/feedbackBridge'
import { FEEDBACK_REASONS, type FeedbackReason } from '@shared/feedback-types'

/**
 * Vue de l'overlay in-game : carte compacte, semi-transparente, déplaçable.
 *
 * La fenêtre est en click-through (`setIgnoreMouseEvents(true, {forward:true})`)
 * : on reçoit quand même les `mousemove`, ce qui permet un hit-test manuel pour
 * rendre la carte interactive uniquement au survol.
 */

/**
 * Rend la carte interactive quand le curseur la survole, click-through sinon.
 * `lockedRef` fige l'état interactif pendant un déplacement (sinon le curseur
 * sortant de la carte repasserait la fenêtre en click-through en plein drag).
 */
function useHoverInteractive(
  ref: React.RefObject<HTMLElement>,
  lockedRef: React.RefObject<boolean>,
): void {
  const insideRef = useRef(false)
  useEffect(() => {
    const update = (inside: boolean): void => {
      if (lockedRef.current || insideRef.current === inside) return
      insideRef.current = inside
      setOverlayInteractive(inside)
    }
    const onMove = (e: MouseEvent): void => {
      const el = ref.current
      if (!el) return
      const r = el.getBoundingClientRect()
      update(e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom)
    }
    const onLeave = (): void => update(false)
    window.addEventListener('mousemove', onMove)
    document.addEventListener('mouseleave', onLeave)
    return () => {
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      if (insideRef.current) setOverlayInteractive(false)
    }
  }, [ref, lockedRef])
}

/**
 * Déplacement de la fenêtre : le suivi du curseur est fait par le process
 * principal. Ici on ne fait qu'ouvrir et fermer le geste, et verrouiller
 * l'interactivité le temps qu'il dure.
 */
function useWindowDrag(lockedRef: React.MutableRefObject<boolean>): (e: React.MouseEvent) => void {
  return (e: React.MouseEvent) => {
    if (e.button !== 0 || lockedRef.current) return
    e.preventDefault()
    e.stopPropagation()
    lockedRef.current = true
    setOverlayInteractive(true)
    const call = (fn: 'dragStart' | 'dragEnd'): void => {
      try {
        void getOverlay()[fn]()
      } catch {
        /* hors Electron */
      }
    }
    call('dragStart')
    const stop = (): void => {
      window.removeEventListener('mouseup', stop)
      window.removeEventListener('blur', stop)
      lockedRef.current = false
      call('dragEnd')
    }
    window.addEventListener('mouseup', stop)
    window.addEventListener('blur', stop)
  }
}

export function OverlayView({ advice: injected }: { advice?: CoachAdvice } = {}) {
  const live = useCoach()
  const advice = injected ?? live
  const version = useStaticData().summary?.version ?? null
  const axisSwitch = useAxisSwitch(advice)
  const cardRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  // Mode réduit par défaut ; l'état vit côté main (persisté + pilote la taille
  // de la fenêtre), on le lit au montage et on le lui renvoie à chaque bascule.
  const [compact, setCompact] = useState(true)
  /** L'utilisateur a déjà basculé : la lecture au montage ne doit plus écraser. */
  const touchedRef = useRef(false)
  useHoverInteractive(cardRef, draggingRef)
  const onDragHandleMouseDown = useWindowDrag(draggingRef)

  useEffect(() => {
    let active = true
    try {
      void getOverlay()
        .getState()
        .then((st) => {
          if (active && !touchedRef.current) setCompact(st.compact)
        })
        .catch(() => {})
    } catch {
      /* hors Electron */
    }
    return () => {
      active = false
    }
  }, [])

  const toggleCompact = (): void => {
    touchedRef.current = true
    const next = !compact
    setCompact(next)
    try {
      void getOverlay().setCompact(next)
    } catch {
      /* hors Electron */
    }
  }

  const rec = advice.recommendation
  const primary = rec?.primary ?? null

  // Signalement « item incohérent » : accusé de réception 2 s, sans voler le focus.
  const [flagged, setFlagged] = useState(false)
  const flag = (reasonCode: FeedbackReason | null): void => {
    try {
      void getFeedback()
        .send({ itemId: primary?.itemId ?? null, itemRank: 0, reasonCode })
        .then((ok) => {
          if (!ok) return
          setFlagged(true)
          window.setTimeout(() => setFlagged(false), 2000)
        })
        .catch(() => {})
    } catch {
      /* hors Electron */
    }
  }

  // Pas de bouton « fermer » : on retire l'overlay depuis l'app (Réglages ou
  // Ctrl+Maj+O), pour ne pas le désactiver d'un clic malencontreux en pleine partie.
  const buttons = (
    <span className="ml-auto flex items-center" onMouseDown={(e) => e.stopPropagation()}>
      <button
        type="button"
        aria-label="Signaler un item incohérent"
        title="Signaler : cet item n’est pas cohérent"
        onClick={() => flag(null)}
        disabled={!primary}
        className={`px-1 text-xs ${flagged ? 'text-ok' : 'text-gold-700 hover:text-warn'} disabled:opacity-30`}
      >
        {flagged ? '✓' : '☟'}
      </button>
      <button
        type="button"
        aria-label={compact ? 'Déplier' : 'Replier'}
        onClick={toggleCompact}
        className="px-1 text-xs text-gold-700 hover:text-gold-100"
      >
        {compact ? '▸' : '▾'}
      </button>
    </span>
  )

  return (
    <div className="flex h-screen w-screen items-stretch justify-center p-1">
      <div
        ref={cardRef}
        className="relative flex h-full w-full flex-col overflow-hidden rounded border border-gold-800/80 bg-hextech-black/80 shadow-lg backdrop-blur-sm"
      >
        {compact ? (
          /* Réduit : uniquement l'icône du prochain item. */
          <div
            role="presentation"
            aria-label="Déplacer l’overlay"
            onMouseDown={onDragHandleMouseDown}
            className="flex h-full cursor-move items-center gap-1.5 px-1.5"
          >
            {primary ? (
              <ItemIcon
                itemId={primary.itemId}
                version={version}
                size={30}
                title={primary.name}
                className={primary.affordableNow ? 'border-ok/70' : undefined}
              />
            ) : (
              <span className="inline-grid h-[30px] w-[30px] place-items-center border border-gold-800 bg-hextech-black/60">
                <span className="h-2 w-2 rotate-45 bg-gold-800" />
              </span>
            )}
            <AxisBadge axis={axisSwitch.axis} />
            {buttons}
          </div>
        ) : (
          <>
            <div
              role="presentation"
              aria-label="Déplacer l’overlay"
              onMouseDown={onDragHandleMouseDown}
              className="flex cursor-move items-center gap-2 border-b border-gold-800/60 px-2 py-1"
            >
              <span className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
                Coach
              </span>
              {advice.self && (
                <span className="truncate text-xs text-gold-100">{advice.self.slug}</span>
              )}
              {buttons}
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
              {primary ? (
                <>
                  <div className="flex items-start gap-2">
                    <ItemIcon itemId={primary.itemId} version={version} size={36} title={primary.name} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm text-gold-100">{primary.name}</div>
                      <div className="text-[11px] text-parchment">
                        {primary.goldTotal} or ·{' '}
                        {primary.affordableNow ? (
                          <span className="text-ok">abordable</span>
                        ) : (
                          <span className="text-warn">manque {primary.goldShort}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  {axisSwitch.available && (
                    <div onMouseDown={(e) => e.stopPropagation()}>
                      <AxisSwitch value={axisSwitch.axis} onChange={axisSwitch.setAxis} dense />
                    </div>
                  )}

                  {primary.reasons[0] && (
                    <p className="text-[11px] leading-snug text-gold-100/80">• {primary.reasons[0]}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-1">
                    <span className="text-[10px] text-gold-700">Signaler :</span>
                    {FEEDBACK_REASONS.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => flag(r.code)}
                        className="border border-gold-800/70 px-1.5 py-0.5 text-[10px] text-parchment hover:border-warn hover:text-warn"
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  {rec && rec.buildPath.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 border-t border-gold-800/40 pt-2">
                      {rec.buildPath.map((step) => (
                        <ItemIcon
                          key={step.itemId}
                          itemId={step.itemId}
                          version={version}
                          size={22}
                          title={step.owned ? `${step.name} (acheté)` : step.name}
                          className={step.owned ? 'opacity-40' : undefined}
                        />
                      ))}
                      {rec.boots && (
                        <>
                          <span className="mx-1 text-gold-800">|</span>
                          <ItemIcon
                            itemId={rec.boots.itemId}
                            version={version}
                            size={22}
                            title={rec.boots.name}
                          />
                        </>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-[11px] text-parchment">
                  {advice.status === 'active' ? 'Analyse en cours…' : 'Aucune partie en cours.'}
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
