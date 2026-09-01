import { useState } from 'react'
import { Button, Frame, Panel, Modal, PlayButton, Tag, IconFrame, Divider } from '../components/hextech'
import { ModeSelect } from '../components/ModeSelect'
import type { ModeCategory } from '../lib/gameModes'
import { useLiveGame } from '../lib/useLiveGame'
import { useStaticData } from '../lib/useStaticData'

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

      <StaticDataDebug />

      <LiveGameDebug />

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

/** Carte debug du pipeline de données statiques (Phase A1). */
function StaticDataDebug() {
  const { summary, refresh } = useStaticData()
  const [busy, setBusy] = useState(false)

  return (
    <Frame title="Données statiques — debug (A1)">
      {summary ? (
        <div className="space-y-2 text-sm text-parchment">
          <div className="flex flex-wrap items-center gap-3">
            <Tag tone="cyan">Patch {summary.version}</Tag>
            <Tag>{summary.source === 'cache' ? 'cache userData' : 'embarqué'}</Tag>
            {summary.updating && <Tag>maj en cours…</Tag>}
          </div>
          <p>
            {summary.itemCount} items · {summary.championCount} champions · {summary.runeCount} runes
            · {summary.summonerSpellCount} sorts
          </p>
          <p>
            profils de dégâts — meraki {summary.damageProfileSources.meraki} · overrides{' '}
            {summary.damageProfileSources.override} · repli ddragon{' '}
            {summary.damageProfileSources.ddragon}
            {summary.merakiVersion ? ` · meraki ${summary.merakiVersion}` : ' · meraki indisponible'}
          </p>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true)
              try {
                await refresh()
              } finally {
                setBusy(false)
              }
            }}
          >
            {busy ? 'Vérification…' : 'Vérifier le patch'}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-parchment">Chargement du catalogue…</p>
      )}
    </Frame>
  )
}

/** Sonde debug de la Live Client Data API (Phase A0). */
function LiveGameDebug() {
  const { status, snapshot } = useLiveGame()
  const g = snapshot?.data.gameData
  const players = snapshot?.data.allPlayers ?? []

  return (
    <Frame title="Live Client Data — debug (A0)">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Tag tone={status === 'active' ? 'cyan' : undefined}>
          {status === 'active' ? 'En partie' : 'Hors partie'}
        </Tag>
        {g && (
          <span className="text-parchment">
            {g.gameMode} · {g.mapName} · {Math.floor(g.gameTime / 60)}:
            {String(Math.floor(g.gameTime % 60)).padStart(2, '0')} · {players.length} joueurs
          </span>
        )}
      </div>
      {snapshot ? (
        <pre className="mt-3 max-h-64 overflow-auto rounded border border-gold-800 bg-hextech-black/60 p-3 text-[11px] leading-snug text-gold-100/80">
          {JSON.stringify(
            {
              receivedAt: snapshot.receivedAt,
              activePlayer: snapshot.data.activePlayer.summonerName,
              currentGold: Math.round(snapshot.data.activePlayer.currentGold),
              level: snapshot.data.activePlayer.level,
              players: players.map((p) => ({
                champ: p.championName,
                team: p.team,
                lvl: p.level,
                kda: `${p.scores.kills}/${p.scores.deaths}/${p.scores.assists}`,
                items: p.items.map((i) => i.itemID),
              })),
            },
            null,
            2,
          )}
        </pre>
      ) : (
        <p className="mt-3 text-sm text-parchment">
          Aucune partie en cours. Lance une partie (Faille de l'invocateur) pour voir l'instantané.
        </p>
      )}
    </Frame>
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
