import { useState } from 'react'
import { AppFrame } from './components/layout/AppFrame'
import { SplashBackground } from './components/layout/SplashBackground'
import { TitleBar } from './components/layout/TitleBar'
import { TopNav, type NavItem } from './components/layout/TopNav'
import { SocialDock } from './components/layout/SocialDock'
import { StatusBadge } from './components/layout/StatusBadge'
import { ReadyCheckModal } from './components/ReadyCheckModal'
import { KitchenSink } from './views/KitchenSink'
import { Home } from './views/Home'
import { Lobby } from './views/Lobby'
import { ChampSelect } from './views/ChampSelect'
import { useLcuConnection } from './lib/useLcuConnection'

const NAV: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Jouer' },
  { id: 'champ', label: 'Sélection' },
  { id: 'shop', label: 'Boutique' },
  { id: 'social', label: 'Amis' },
  { id: 'kit', label: 'Composants' },
]

const IMPLEMENTED = new Set(['home', 'lobby', 'champ', 'kit'])

export default function App() {
  const [active, setActive] = useState('home')
  const connection = useLcuConnection()
  const activeLabel = NAV.find((n) => n.id === active)?.label ?? ''

  return (
    <AppFrame>
      <SplashBackground connected={connection.status === 'connected'} />
      <TitleBar />
      <TopNav
        items={NAV}
        activeId={active}
        onSelect={setActive}
        right={<StatusBadge status={connection.status} />}
      />
      <div className="flex min-h-0 flex-1">
        <main className="flex-1 overflow-y-auto p-8">
          {active === 'home' && <Home connection={connection} />}
          {active === 'lobby' && <Lobby connection={connection} />}
          {active === 'champ' && <ChampSelect connection={connection} />}
          {active === 'kit' && <KitchenSink />}
          {!IMPLEMENTED.has(active) && (
            <div className="hx-frame max-w-xl">
              <h2 className="text-lg">{activeLabel}</h2>
              <div className="hx-divider" />
              <p className="text-parchment">Vue à implémenter dans une phase ultérieure.</p>
            </div>
          )}
        </main>
        <SocialDock />
      </div>
      <ReadyCheckModal />
    </AppFrame>
  )
}
