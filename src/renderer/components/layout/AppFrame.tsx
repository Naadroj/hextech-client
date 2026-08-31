import type { ReactNode } from 'react'
import { CornerBrackets } from '../hextech'

/** Cadre or à équerres d'angle enveloppant toute la fenêtre. */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <div className="hx-app-frame">
      <CornerBrackets className="text-gold-400" />
      {children}
    </div>
  )
}
