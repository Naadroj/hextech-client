import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  ChampSelectSession,
  GridChampion,
  RunePage,
  SummonerSpell,
} from '@shared/lcu-types'
import { getLcu } from './lcuBridge'
import { useLcuEvent } from './useLcuEvent'
import { findMyActiveAction, myHoveredChampionId } from './champSelect'

export interface ChampSelectController {
  session: ChampSelectSession | null
  grid: GridChampion[]
  pickable: Set<number>
  bannable: Set<number>
  spells: SummonerSpell[]
  runePages: RunePage[]
  championName: (id: number) => string
  busy: boolean
  error: string | null
  hover: (championId: number) => Promise<void>
  lock: () => Promise<void>
  setSpells: (spell1Id: number, spell2Id: number) => Promise<void>
  chooseRunePage: (pageId: number) => Promise<void>
}

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Action impossible'
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await getLcu().read<T>(path)
    return res.ok && res.data != null ? res.data : fallback
  } catch {
    return fallback
  }
}

export function useChampSelect(connected: boolean): ChampSelectController {
  const [session, setSession] = useState<ChampSelectSession | null>(null)
  const [grid, setGrid] = useState<GridChampion[]>([])
  const [pickable, setPickable] = useState<Set<number>>(new Set())
  const [bannable, setBannable] = useState<Set<number>>(new Set())
  const [spells, setSpellsList] = useState<SummonerSpell[]>([])
  const [runePages, setRunePages] = useState<RunePage[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const loadedForRef = useRef(false)

  useEffect(() => {
    if (!connected) {
      setSession(null)
      return
    }
    let active = true
    readJson<ChampSelectSession | null>('/lol-champ-select/v1/session', null).then((s) => {
      if (active) setSession(s)
    })
    return () => {
      active = false
    }
  }, [connected])

  useLcuEvent('/lol-champ-select/v1/session', (event) => {
    if (event.uri !== '/lol-champ-select/v1/session') return // ignore les sous-ressources
    if (event.eventType === 'Delete' || !event.data) setSession(null)
    else setSession(event.data as ChampSelectSession)
  })

  const refreshChampLists = useCallback(async () => {
    const [pick, ban] = await Promise.all([
      readJson<number[]>('/lol-champ-select/v1/pickable-champion-ids', []),
      readJson<number[]>('/lol-champ-select/v1/bannable-champion-ids', []),
    ])
    setPickable(new Set(pick))
    setBannable(new Set(ban))
  }, [])

  useLcuEvent('/lol-champ-select/v1/pickable-champion-ids', () => void refreshChampLists())
  useLcuEvent('/lol-champ-select/v1/bannable-champion-ids', () => void refreshChampLists())

  // Charge les données de support quand on entre en sélection.
  useEffect(() => {
    const inSelect = session != null
    if (!inSelect) {
      loadedForRef.current = false
      return
    }
    if (loadedForRef.current) return
    loadedForRef.current = true

    let active = true
    void (async () => {
      const [g, sp, rp] = await Promise.all([
        readJson<GridChampion[]>('/lol-champ-select/v1/all-grid-champions', []),
        readJson<SummonerSpell[]>('/lol-game-data/v1/summoner-spells.json', []),
        readJson<RunePage[]>('/lol-perks/v1/pages', []),
      ])
      if (!active) return
      setGrid(Array.isArray(g) ? g : [])
      setSpellsList(Array.isArray(sp) ? sp : [])
      setRunePages(Array.isArray(rp) ? rp : [])
      await refreshChampLists()
    })()
    return () => {
      active = false
    }
  }, [session, refreshChampLists])

  const nameMap = useMemo(() => new Map(grid.map((c) => [c.id, c.name])), [grid])
  const championName = useCallback(
    (id: number) => (id > 0 ? (nameMap.get(id) ?? `Champion ${id}`) : ''),
    [nameMap],
  )

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }, [])

  const hover = useCallback(
    (championId: number) =>
      run(async () => {
        if (!session) throw new Error('Hors sélection')
        const active = findMyActiveAction(session)
        if (!active) throw new Error("Ce n'est pas ton tour")
        await getLcu().champHover(active.action.id, championId)
      }),
    [run, session],
  )

  const lock = useCallback(
    () =>
      run(async () => {
        if (!session) throw new Error('Hors sélection')
        const active = findMyActiveAction(session)
        const championId = myHoveredChampionId(session)
        if (!active) throw new Error("Ce n'est pas ton tour")
        if (!championId) throw new Error('Choisis un champion avant de verrouiller')
        await getLcu().champLock(active.action.id, championId)
      }),
    [run, session],
  )

  const setSpells = useCallback(
    (spell1Id: number, spell2Id: number) =>
      run(() => getLcu().setSummonerSpells(spell1Id, spell2Id)),
    [run],
  )

  const chooseRunePage = useCallback(
    (pageId: number) =>
      run(async () => {
        await getLcu().setRunePage(pageId)
        const rp = await readJson<RunePage[]>('/lol-perks/v1/pages', [])
        setRunePages(Array.isArray(rp) ? rp : [])
      }),
    [run],
  )

  return {
    session,
    grid,
    pickable,
    bannable,
    spells,
    runePages,
    championName,
    busy,
    error,
    hover,
    lock,
    setSpells,
    chooseRunePage,
  }
}
