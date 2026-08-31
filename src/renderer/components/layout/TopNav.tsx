import type { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
}

export interface TopNavProps {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
  /** Zone alignée à droite (statut de connexion, réglages…). */
  right?: ReactNode
}

/** Barre d'onglets horizontale façon client officiel. */
export function TopNav({ items, activeId, onSelect, right }: TopNavProps) {
  return (
    <nav className="hx-topnav" aria-label="Navigation principale">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="hx-topnav__tab"
          data-active={item.id === activeId}
          aria-current={item.id === activeId ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.label}
        </button>
      ))}
      {right != null && <div className="ml-auto flex items-center self-center pb-3">{right}</div>}
    </nav>
  )
}
