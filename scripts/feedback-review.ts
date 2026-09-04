// Traitement des signalements (phase B3). Lit la table Supabase, rejoue chaque
// signalement dans le moteur courant, et peut le figer en scénario golden.
//
// Usage :
//   npm run feedback:review                   # liste + rejeu
//   npm run feedback:review -- --freeze <id>  # → test/fixtures/pro-scenarios/
//
// `.env` : SUPABASE_SERVICE_KEY (clé `service_role`). L'URL est reprise de
// HEXTECH_SUPABASE_URL. La clé de service ne quitte jamais ta machine.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { ROOT, SCENARIOS_DIR, loadStaticData, loadBuildBook } from './lib/local'
import { assessGame } from '../src/shared/engine/context'
import { recommend } from '../src/shared/engine/recommend'
import type { FeedbackReport } from '../src/shared/feedback-types'

// Charge le `.env` de la racine (même convention que scripts/lib/riot.ts).
try {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* pas de .env : on se rabat sur l'environnement du shell */
}

const URL_ = process.env.SUPABASE_URL || process.env.HEXTECH_SUPABASE_URL || ''
const KEY = process.env.SUPABASE_SERVICE_KEY ?? ''
const freezeId = process.argv.includes('--freeze')
  ? process.argv[process.argv.indexOf('--freeze') + 1]
  : null

if (!URL_ || !KEY) {
  console.error(
    'Manque dans .env : SUPABASE_SERVICE_KEY (clé `service_role` Supabase).\n' +
      "L'URL est reprise de HEXTECH_SUPABASE_URL. Voir FEEDBACK.md.",
  )
  process.exit(1)
}

const res = await fetch(`${URL_}/rest/v1/feedback?select=*&order=created_at.desc&limit=200`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
if (!res.ok) {
  console.error(`Lecture refusée : HTTP ${res.status}`)
  process.exit(1)
}

const rows = (await res.json()) as (FeedbackReport & Record<string, unknown>)[]
if (rows.length === 0) {
  console.log('Aucun signalement.')
  process.exit(0)
}

const { data: sd } = loadStaticData()
const book = loadBuildBook()
const nameOf = (id: number | null): string =>
  id === null ? '—' : (sd.getItem(id)?.name ?? String(id))

console.log(`${rows.length} signalement(s)\n`)

for (const row of rows) {
  const snap = (row as unknown as { snapshot: FeedbackReport['snapshot'] }).snapshot
  const id = String(row.id)
  const champion = String((row as Record<string, unknown>).champion)
  const role = String((row as Record<string, unknown>).role)
  const reason = (row as Record<string, unknown>).reason_code ?? '—'

  // Rejoue la décision avec le moteur **actuel** : dit si c'est déjà corrigé.
  let now = '(rejeu impossible)'
  try {
    const a = assessGame(snap.live, sd)
    if (a) {
      const rec = recommend(a, sd, book)
      now = rec.primary ? nameOf(rec.primary.itemId) : '—'
    }
  } catch {
    /* snapshot d'un autre patch : ids d'items incompatibles */
  }

  const flagged = nameOf(row.itemId)
  const changed = now !== flagged && now !== '(rejeu impossible)'
  console.log(
    `${id.slice(0, 8)}  ${champion} ${role}  contesté: ${flagged}` +
      `  → aujourd'hui: ${now}  [${reason}]${changed ? '  ✓ changé' : ''}`,
  )

  if (freezeId && id.startsWith(freezeId)) {
    mkdirSync(SCENARIOS_DIR, { recursive: true })
    const file = resolve(SCENARIOS_DIR, `feedback-${champion.toLowerCase()}-${id.slice(0, 8)}.json`)
    writeFileSync(file, JSON.stringify(snap, null, 2) + '\n')
    console.log(`\n→ figé en scénario golden : ${file}`)
    console.log('  (il sera rejoué par scenarios.pro.test.ts)')
  }
}

if (!freezeId) {
  console.log('\nPour figer un signalement en test : npm run feedback:review -- --freeze <id>')
}
