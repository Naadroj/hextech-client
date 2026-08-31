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
  /** Contenu épinglé en bas du rail (ex. badge de statut). */
  footer?: ReactNode
}

export function NavRail({ items, activeId, onSelect, footer }: NavRailProps) {
  return (
    <nav className="hx-nav" aria-label="Navigation principale">
      <div className="flex flex-1 flex-col gap-1">
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
      </div>
      {footer != null && <div className="mt-auto border-t border-gold-800/60">{footer}</div>}
    </nav>
  )
}
