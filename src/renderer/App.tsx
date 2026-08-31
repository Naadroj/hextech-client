import { useState } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { NavRail, type NavItem } from './components/layout/NavRail'
import { StatusBadge } from './components/layout/StatusBadge'
import { ReadyCheckModal } from './components/ReadyCheckModal'
import { KitchenSink } from './views/KitchenSink'
import { Home } from './views/Home'
import { Lobby } from './views/Lobby'
import { useLcuConnection } from './lib/useLcuConnection'

const NAV: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Lobby' },
  { id: 'champ', label: 'Champ Select' },
  { id: 'shop', label: 'Boutique' },
  { id: 'social', label: 'Amis' },
  { id: 'kit', label: 'Kitchen Sink' },
]

const IMPLEMENTED = new Set(['home', 'lobby', 'kit'])

export default function App() {
  const [active, setActive] = useState('home')
  const connection = useLcuConnection()
  const activeLabel = NAV.find((n) => n.id === active)?.label ?? ''

  return (
    <div className="flex h-full flex-col bg-hextech-black text-gold-100">
      <TitleBar />
      <div className="flex min-h-0 flex-1">
        <NavRail
          items={NAV}
          activeId={active}
          onSelect={setActive}
          footer={<StatusBadge status={connection.status} />}
        />
        <main className="flex-1 overflow-y-auto p-8">
          {active === 'home' && <Home connection={connection} />}
          {active === 'lobby' && <Lobby connection={connection} />}
          {active === 'kit' && <KitchenSink />}
          {!IMPLEMENTED.has(active) && (
            <div className="hx-panel">
              <h2>{activeLabel}</h2>
              <div className="hx-divider" />
              <p className="text-gold-600">Vue à implémenter dans une phase ultérieure.</p>
            </div>
          )}
        </main>
      </div>
      <ReadyCheckModal />
    </div>
  )
}
