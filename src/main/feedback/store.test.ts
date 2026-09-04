import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FeedbackStore } from './store'
import type { FeedbackReport } from '../../shared/feedback-types'

const report = (id: string): FeedbackReport =>
  ({
    id,
    createdAt: '2026-09-03T10:00:00.000Z',
    installId: 'inst',
    appVersion: '0.1.10',
    patch: '16.17',
    buildsPatch: null,
    champion: 'Nasus',
    role: 'TOP',
    level: 9,
    completedItems: 1,
    itemId: 3083,
    itemRank: 0,
    reasonCode: null,
    hadSkeleton: true,
    skeletonGames: 21,
    snapshot: { meta: {}, live: {} },
  }) as unknown as FeedbackReport

let dir: string
let file: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'hx-fb-'))
  file = join(dir, 'nested', 'pending.jsonl')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('FeedbackStore', () => {
  it('file vide tant que rien n’a été écrit', () => {
    expect(new FeedbackStore(file).readAll()).toEqual([])
    expect(new FeedbackStore(file).count()).toBe(0)
  })

  it('empile les rapports et crée les dossiers', () => {
    const s = new FeedbackStore(file)
    s.append(report('a'))
    s.append(report('b'))
    expect(s.readAll().map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('ignore les lignes corrompues sans perdre les valides', () => {
    const s = new FeedbackStore(file)
    s.append(report('a'))
    writeFileSync(file, readFileSync(file, 'utf8') + '{ pas du json\n')
    s.append(report('b'))
    expect(s.readAll().map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('retire les rapports envoyés', () => {
    const s = new FeedbackStore(file)
    s.append(report('a'))
    s.append(report('b'))
    s.append(report('c'))
    s.remove(new Set(['a', 'c']))
    expect(s.readAll().map((r) => r.id)).toEqual(['b'])
  })

  it('clear vide tout', () => {
    const s = new FeedbackStore(file)
    s.append(report('a'))
    s.clear()
    expect(s.readAll()).toEqual([])
  })
})
