// Sonde d'envoi des signalements : vérifie en une commande que la policy RLS
// d'insertion de la table `feedback` laisse effectivement passer la clé anon.
//
// Usage :
//   npm run feedback:probe
//
// Elle appelle le **vrai** `insertReports` du process principal, avec un
// rapport factice. Donc ce qu'elle valide, c'est le chemin de code réel — les
// noms de colonnes de `toRow()` compris, pas une requête réécrite à côté qui
// pourrait diverger.
//
// `.env` : HEXTECH_SUPABASE_URL + HEXTECH_SUPABASE_ANON_KEY (les mêmes que le
// build). SUPABASE_SERVICE_KEY est optionnelle : si elle est là, la ligne de
// sonde est supprimée derrière ; sinon la commande dit comment la retirer.

import { randomUUID } from 'node:crypto'
import { loadDotEnv } from './lib/local'
import { makeLiveGame } from '../src/shared/engine/context/fixtures'
import type { FeedbackReport } from '../src/shared/feedback-types'

loadDotEnv()

// Import **dynamique** obligatoire : `supabase.ts` lit `process.env` au moment
// où le module est évalué, et les imports statiques le seraient avant le corps
// de ce fichier — donc avant `loadDotEnv()`, sur un environnement encore vide.
const { insertReports, isConfigured, SUPABASE_URL, SUPABASE_ANON_KEY } = await import(
  '../src/main/feedback/supabase'
)

if (!isConfigured()) {
  console.error(
    'Manque dans .env : HEXTECH_SUPABASE_URL et HEXTECH_SUPABASE_ANON_KEY.\n' +
      'Ce sont les deux mêmes valeurs que celles inlinées au build. Voir FEEDBACK.md.',
  )
  process.exit(1)
}

/** UUID nul : marque les lignes de sonde, qu'aucune installation ne produit. */
const PROBE_INSTALL_ID = '00000000-0000-0000-0000-000000000000'

const id = randomUUID()
const live = makeLiveGame({ selfChampion: 'Ashe', allies: [], enemies: [] })
const report: FeedbackReport = {
  id,
  createdAt: new Date().toISOString(),
  installId: PROBE_INSTALL_ID,
  appVersion: 'sonde',
  patch: '0.0',
  buildsPatch: null,
  champion: 'Ashe',
  role: 'BOTTOM',
  level: 1,
  completedItems: 0,
  itemId: null,
  itemRank: 0,
  reasonCode: 'other',
  comment: 'sonde npm run feedback:probe — ligne à supprimer',
  hadSkeleton: false,
  skeletonGames: null,
  snapshot: {
    meta: {
      champion: 'Ashe',
      role: 'BOTTOM',
      atSeconds: 0,
      patch: '0.0',
      expectedItemId: null,
      expectedItemName: null,
      expectedCategory: 'sonde',
    },
    live,
  },
}

console.log(`Base   : ${SUPABASE_URL}`)
console.log(`Clé    : ${SUPABASE_ANON_KEY.slice(0, 12)}… (${SUPABASE_ANON_KEY.length} car.)`)
console.log(`Sonde  : ${id}\n`)

const { sent, error } = await insertReports([report])

if (error) {
  console.error(`✗ Insertion refusée.\n  ${error}\n`)
  // Le message de PostgREST désigne la cause ; on ne devine que la réparation.
  if (/row-level security|42501/i.test(error)) {
    console.error(
      "La ligne était valide : c'est la RLS qui l'a rejetée, donc la table et ses\n" +
        "colonnes sont bonnes et il manque seulement la policy d'insertion.\n" +
        "À jouer dans l'éditeur SQL Supabase :\n\n" +
        '  alter table feedback enable row level security;\n' +
        '  drop policy if exists "insert only" on feedback;\n' +
        '  create policy "insert only" on feedback for insert to anon with check (true);\n',
    )
  } else if (/PGRST204|does not exist|column/i.test(error)) {
    console.error(
      'La base parle de colonne : le schéma de la table a divergé de `toRow()`.\n' +
        'Comparer avec le `create table` de FEEDBACK.md.\n',
    )
  }
  process.exit(1)
}

console.log(`✓ Insertion acceptée (${sent.length} ligne). La policy RLS laisse passer la clé anon.\n`)

// Contrôle de posture : avec une policy d'insertion seule, aucune lecture ne
// doit passer avec cette clé. Si des lignes reviennent, une policy `select` a
// été ajoutée quelque part — les signalements des autres seraient lisibles par
// quiconque extrait la clé du binaire.
const read = await fetch(`${SUPABASE_URL}/rest/v1/feedback?select=id&limit=5`, {
  headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
})
const leaked = read.ok ? ((await read.json()) as unknown[]) : []
if (leaked.length > 0) {
  console.warn(
    `⚠ La clé anon lit ${leaked.length} ligne(s) : une policy \`select\` traîne sur la table.\n` +
      "  Attendu : insertion seule. À retirer, sinon n'importe quel porteur de la clé\n" +
      '  peut relire les signalements de tout le monde.\n',
  )
} else {
  console.log('✓ Lecture vide avec la clé anon : la posture « insertion seule » tient.\n')
}

// Ménage. La clé anon ne peut pas supprimer (c'est le but) : il faut la clé de
// service, qui ne quitte jamais la machine du mainteneur.
const serviceKey = process.env.SUPABASE_SERVICE_KEY ?? ''
if (!serviceKey) {
  console.log(
    `La ligne de sonde reste en base. Ajoute SUPABASE_SERVICE_KEY au .env pour que\n` +
      `la commande fasse le ménage seule, ou supprime-la à la main :\n\n` +
      `  delete from feedback where install_id = '${PROBE_INSTALL_ID}';\n`,
  )
  process.exit(0)
}

const del = await fetch(`${SUPABASE_URL}/rest/v1/feedback?id=eq.${id}`, {
  method: 'DELETE',
  headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
})
console.log(
  del.ok
    ? '✓ Ligne de sonde supprimée.'
    : `⚠ Suppression de la sonde refusée (HTTP ${del.status}). À retirer à la main :\n` +
        `  delete from feedback where id = '${id}';`,
)
