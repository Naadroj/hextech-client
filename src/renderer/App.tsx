import { useState } from 'react'
import { AppFrame } from './components/layout/AppFrame'
import { SplashBackground } from './components/layout/SplashBackground'
import { TitleBar } from './components/layout/TitleBar'
import { TopNav, type NavItem } from './components/layout/TopNav'
import { SocialDock } from './components/layout/SocialDock'
import { StatusBadge } from './components/layout/StatusBadge'
import { ReadyCheckModal } from './components/ReadyCheckModal'
import { ErrorBoundary } from './components/ErrorBoundary'
import { KitchenSink } from './views/KitchenSink'
import { Home } from './views/Home'
import { Lobby } from './views/Lobby'
import { ChampSelect } from './views/ChampSelect'
import { Coach } from './views/Coach'
import { Reports } from './views/Reports'
import { Settings } from './views/Settings'
import { useLcuConnection } from './lib/useLcuConnection'

const NAV: NavItem[] = [
  { id: 'home', label: 'Accueil' },
  { id: 'lobby', label: 'Jouer' },
  { id: 'champ', label: 'Sélection' },
  { id: 'coach', label: 'Coach' },
  { id: 'reports', label: 'Signalements' },
  { id: 'shop', label: 'Boutique' },
  { id: 'social', label: 'Amis' },
  { id: 'settings', label: 'Réglages' },
  { id: 'kit', label: 'Composants' },
]

const IMPLEMENTED = new Set(['home', 'lobby', 'champ', 'coach', 'reports', 'settings', 'kit'])

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
          <ErrorBoundary key={active} label={activeLabel || active}>
            {active === 'home' && <Home connection={connection} />}
            {active === 'lobby' && <Lobby connection={connection} />}
            {active === 'champ' && <ChampSelect connection={connection} />}
            {active === 'coach' && <Coach />}
            {active === 'reports' && <Reports />}
            {active === 'settings' && <Settings />}
            {active === 'kit' && <KitchenSink />}
            {!IMPLEMENTED.has(active) && (
              <div className="hx-frame max-w-xl">
                <h2 className="text-lg">{activeLabel}</h2>
                <div className="hx-divider" />
                <p className="text-parchment">Vue à implémenter dans une phase ultérieure.</p>
              </div>
            )}
          </ErrorBoundary>
        </main>
        <ErrorBoundary label="amis">
          <SocialDock />
        </ErrorBoundary>
      </div>
      <ErrorBoundary label="ready check">
        <ReadyCheckModal />
      </ErrorBoundary>
    </AppFrame>
  )
}
