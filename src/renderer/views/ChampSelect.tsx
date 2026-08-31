import { useMemo, useState } from 'react'
import type {
  ChampSelectCell,
  ChampSelectSession,
  ConnectionInfo,
  RunePage,
  SummonerSpell,
} from '@shared/lcu-types'
import { Button, Frame, Tag } from '../components/hextech'
import { ChampionIcon } from '../components/ChampionIcon'
import { cn } from '../lib/cn'
import { useChampSelect, type ChampSelectController } from '../lib/useChampSelect'
import {
  allBans,
  findMyActiveAction,
  findMyCell,
  myHoveredChampionId,
  phaseSecondsLeft,
} from '../lib/champSelect'

const PHASE_LABEL: Record<string, string> = {
  PLANNING: 'Planification',
  BAN_PICK: 'Bans & sélection',
  FINALIZATION: 'Finalisation',
}

const POSITION_LABEL: Record<string, string> = {
  top: 'Haut',
  jungle: 'Jungle',
  middle: 'Milieu',
  bottom: 'Bas',
  utility: 'Support',
}

function spellName(spells: SummonerSpell[], id: number): string {
  return spells.find((s) => s.id === id)?.name ?? (id > 0 ? `Sort ${id}` : '—')
}

export function ChampSelect({ connection }: { connection: ConnectionInfo }) {
  const connected = connection.status === 'connected'
  const cs = useChampSelect(connected)

  if (!connected || !cs.session) {
    return (
      <Frame title="Sélection des champions" className="mx-auto max-w-2xl">
        <p className="text-parchment">
          Rejoins une partie et lance la recherche : la sélection des champions s'affichera ici dès
          qu'elle commence.
        </p>
      </Frame>
    )
  }

  return <Board cs={cs} session={cs.session} />
}

function Board({ cs, session }: { cs: ChampSelectController; session: ChampSelectSession }) {
  const myCell = findMyCell(session)
  const active = findMyActiveAction(session)
  const bans = allBans(session)
  const secondsLeft = phaseSecondsLeft(session)
  const totalMs = session.timer.totalTimeInPhase || 1
  const pct = Math.max(0, Math.min(100, (session.timer.adjustedTimeLeftInPhase / totalMs) * 100))
  const phase = PHASE_LABEL[session.timer.phase] ?? session.timer.phase

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Frame
        title={phase}
        headerRight={session.timer.isInfinite ? '∞' : `${secondsLeft}s`}
      >
        <div className="h-1.5 w-full border border-gold-800 bg-hextech-black/60">
          <div
            className="h-full bg-gold-btn transition-[width] duration-500"
            style={{ width: `${pct}%` }}
            role="progressbar"
            aria-valuenow={Math.round(pct)}
          />
        </div>
        {bans.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="font-display text-[10px] uppercase tracking-hexwide text-gold-700">
              Bans
            </span>
            {bans.map((id) => (
              <ChampionIcon key={id} championId={id} size={28} title={cs.championName(id)} />
            ))}
          </div>
        )}
      </Frame>

      <div className="grid gap-4 md:grid-cols-2">
        <TeamColumn
          title="Ton équipe"
          cells={session.myTeam}
          localCellId={session.localPlayerCellId}
          cs={cs}
        />
        <TeamColumn
          title="Équipe adverse"
          cells={session.theirTeam}
          localCellId={-1}
          cs={cs}
        />
      </div>

      {cs.error && <p className="text-sm text-decline">{cs.error}</p>}

      {active ? (
        <Frame title={active.isBan ? 'Ton ban' : 'Ta sélection'}>
          <ChampionGrid cs={cs} session={session} isBan={active.isBan} />
          <div className="hx-divider" />
          <div className="flex items-center justify-between">
            <span className="text-sm text-parchment">
              {myHoveredChampionId(session) > 0
                ? cs.championName(myHoveredChampionId(session))
                : 'Aucun champion sélectionné'}
            </span>
            <Button
              variant={active.isBan ? 'ban' : 'gold'}
              disabled={cs.busy || myHoveredChampionId(session) <= 0 || !active.action.isInProgress}
              onClick={() => void cs.lock()}
            >
              {active.isBan ? 'Bannir' : 'Verrouiller'}
            </Button>
          </div>
        </Frame>
      ) : (
        <Frame>
          <p className="text-parchment">En attente de ton tour…</p>
        </Frame>
      )}

      {myCell && (
        <div className="grid gap-4 md:grid-cols-2">
          <SpellPicker cs={cs} cell={myCell} />
          <RunePagePicker cs={cs} />
        </div>
      )}
    </div>
  )
}

