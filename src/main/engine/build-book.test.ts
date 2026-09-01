import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveBuildBook, refreshBuildBook } from './build-book'
import type { Fetcher, FetchResult } from '../staticdata/fetcher'
import type { BuildBookFile } from '../../shared/build-types'

const file = (patch: string, sampleGames = 100): BuildBookFile => ({
  patch,
  generatedAt: '2026-09-01T00:00:00.000Z',
  sampleGames,
  params: { minGames: 6, coreMinPickRate: 0.3, situationalMinPickRate: 0.12 },
  builds: [
    {
      slug: 'Nasus',
      roles: [
        {
          role: 'TOP',
          games: 12,
          boots: [],
          core: [{ id: 3110, pickRate: 0.8, avgSlot: 1.2 }],
          situational: [],
        },
      ],
    },
  ],
})

const ok = (body: unknown): FetchResult => ({
  ok: true,
  status: 200,
  text: async () => JSON.stringify(body),
  json: async () => body,
})
const fetcherOf = (body: unknown): Fetcher => async () => ok(body)
const throwingFetcher: Fetcher = async () => {
  throw new Error('offline')
}

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'hx-buildbook-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('resolveBuildBook', () => {
  it('renvoie un livre vide si aucun fichier lisible', () => {
    const book = resolveBuildBook({
      bundledPath: join(dir, 'nope.json'),
      cachePath: join(dir, 'nope2.json'),
    })
    expect(book.entryCount).toBe(0)
    expect(book.getBuild('Nasus', 'TOP')).toBeUndefined()
  })

  it('lit le fichier embarqué seul', async () => {
    const bundled = join(dir, 'bundled.json')
    await writeFile(bundled, JSON.stringify(file('16.17')))
    const book = resolveBuildBook({ bundledPath: bundled, cachePath: join(dir, 'x.json') })
    expect(book.patch).toBe('16.17')
    expect(book.getBuild('Nasus', 'TOP')?.core[0].id).toBe(3110)
  })

  it('préfère le cache quand son patch correspond au catalogue', async () => {
    const bundled = join(dir, 'bundled.json')
    const cache = join(dir, 'cache.json')
    await writeFile(bundled, JSON.stringify(file('16.16', 999)))
    await writeFile(cache, JSON.stringify(file('16.17', 10)))
    const book = resolveBuildBook({ bundledPath: bundled, cachePath: cache, currentPatch: '16.17' })
    expect(book.patch).toBe('16.17')
  })

  it('à défaut de patch correspondant, prend le plus gros échantillon', async () => {
    const bundled = join(dir, 'bundled.json')
    const cache = join(dir, 'cache.json')
    await writeFile(bundled, JSON.stringify(file('16.15', 500)))
    await writeFile(cache, JSON.stringify(file('16.16', 20)))
    const book = resolveBuildBook({ bundledPath: bundled, cachePath: cache, currentPatch: '16.17' })
    expect(book.patch).toBe('16.15')
  })
})

describe('refreshBuildBook', () => {
  it('écrit le cache et renvoie le livre quand le patch correspond', async () => {
    const cache = join(dir, 'cache.json')
    const book = await refreshBuildBook({
      cachePath: cache,
      currentPatch: '16.17',
      url: 'http://x',
      fetcher: fetcherOf(file('16.17')),
    })
    expect(book?.getBuild('Nasus', 'TOP')?.core[0].id).toBe(3110)
    const written = JSON.parse(await readFile(cache, 'utf8')) as BuildBookFile
    expect(written.patch).toBe('16.17')
  })

  it('ignore un livre distant d’un autre patch (pas d’écriture)', async () => {
    const cache = join(dir, 'cache.json')
    const book = await refreshBuildBook({
      cachePath: cache,
      currentPatch: '16.17',
      url: 'http://x',
      fetcher: fetcherOf(file('16.16')),
    })
    expect(book).toBeNull()
    await expect(readFile(cache, 'utf8')).rejects.toThrow()
  })

  it('ignore un corps malformé', async () => {
    const book = await refreshBuildBook({
      cachePath: join(dir, 'c.json'),
      currentPatch: '16.17',
      url: 'http://x',
      fetcher: fetcherOf({ nope: true }),
    })
    expect(book).toBeNull()
  })

  it('renvoie null si le réseau échoue', async () => {
    const book = await refreshBuildBook({
      cachePath: join(dir, 'c.json'),
      currentPatch: '16.17',
      url: 'http://x',
      fetcher: throwingFetcher,
    })
    expect(book).toBeNull()
  })
})
