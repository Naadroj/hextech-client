import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtemp, mkdir, readFile, cp } from 'node:fs/promises'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createStaticData } from './index'
import type { Fetcher, FetchResult } from './fetcher'

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test/fixtures/staticdata/snapshot.json',
)

const ok = (body: unknown): FetchResult => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
  json: async () => body,
})
const fail = (): FetchResult => ({
  ok: false,
  status: 503,
  text: async () => 'nope',
  json: async () => {
    throw new Error('no json')
  },
})

const RAW_ITEMS = {
  data: {
    '3078': {
      name: 'Trinity Force',
      description: '<stats><attention>36</attention> Attack Damage</stats>',
      gold: { base: 333, total: 3333, sell: 2333, purchasable: true },
      tags: ['Damage'],
      maps: { '11': true },
      stats: {},
      depth: 3,
      from: ['3057'],
    },
    '2003': {
      name: 'Health Potion',
      description: '<stats></stats>',
      gold: { base: 50, total: 50, sell: 20, purchasable: true },
      tags: ['Consumable'],
      maps: { '11': true },
      stats: {},
    },
  },
}
const RAW_CHAMPS = {
  data: {
    Aatrox: {
      key: '266', id: 'Aatrox', name: 'Aatrox', tags: ['Fighter'], partype: 'Blood Well',
      info: { attack: 8, defense: 4, magic: 3, difficulty: 4 },
      stats: {
        hp: 650, hpperlevel: 114, mp: 0, mpperlevel: 0, movespeed: 345, armor: 38, armorperlevel: 4.8,
        spellblock: 32, spellblockperlevel: 2.05, attackrange: 175, hpregen: 3, hpregenperlevel: 0.5,
        mpregen: 0, mpregenperlevel: 0, crit: 0, critperlevel: 0, attackdamage: 60,
        attackdamageperlevel: 0, attackspeedperlevel: 2.5, attackspeed: 0.651,
      },
    },
  },
}
const RAW_RUNES = [
  { id: 8100, key: 'Domination', name: 'Domination', slots: [{ runes: [{ id: 8112, key: 'Electrocute', name: 'Electrocute', shortDesc: 'x' }] }] },
]
const RAW_SUMMONERS = { data: { SummonerFlash: { id: 'SummonerFlash', name: 'Flash', description: 'x', key: '4', modes: ['CLASSIC'] } } }
const RAW_MERAKI = {
  Aatrox: { id: 266, adaptiveType: 'PHYSICAL_DAMAGE', attackType: 'MELEE', roles: ['FIGHTER'], abilities: { Q: [{ damageType: 'PHYSICAL_DAMAGE' }] } },
}

function makeFetcher(version: string, opts: { merakiFails?: boolean } = {}): Fetcher & { calls: string[] } {
  const calls: string[] = []
  const fetcher = vi.fn(async (url: string): Promise<FetchResult> => {
    calls.push(url)
    if (url.includes('/api/versions.json')) return ok([version, '0.0.0'])
    if (url.includes('/item.json')) return ok(RAW_ITEMS)
    if (url.includes('/champion.json')) return ok(RAW_CHAMPS)
    if (url.includes('runesReforged.json')) return ok(RAW_RUNES)
    if (url.includes('/summoner.json')) return ok(RAW_SUMMONERS)
    if (url.includes('merakianalytics')) return opts.merakiFails ? fail() : ok(RAW_MERAKI)
    return fail()
  }) as unknown as Fetcher & { calls: string[] }
  ;(fetcher as { calls: string[] }).calls = calls
  return fetcher
}

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hx-sd-'))
})
afterEach(() => vi.clearAllMocks())

const paths = () => ({
  bundledSnapshotPath: join(dir, 'bundled', 'snapshot.json'),
  cacheSnapshotPath: join(dir, 'cache', 'snapshot.json'),
})

async function seedBundle(): Promise<void> {
  await mkdir(join(dir, 'bundled'), { recursive: true })
  await cp(FIXTURE, join(dir, 'bundled', 'snapshot.json'))
}
async function seedCache(): Promise<void> {
  await mkdir(join(dir, 'cache'), { recursive: true })
  await cp(FIXTURE, join(dir, 'cache', 'snapshot.json'))
}

