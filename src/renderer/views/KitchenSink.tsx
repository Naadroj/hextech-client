import { useState } from 'react'
import { Button, Frame, Panel, Modal, PlayButton, Tag, IconFrame, Divider } from '../components/hextech'
import { ModeSelect } from '../components/ModeSelect'
import type { ModeCategory } from '../lib/gameModes'

const DEMO_CATEGORIES: ModeCategory[] = [
  {
    id: 'rift',
    label: "Faille de l'invocateur",
    items: [
      { key: 'queue:420', label: 'Classé Solo/Duo', subtitle: "Faille de l'invocateur · classé", isRanked: true, available: true, kind: 'queue', queueId: 420 },
      { key: 'queue:400', label: 'Draft normale', subtitle: 'Sélection alternée', isRanked: false, available: true, kind: 'queue', queueId: 400 },
      { key: 'queue:430', label: 'Partie normale', subtitle: "Sélection à l'aveugle", isRanked: false, available: false, unavailableReason: 'Indisponible actuellement', kind: 'queue', queueId: 430 },
    ],
  },
  {
    id: 'aram',
    label: 'ARAM',
    items: [
      { key: 'queue:450', label: 'ARAM', subtitle: 'Abîme hurlant · champions aléatoires', isRanked: false, available: true, kind: 'queue', queueId: 450 },
    ],
  },
  {
    id: 'custom',
    label: 'Personnalisée',
    items: [
      { key: 'practice', label: "Outil d'entraînement", subtitle: 'Practice Tool', isRanked: false, available: true, kind: 'practice' },
      { key: 'custom', label: 'Partie personnalisée', subtitle: '5v5 privé', isRanked: false, available: true, kind: 'custom' },
    ],
  },
]

/** Galerie de référence du design system Hextech. */
export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false)
  const [readyOpen, setReadyOpen] = useState(false)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl">Design System Hextech</h1>
        <p className="mt-1 text-sm text-parchment">
          Référence visuelle et cible de tests. Inspiré du client officiel (recréé, sans asset Riot).
        </p>
      </div>

      <Frame title="Boutons">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={() => setModalOpen(true)}>Défaut</Button>
          <Button variant="gold">Or plein</Button>
          <Button variant="primary">Primaire</Button>
          <Button variant="accept" onClick={() => setReadyOpen(true)}>
            Accepter
          </Button>
          <Button variant="ban">Bannir</Button>
          <Button disabled>Désactivé</Button>
          <Button size="sm">Petit</Button>
          <Button size="lg" variant="gold">
            Grand
          </Button>
        </div>
        <Divider />
        <PlayButton>Jouer</PlayButton>
      </Frame>

      <div className="grid gap-6 lg:grid-cols-2">
        <Frame title="Cadre ornemental">
          <p className="text-sm text-gold-100/80">
            Bordure or en dégradé <code>border-image</code>, hairline interne, équerres d'angle SVG,
            barres d'ornement.
          </p>
        </Frame>
        <Panel title="Panneau simple">
          <p className="text-sm text-gold-100/80">Gunmetal, fine bordure, sans ornement.</p>
        </Panel>
      </div>

      <Frame title="Palette">
        <div className="grid grid-cols-4 gap-2 text-[10px] uppercase md:grid-cols-6">
          <Swatch name="black" className="bg-hextech-black" />
          <Swatch name="bg" className="bg-hextech-bg" />
          <Swatch name="gun" className="bg-hextech-gun" />
          <Swatch name="gold400" className="bg-gold-400 text-hextech-black" />
          <Swatch name="gold200" className="bg-gold-200 text-hextech-black" />
          <Swatch name="gold600" className="bg-gold-600" />
          <Swatch name="rune.deep" className="bg-rune-deep" />
          <Swatch name="rune.teal" className="bg-rune-teal text-hextech-black" />
          <Swatch name="rune.text" className="bg-rune-text text-hextech-black" />
          <Swatch name="decline" className="bg-decline text-hextech-black" />
          <Swatch name="ok" className="bg-ok text-hextech-black" />
          <Swatch name="warn" className="bg-warn text-hextech-black" />
        </div>
      </Frame>

      <ModeSelect categories={DEMO_CATEGORIES} onConfirm={() => {}} />

      <Frame title="Divers">
        <div className="flex flex-wrap items-center gap-6">
          <IconFrame size={72} level={312} />
          <Tag>Étiquette</Tag>
          <Tag tone="cyan">Cyan</Tag>
          <div className="w-40">
            <span className="hx-divider" />
          </div>
        </div>
      </Frame>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modale standard">
        <p className="text-sm text-gold-100/80">Fermeture au clic sur le fond ou avec Échap.</p>
        <div className="mt-4 flex justify-end">
          <Button onClick={() => setModalOpen(false)}>Fermer</Button>
        </div>
      </Modal>

      <Modal
        open={readyOpen}
        onClose={() => setReadyOpen(false)}
        title="Partie trouvée"
        className="text-center"
      >
        <p className="text-sm text-gold-100/80">Aperçu Ready Check.</p>
        <div className="mt-4 flex justify-center gap-4">
          <Button variant="accept" onClick={() => setReadyOpen(false)}>
            Accepter
          </Button>
          <Button variant="ban" onClick={() => setReadyOpen(false)}>
            Décliner
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function Swatch({ name, className }: { name: string; className: string }) {
  return (
    <div
      className={`flex h-14 items-end justify-center border border-gold-800 p-1 tracking-wide ${className}`}
    >
      {name}
    </div>
  )
}
