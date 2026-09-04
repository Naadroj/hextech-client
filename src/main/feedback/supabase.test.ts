import { describe, it, expect, vi } from 'vitest'
import { insertReports, isConfigured, type Poster } from './supabase'
import type { FeedbackReport } from '../../shared/feedback-types'

const report = (over: Partial<FeedbackReport> = {}): FeedbackReport =>
  ({
    id: 'r1',
    createdAt: '2026-09-04T19:10:40.952Z',
    installId: 'inst',
    appVersion: '0.1.12',
    patch: '16.17',
    buildsPatch: null,
    champion: 'Shaco',
    role: 'JUNGLE',
    level: 9,
    completedItems: 2,
    itemId: 3135,
    itemRank: 0,
    reasonCode: 'other',
    comment: null,
    hadSkeleton: true,
    skeletonGames: 132,
    snapshot: { meta: {}, live: {} },
    ...over,
  }) as unknown as FeedbackReport

const ok: Poster = async () => ({ ok: true, status: 201, text: async () => '' })
const fail =
  (status: number, body: string): Poster =>
  async () => ({ ok: false, status, text: async () => body })

describe('insertReports', () => {
  it('ne tente rien sans identifiants et le dit', async () => {
    // Le module lit ses identifiants à l'import : ce build de test n'en a pas.
    expect(isConfigured()).toBe(false)
    const post = vi.fn<Poster>(ok)
    const out = await insertReports([report()], post)
    expect(post).not.toHaveBeenCalled()
    expect(out).toEqual({ sent: [], error: 'identifiants absents de ce build' })
  })

  it('file vide : rien à faire, aucune erreur', async () => {
    expect(await insertReports([])).toEqual({ sent: [], error: null })
  })
})

describe('explication des refus', () => {
  // `insertReports` court-circuite sans identifiants ; on teste la mise en forme
  // du message via un poster qu'on appelle directement dans le même format.
  const cases: [number, string, RegExp][] = [
    [400, '{"message":"column \\"comment\\" of relation \\"feedback\\" does not exist"}', /comment/],
    [401, '{"message":"permission denied"}', /policy d’insertion|policy d'insertion/],
    [403, '{"message":"new row violates row-level security policy"}', /row-level security/],
  ]
  it.each(cases)('HTTP %i remonte le message de la base', async (status, body, expected) => {
    // On rejoue la mise en forme en passant par un module rechargé « configuré ».
    vi.resetModules()
    vi.stubEnv('HEXTECH_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('HEXTECH_SUPABASE_ANON_KEY', 'sb_publishable_test')
    const mod = await import('./supabase')
    const out = await mod.insertReports([report()], vi.fn<Poster>(fail(status, body)))
    expect(out.sent).toEqual([])
    expect(out.error).toMatch(expected)
    vi.unstubAllEnvs()
  })

  it('envoie bien la colonne comment', async () => {
    vi.resetModules()
    vi.stubEnv('HEXTECH_SUPABASE_URL', 'https://x.supabase.co')
    vi.stubEnv('HEXTECH_SUPABASE_ANON_KEY', 'sb_publishable_test')
    const mod = await import('./supabase')
    const post = vi.fn<Poster>(ok)
    await mod.insertReports([report({ comment: 'il fallait Trinité' })], post)

    const body = JSON.parse(String(post.mock.calls[0][1].body))
    expect(body[0].comment).toBe('il fallait Trinité')
    expect(body[0].reason_code).toBe('other')
    vi.unstubAllEnvs()
  })
})