describe('createStaticData — chargement', () => {
  it('charge le snapshot embarqué quand il n’y a pas de cache', async () => {
    await seedBundle()
    const ctrl = await createStaticData({ ...paths(), offline: true, autoRefresh: false })
    expect(ctrl.meta.origin).toBe('bundled')
    expect(ctrl.data.version).toBe('16.10.1')
    expect(ctrl.data.getItem(3078)?.name).toBe('Trinity Force')
  })

  it('préfère le cache userData à l’embarqué', async () => {
    await seedBundle()
    await seedCache()
    const ctrl = await createStaticData({ ...paths(), offline: true, autoRefresh: false })
    expect(ctrl.meta.origin).toBe('cache')
  })

  it('lève si aucun snapshot n’est disponible', async () => {
    await expect(createStaticData({ ...paths(), offline: true, autoRefresh: false })).rejects.toThrow(
      /Aucun snapshot/,
    )
  })
})

describe('createStaticData — accesseurs', () => {
  it('expose items, champions, stats par niveau, profils, runes et sorts', async () => {
    await seedCache()
    const { data } = await createStaticData({ ...paths(), offline: true, autoRefresh: false })

    expect(data.getPurchasableItems().map((i) => i.id)).toEqual([3078]) // potion exclue
    expect(data.getChampion(266)?.slug).toBe('Aatrox')
    expect(data.getChampion('aatrox')?.id).toBe(266)
    expect(data.getChampion('Syndra')?.id).toBe(134)

    const s18 = data.getChampionStatsAtLevel(266, 18)!
    expect(s18.health).toBeCloseTo(650 + 114 * 17, 2)

    expect(data.getDamageProfile('Syndra')?.primary).toBe('magic')
    expect(data.getRuneById(8112)?.tree).toBe('Domination')
    expect(data.getSummonerSpellById(4)?.name).toBe('Flash')
  })
})

describe('createStaticData — rafraîchissement', () => {
  it('offline : refresh() ne touche pas le réseau', async () => {
    await seedCache()
    const fetcher = makeFetcher('99.9.9')
    const ctrl = await createStaticData({ ...paths(), fetcher, offline: true, autoRefresh: false })
    expect(await ctrl.refresh(true)).toBe(false)
    expect((fetcher as unknown as { calls: string[] }).calls).toHaveLength(0)
  })

  it('reconstruit sur patch plus récent, écrit le cache et émet "updated"', async () => {
    await seedCache() // fixture = 16.10.1
    const fetcher = makeFetcher('16.20.1')
    const ctrl = await createStaticData({ ...paths(), fetcher, autoRefresh: false })

    const updated = vi.fn()
    ctrl.onUpdated(updated)

    expect(await ctrl.refresh()).toBe(true)
    expect(ctrl.data.version).toBe('16.20.1')
    expect(ctrl.meta.origin).toBe('cache')
    expect(updated).toHaveBeenCalledWith(expect.objectContaining({ version: '16.20.1' }))

    // Persisté : une nouvelle instance repart du cache 16.20.1.
    const reopened = await createStaticData({ ...paths(), offline: true, autoRefresh: false })
    expect(reopened.data.version).toBe('16.20.1')
  })

  it('ne reconstruit pas si le cache est déjà au dernier patch', async () => {
    await seedCache()
    const fetcher = makeFetcher('16.10.1') // == fixture
    const ctrl = await createStaticData({ ...paths(), fetcher, autoRefresh: false })
    expect(await ctrl.refresh()).toBe(false)
  })

  it('Meraki injoignable : build via repli Data Dragon (pas d’échec)', async () => {
    await seedCache()
    const fetcher = makeFetcher('16.20.1', { merakiFails: true })
    const ctrl = await createStaticData({ ...paths(), fetcher, autoRefresh: false })
    expect(await ctrl.refresh()).toBe(true)
    expect(ctrl.data.getDamageProfile(266)?.source).toBe('ddragon')
    expect(ctrl.meta.merakiVersion).toBeNull()
  })

  it('autoRefresh depuis l’embarqué : établit une copie cache', async () => {
    await seedBundle()
    const fetcher = makeFetcher('16.10.1')
    const ctrl = await createStaticData({ ...paths(), fetcher, autoRefresh: true })
    await ctrl.refreshing
    expect(ctrl.meta.origin).toBe('cache')
    expect(await readFile(join(dir, 'cache', 'snapshot.json'), 'utf8')).toContain('16.10.1')
  })
})
