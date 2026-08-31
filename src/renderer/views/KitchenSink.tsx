import { useState } from 'react'
import { Button, Panel, Modal } from '../components/hextech'

/** Vitrine de tous les éléments du design system Hextech (Phase 1). */
export function KitchenSink() {
  const [modalOpen, setModalOpen] = useState(false)
  const [readyOpen, setReadyOpen] = useState(false)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl">Design System Hextech</h1>
        <p className="mt-1 text-sm text-gold-600">
          Vitrine des composants — Phase 1. Sert de référence visuelle et de cible de tests.
        </p>
      </div>

      <Panel title="Boutons">
        <div className="flex flex-wrap items-center gap-4">
          <Button onClick={() => setModalOpen(true)}>Défaut</Button>
          <Button variant="accept" onClick={() => setReadyOpen(true)}>
            Accepter
          </Button>
          <Button variant="ban">Bannir</Button>
          <Button disabled>Désactivé</Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Panel title="Carte à bordure or">
          <p className="text-sm text-gold-100/80">
            Coins biseautés via <code>clip-path</code>, liseré or interne, fond dégradé nuit.
          </p>
        </Panel>
        <Panel title="Palette">
          <div className="grid grid-cols-4 gap-2 text-[10px] uppercase">
            <Swatch name="black" className="bg-hextech-black" />
            <Swatch name="bg" className="bg-hextech-bg" />
            <Swatch name="panel" className="bg-hextech-panel" />
            <Swatch name="gold300" className="bg-gold-300 text-hextech-black" />
            <Swatch name="gold400" className="bg-gold-400 text-hextech-black" />
            <Swatch name="gold600" className="bg-gold-600" />
            <Swatch name="rune.deep" className="bg-rune-deep" />
            <Swatch name="rune.cyan" className="bg-rune-cyan text-hextech-black" />
          </div>
        </Panel>
      </div>

      <Panel title="Séparateur">
        <p className="text-sm text-gold-100/80">Barre dorée avec losange central.</p>
      </Panel>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Modale standard">
        <p className="text-sm text-gold-100/80">
          Fermeture au clic sur le fond ou avec la touche Échap.
        </p>
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
        <p className="text-sm text-gold-100/80">Aperçu de la future modale Ready Check.</p>
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
