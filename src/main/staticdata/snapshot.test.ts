import { describe, it, expect } from 'vitest'
import { tmpdir } from 'node:os'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareVersions, isValidSnapshot, readSnapshot, writeSnapshot } from './snapshot'
import type { StaticSnapshot } from './types'

const FIXTURE = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../test/fixtures/staticdata/snapshot.json',
)

describe('compareVersions', () => {
  it('ordonne façon patch', () => {
    expect(compareVersions('16.17.1', '16.9.1')).toBeGreaterThan(0)
    expect(compareVersions('16.17.1', '16.17.1')).toBe(0)
    expect(compareVersions('16.17.1', '17.1.1')).toBeLessThan(0)
    expect(compareVersions('16.17', '16.17.1')).toBeLessThan(0)
  })
})

describe('isValidSnapshot', () => {
  it('accepte le fixture et rejette les formes incomplètes', async () => {
    const good = JSON.parse(await readFile(FIXTURE, 'utf8'))
    expect(isValidSnapshot(good)).toBe(true)
    expect(isValidSnapshot(null)).toBe(false)
    expect(isValidSnapshot({ meta: { version: '1' }, items: [], champions: [] })).toBe(false)
    expect(isValidSnapshot({ ...good, items: [] })).toBe(false)
  })
})

describe('readSnapshot / writeSnapshot', () => {
  it('écrit puis relit à l’identique (écriture atomique)', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hx-snap-'))
    const path = join(dir, 'nested', 'snapshot.json')
    const snap = JSON.parse(await readFile(FIXTURE, 'utf8')) as StaticSnapshot

    await writeSnapshot(path, snap)
    const back = await readSnapshot(path)
    expect(back?.meta.version).toBe(snap.meta.version)
    expect(back?.items.length).toBe(snap.items.length)
  })

  it('readSnapshot retourne null sur fichier absent ou corrompu', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'hx-snap-'))
    expect(await readSnapshot(join(dir, 'nope.json'))).toBeNull()
    const bad = join(dir, 'bad.json')
    await writeFile(bad, '{ not json', 'utf8')
    expect(await readSnapshot(bad)).toBeNull()
  })
})
