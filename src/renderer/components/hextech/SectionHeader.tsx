import type { ReactNode } from 'react'

export function SectionHeader({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="hx-section-header">
      <h2>{children}</h2>
      {right != null && <div className="text-sm text-parchment">{right}</div>}
    </div>
  )
}
