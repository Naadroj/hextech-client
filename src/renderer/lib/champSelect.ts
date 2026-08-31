import type {
  ChampSelectAction,
  ChampSelectCell,
  ChampSelectSession,
} from '@shared/lcu-types'

/** Cellule du joueur local dans la session. */
export function findMyCell(session: ChampSelectSession): ChampSelectCell | null {
  return session.myTeam.find((c) => c.cellId === session.localPlayerCellId) ?? null
}

export interface MyAction {
  action: ChampSelectAction
  isBan: boolean
}

/**
 * Action en cours du joueur local (celle qu'il doit résoudre maintenant) :
 * priorité à `isInProgress && !completed`, sinon la première non complétée.
 */
export function findMyActiveAction(session: ChampSelectSession): MyAction | null {
  const mine = session.actions
    .flat()
    .filter((a) => a.actorCellId === session.localPlayerCellId && a.type !== 'ten_bans_reveal')

  const inProgress = mine.find((a) => a.isInProgress && !a.completed)
  const pending = inProgress ?? mine.find((a) => !a.completed)
  if (!pending) return null
  return { action: pending, isBan: pending.type === 'ban' }
}

/** Champion actuellement survolé/choisi par le joueur local (0 si aucun). */
export function myHoveredChampionId(session: ChampSelectSession): number {
  const active = findMyActiveAction(session)
  if (active && active.action.championId > 0) return active.action.championId
  return findMyCell(session)?.championPickIntent ?? 0
}

export function allBans(session: ChampSelectSession): number[] {
  const fromActions = session.actions
    .flat()
    .filter((a) => a.type === 'ban' && a.completed && a.championId > 0)
    .map((a) => a.championId)
  const fromBans = [...session.bans.myTeamBans, ...session.bans.theirTeamBans].filter((id) => id > 0)
  return Array.from(new Set([...fromBans, ...fromActions]))
}

export function isMyTurn(session: ChampSelectSession): boolean {
  const active = findMyActiveAction(session)
  return !!active && active.action.isInProgress
}

/** Secondes restantes dans la phase (arrondi, 0 mini). */
export function phaseSecondsLeft(session: ChampSelectSession): number {
  return Math.max(0, Math.ceil(session.timer.adjustedTimeLeftInPhase / 1000))
}
