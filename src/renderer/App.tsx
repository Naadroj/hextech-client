import { useState } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { NavRail, type NavItem } from './components/layout/NavRail'
import { KitchenSink } from './views/KitchenSink'

const NAV: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'champ', label: 'Champ Select' },
  { id: 'shop', label: 'Boutique' },
  { id: 'social', label: 'Amis' },
  { id: 'kit', label: 'Kitchen Sink' },
]

export default function App() {
  const [active, setActive] = useState('kit')
  const activeLabel = NAV.find((n) => n.id === active)?.label ?? ''

  return (
    <div className="flex h-full flex-col bg-hextech-black text-gold-100">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <NavRail items={NAV} activeId={active} onSelect={setActive} />
        <main className="flex-1 overflow-y-auto p-8">
          {active === 'kit' ? (
            <KitchenSink />
          ) : (
            <div className="hx-panel">
              <h2>{activeLabel}</h2>
              <div className="hx-divider" />
              <p className="text-gold-600">Vue à implémenter dans une phase ultérieure.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
