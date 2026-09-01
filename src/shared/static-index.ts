import type {
  ChampionSpellDamage,
  DamageProfile,
  NormalizedChampion,
  NormalizedItem,
  RuneInfo,
  StatBlock,
  StaticData,
  StaticSnapshot,
  SummonerSpellInfo,
} from './staticdata-types'
import { statsAtLevel } from './engine/model/champion-stats'

/**
 * Indexe un `StaticSnapshot` en un `StaticData` prêt à interroger. **Pur** :
 * aucune E/S, aucun réseau — le contrôleur `createStaticData` (process
 * principal) s'occupe du cache et du rafraîchissement autour.
 */

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '')

export function indexSnapshot(snapshot: StaticSnapshot): StaticData {
  const itemsById = new Map<number, NormalizedItem>()
  const champById = new Map<number, NormalizedChampion>()
  const champByName = new Map<string, NormalizedChampion>()
  const profileByChamp = new Map<number, DamageProfile>()
  const spellByChamp = new Map<number, ChampionSpellDamage>()
  const runeById = new Map<number, RuneInfo>()
  const summonerById = new Map<number, SummonerSpellInfo>()

  for (const it of snapshot.items) itemsById.set(it.id, it)
  for (const c of snapshot.champions) {
    champById.set(c.id, c)
    champByName.set(norm(c.slug), c)
    champByName.set(norm(c.name), c)
  }
  for (const p of snapshot.damageProfiles) profileByChamp.set(p.championId, p)
  for (const s of snapshot.spellDamage ?? []) spellByChamp.set(s.championId, s)
  for (const r of snapshot.runes) runeById.set(r.id, r)
  for (const s of snapshot.summonerSpells) summonerById.set(s.id, s)

  const getChampion = (ref: number | string): NormalizedChampion | undefined =>
    typeof ref === 'number' ? champById.get(ref) : champByName.get(norm(ref))

  return {
    version: snapshot.meta.version,
    locale: snapshot.meta.locale,
    getItem: (id) => itemsById.get(id),
    getAllItems: () => snapshot.items,
    getPurchasableItems: () =>
      snapshot.items.filter(
        (i) =>
          i.onSummonersRift && i.purchasable && i.goldTotal > 0 && !i.isConsumable && !i.isTrinket,
      ),
    getChampion,
    getChampionStatsAtLevel: (ref, level): StatBlock | undefined => {
      const champ = getChampion(ref)
      return champ ? statsAtLevel(champ.base, level) : undefined
    },
    getDamageProfile: (ref) => {
      const champ = getChampion(ref)
      return champ ? profileByChamp.get(champ.id) : undefined
    },
    getSpellDamage: (ref) => {
      const champ = getChampion(ref)
      return champ ? spellByChamp.get(champ.id) : undefined
    },
    getRuneById: (id) => runeById.get(id),
    getSummonerSpellById: (id) => summonerById.get(id),
  }
}
