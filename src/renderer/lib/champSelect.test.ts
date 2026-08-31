import { describe, it, expect } from 'vitest'
import type { ChampSelectAction, ChampSelectSession } from '@shared/lcu-types'
import {
  allBans,
  findMyActiveAction,
  findMyCell,
  isMyTurn,
  myHoveredChampionId,
  phaseSecondsLeft,
} from './champSelect'

function action(p: Partial<ChampSelectAction>): ChampSelectAction {
  return {
    id: 0,
    actorCellId: 0,
    championId: 0,
    completed: false,
    isAllyAction: true,
    isInProgress: false,
    pickTurn: 1,
    type: 'pick',
    ...p,
  }
}

function session(p: Partial<ChampSelectSession>): ChampSelectSession {
  return {
    actions: [],
    myTeam: [],
    theirTeam: [],
    bans: { myTeamBans: [], theirTeamBans: [], numBans: 0 },
    timer: { adjustedTimeLeftInPhase: 0, totalTimeInPhase: 0, phase: 'BAN_PICK', isInfinite: false },
    localPlayerCellId: 0,
    isCustomGame: false,
    benchEnabled: false,
    benchChampions: [],
    ...p,
  }
}

describe('findMyCell', () => {
  it('retourne la cellule dont cellId == localPlayerCellId', () => {
    const s = session({
      localPlayerCellId: 2,
      myTeam: [{ cellId: 1 } as never, { cellId: 2, championId: 99 } as never],
    })
    expect(findMyCell(s)?.championId).toBe(99)
  })
})

describe('findMyActiveAction', () => {
  it('privilégie une action isInProgress non complétée pour ma cellule', () => {
    const s = session({
      localPlayerCellId: 3,
      actions: [
        [action({ id: 10, actorCellId: 3, type: 'ban', completed: true })],
        [
          action({ id: 20, actorCellId: 4, isInProgress: true }),
          action({ id: 21, actorCellId: 3, isInProgress: true }),
        ],
      ],
    })
    const my = findMyActiveAction(s)
    expect(my?.action.id).toBe(21)
    expect(my?.isBan).toBe(false)
  })

  it('sinon la première action non complétée pour ma cellule', () => {
    const s = session({
      localPlayerCellId: 3,
      actions: [[action({ id: 30, actorCellId: 3, type: 'ban', completed: false })]],
    })
    expect(findMyActiveAction(s)).toMatchObject({ isBan: true })
  })

  it('null si tout est complété', () => {
    const s = session({
      localPlayerCellId: 3,
      actions: [[action({ id: 40, actorCellId: 3, completed: true })]],
    })
    expect(findMyActiveAction(s)).toBeNull()
  })
})

describe('myHoveredChampionId', () => {
  it('retourne le championId de mon action active', () => {
    const s = session({
      localPlayerCellId: 0,
      actions: [[action({ id: 1, actorCellId: 0, championId: 157 })]],
    })
    expect(myHoveredChampionId(s)).toBe(157)
  })

  it('retombe sur championPickIntent de ma cellule', () => {
    const s = session({
      localPlayerCellId: 0,
      myTeam: [{ cellId: 0, championPickIntent: 64 } as never],
      actions: [[action({ id: 1, actorCellId: 0, championId: 0 })]],
    })
    expect(myHoveredChampionId(s)).toBe(64)
  })
})

describe('allBans', () => {
  it('agrège bans d’équipes et actions ban complétées, sans doublon', () => {
    const s = session({
      bans: { myTeamBans: [1, 2], theirTeamBans: [3], numBans: 6 },
      actions: [[action({ type: 'ban', completed: true, championId: 3 }), action({ type: 'ban', completed: true, championId: 9 })]],
    })
    expect(allBans(s).sort((a, b) => a - b)).toEqual([1, 2, 3, 9])
  })
})

describe('isMyTurn / phaseSecondsLeft', () => {
  it('isMyTurn vrai seulement si action active en cours', () => {
    const on = session({ localPlayerCellId: 0, actions: [[action({ actorCellId: 0, isInProgress: true })]] })
    const off = session({ localPlayerCellId: 0, actions: [[action({ actorCellId: 0, isInProgress: false })]] })
    expect(isMyTurn(on)).toBe(true)
    expect(isMyTurn(off)).toBe(false)
  })

  it('phaseSecondsLeft convertit les ms en secondes', () => {
    expect(phaseSecondsLeft(session({ timer: { adjustedTimeLeftInPhase: 26500, totalTimeInPhase: 30000, phase: 'BAN_PICK', isInfinite: false } }))).toBe(27)
    expect(phaseSecondsLeft(session({ timer: { adjustedTimeLeftInPhase: -5, totalTimeInPhase: 30000, phase: 'x', isInfinite: false } }))).toBe(0)
  })
})
