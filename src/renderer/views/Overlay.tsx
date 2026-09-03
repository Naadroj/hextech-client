import { useEffect, useRef, useState } from 'react'
import type { CoachAdvice } from '@shared/coach-types'
import { ItemIcon } from '../components/ItemIcon'
import { useCoach } from '../lib/useCoach'
import { useStaticData } from '../lib/useStaticData'
import { getOverlay, setOverlayInteractive } from '../lib/overlayBridge'

/**
 * Vue de l'overlay in-game : carte compacte, semi-transparente, déplaçable.
 *
 * La fenêtre est en click-through (`setIgnoreMouseEvents(true, {forward:true})`)
 * : on reçoit quand même les `mousemove`, ce qui permet un hit-test manuel pour
 * rendre la carte interactive uniquement au survol.
 */

function clock(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

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
  const cardRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const [collapsed, setCollapsed] = useState(false)
  useHoverInteractive(cardRef, draggingRef)
  const onDragHandleMouseDown = useWindowDrag(draggingRef)

  const rec = advice.recommendation
  const self = advice.self

  return (
    <div className="flex h-screen w-screen items-stretch justify-center p-1">
      <div
        ref={cardRef}
        className="relative flex h-full w-full flex-col overflow-hidden rounded border border-gold-800/80 bg-hextech-black/80 shadow-lg backdrop-blur-sm"
      >
        {/* Poignée de déplacement — suivi du curseur côté process principal. */}
        <div
          role="presentation"
          aria-label="Déplacer l’overlay"
          onMouseDown={onDragHandleMouseDown}
          className="flex cursor-move items-center gap-2 border-b border-gold-800/60 px-2 py-1"
        >
          <span className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
            Coach
          </span>
          {self && <span className="truncate text-xs text-gold-100">{self.slug}</span>}
          {self && <span className="text-xs text-parchment">{self.currentGold} or</span>}
          <span className="ml-auto flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <span className="mr-1 text-[10px] text-parchment">{clock(advice.gameTimeSeconds)}</span>
            <button
              type="button"
              aria-label={collapsed ? 'Déplier' : 'Replier'}
              onClick={() => setCollapsed((c) => !c)}
              className="px-1 text-xs text-gold-700 hover:text-gold-100"
            >
              {collapsed ? '▸' : '▾'}
            </button>
            <button
              type="button"
              aria-label="Fermer l’overlay"
              onClick={() => {
                try {
                  void getOverlay().setEnabled(false)
                } catch {
                  /* hors Electron */
                }
              }}
              className="px-1 text-xs text-gold-700 hover:text-warn"
            >
              ✕
            </button>
          </span>
        </div>

        {!collapsed && (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {rec?.primary ? (
              <>
                <div className="flex items-start gap-2">
                  <ItemIcon itemId={rec.primary.itemId} version={version} size={36} title={rec.primary.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm text-gold-100">{rec.primary.name}</div>
                    <div className="text-[11px] text-parchment">
                      {rec.primary.goldTotal} or ·{' '}
                      {rec.primary.affordableNow ? (
                        <span className="text-ok">abordable</span>
                      ) : (
                        <span className="text-warn">manque {rec.primary.goldShort}</span>
                      )}
                    </div>
                  </div>
                </div>
                {rec.primary.reasons[0] && (
                  <p className="text-[11px] leading-snug text-gold-100/80">• {rec.primary.reasons[0]}</p>
                )}

                {rec.buildPath.length > 0 && (
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
                {advice.status === 'active'
                  ? 'Analyse en cours…'
                  : 'Aucune partie en cours.'}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
