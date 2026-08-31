import type { ReactNode } from 'react'

export interface NavItem {
  id: string
  label: string
  icon?: ReactNode
}

export interface NavRailProps {
  items: NavItem[]
  activeId: string
  onSelect: (id: string) => void
}

export function NavRail({ items, activeId, onSelect }: NavRailProps) {
  return (
    <nav className="hx-nav" aria-label="Navigation principale">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className="hx-nav-item"
          data-active={item.id === activeId}
          aria-current={item.id === activeId ? 'page' : undefined}
          onClick={() => onSelect(item.id)}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