function TeamColumn({
  title,
  cells,
  localCellId,
  cs,
}: {
  title: string
  cells: ChampSelectCell[]
  localCellId: number
  cs: ChampSelectController
}) {
  return (
    <Frame title={title}>
      <ul className="space-y-2">
        {cells.map((cell) => {
          const champId = cell.championId || cell.championPickIntent
          return (
            <li
              key={cell.cellId}
              className={cn(
                'flex items-center gap-3 border border-gold-800 bg-hextech-black/40 p-2',
                cell.cellId === localCellId && 'border-gold-300',
              )}
            >
              <ChampionIcon championId={champId} size={40} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm text-gold-100">
                  {champId > 0 ? cs.championName(champId) : 'En réflexion…'}
                </div>
                <div className="text-[11px] uppercase tracking-hex text-gold-700">
                  {POSITION_LABEL[cell.assignedPosition] ?? '—'}
                </div>
              </div>
              <div className="text-right text-[11px] text-parchment">
                <div>{spellName(cs.spells, cell.spell1Id)}</div>
                <div>{spellName(cs.spells, cell.spell2Id)}</div>
              </div>
            </li>
          )
        })}
      </ul>
    </Frame>
  )
}

function ChampionGrid({
  cs,
  session,
  isBan,
}: {
  cs: ChampSelectController
  session: ChampSelectSession
  isBan: boolean
}) {
  const [query, setQuery] = useState('')
  const hovered = myHoveredChampionId(session)
  const allowed = isBan ? cs.bannable : cs.pickable

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return cs.grid
      .filter((c) => !q || c.name.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [cs.grid, query])

  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Rechercher un champion…"
        className="mb-3 w-full border border-gold-800 bg-hextech-black/60 px-3 py-2 text-sm text-gold-100 outline-none focus:border-gold-300"
      />
      <div className="hx-champ-grid">
        {list.map((champ) => {
          const selectable =
            !champ.disabled && (allowed.size === 0 || allowed.has(champ.id)) && !cs.busy
          return (
            <button
              key={champ.id}
              type="button"
              disabled={!selectable}
              data-active={champ.id === hovered}
              className="hx-champ-grid__item"
              title={champ.name}
              onClick={() => void cs.hover(champ.id)}
            >
              <ChampionIcon championId={champ.id} size={48} />
              <span className="hx-champ-grid__name">{champ.name}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function SpellPicker({ cs, cell }: { cs: ChampSelectController; cell: ChampSelectCell }) {
  const options = useMemo(
    () =>
      cs.spells
        .filter((s) => s.gameModes.length === 0 || s.gameModes.includes('CLASSIC'))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [cs.spells],
  )

  const change = (slot: 1 | 2, value: number) => {
    const s1 = slot === 1 ? value : cell.spell1Id
    const s2 = slot === 2 ? value : cell.spell2Id
    void cs.setSpells(s1, s2)
  }

  return (
    <Frame title="Sorts d'invocateur">
      <div className="flex gap-3">
        {([1, 2] as const).map((slot) => (
          <select
            key={slot}
            aria-label={`Sort d'invocateur ${slot}`}
            className="flex-1 border border-gold-800 bg-hextech-black/60 px-2 py-2 text-sm text-gold-100"
            value={slot === 1 ? cell.spell1Id : cell.spell2Id}
            disabled={cs.busy || options.length === 0}
            onChange={(e) => change(slot, Number(e.target.value))}
          >
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        ))}
      </div>
    </Frame>
  )
}

function RunePagePicker({ cs }: { cs: ChampSelectController }) {
  const current: RunePage | undefined =
    cs.runePages.find((p) => p.current) ?? cs.runePages.find((p) => p.isActive)

  return (
    <Frame title="Runes">
      {cs.runePages.length === 0 ? (
        <p className="text-sm text-parchment">Aucune page de runes.</p>
      ) : (
        <>
          <select
            aria-label="Page de runes active"
            className="w-full border border-gold-800 bg-hextech-black/60 px-2 py-2 text-sm text-gold-100"
            value={current?.id ?? ''}
            disabled={cs.busy}
            onChange={(e) => void cs.chooseRunePage(Number(e.target.value))}
          >
            {cs.runePages.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          {current && (
            <p className="mt-2 text-[11px] uppercase tracking-hex text-gold-700">
              <Tag>{current.selectedPerkIds.length} runes</Tag>
            </p>
          )}
        </>
      )}
    </Frame>
  )
}
