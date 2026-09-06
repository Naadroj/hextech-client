# Signalements « item incohérent » (phase B)

Un bouton **☟** dans l'overlay permet, à tout moment en partie, de signaler que
l'item conseillé n'est pas cohérent. Le rapport part dans une table Supabase et
se traite hors ligne.

## L'idée : un signalement = un scénario rejouable

Le rapport embarque **l'instantané brut de la partie** (`LiveGameData`) au moment
du clic, dans exactement la forme d'une fixture `test/fixtures/pro-scenarios/`.
Conséquence : on rejoue la décision hors ligne (`assessGame` → `recommend`), on
voit si le moteur actuel la corrige déjà, et on peut **figer le cas en test de
non-régression** en une commande.

## Ce qui est envoyé

Champion, rôle, niveau, or, items des 10 joueurs, menace, l'item contesté, le
motif (**obligatoire**), les précisions libres saisies dans l'app, la version de
l'app et le patch — plus un **UUID d'installation anonyme**. Aucun pseudo, aucun
Riot ID, aucun puuid.

S'y ajoute le **fil des propositions de la partie en cours** (30 dernières au
plus), dans `snapshot.history`. C'est ce qui rend un signalement lisible : sans
lui on voit l'item contesté, avec lui on voit *le chemin* qui y a mené — l'or,
le niveau et l'axe à chaque étape. Il vit dans la colonne `snapshot` (jsonb),
donc rien à migrer côté table, et le rejeu golden l'ignore.

## Le parcours : deux temps

**En jeu**, l'icône bug de l'overlay ouvre le choix du motif. Il n'y a pas de
signalement en un clic : sans motif un rapport n'est pas exploitable — on ne
sait ni quoi rejouer ni quoi corriger. Le clic écrit dans une file locale
(`%APPDATA%/hextech-client/feedback/pending.jsonl`) et s'arrête là.

**Après la partie**, l'onglet **Signalements** de l'app relit la file, laisse
ajouter des précisions à froid (« j'aurais pris Trinité, il était à 3 items »)
et **c'est le seul endroit d'où quelque chose part** : jamais de vidage
automatique, et ce qui n'est pas parti reste en attente.

On choisit ce qui part : « Envoyer celui-ci » sur une carte, une sélection
cochée, ou tout. Envoyer un rapport enregistre d'abord ses précisions non
sauvegardées — sinon elles partiraient dans le vide.

**Un rapport envoyé reste listé mais devient verrouillé** : plus de modification,
plus de renvoi. Sa ligne est en base, la retoucher ici ne la changerait pas
là-bas. `sentAt` porte cette marque ; c'est un champ **local**, absent de la
table, que `toRow()` n'envoie pas. Il reste retirable de la liste locale, ce qui
ne touche pas la ligne en base.

Activé par défaut ; interrupteur dans **Réglages → Signalements**.

## Mise en place Supabase (une fois)

Si la table existe déjà et que l'envoi échoue, la réparation tient en quatre
lignes idempotentes :

```sql
alter table feedback add column if not exists comment text;
alter table feedback enable row level security;
drop policy if exists "insert only" on feedback;
create policy "insert only" on feedback for insert to anon with check (true);
```

### Vérifier sans lancer l'app

```bash
npm run feedback:probe
```

Insère un rapport factice avec la clé anon — via le **vrai** `insertReports`,
donc les noms de colonnes de `toRow()` sont vérifiés au passage — puis contrôle
qu'aucune lecture ne passe avec cette clé, et supprime la ligne derrière si
`SUPABASE_SERVICE_KEY` est dans le `.env`.

Lire le message d'échec plutôt que deviner : PostgREST dit précisément quelle
étape a refusé.

| Réponse | Ce que ça veut dire |
|---|---|
| `401`/`403` + `new row violates row-level security policy` | la ligne était **valide** — table et colonnes bonnes. Soit la policy d'insertion manque, soit la clé part sur le mauvais en-tête (voir plus haut) : vérifier `pg_policies` **avant** de conclure à la policy. |
| `400` + `PGRST204` / `column … does not exist` | le schéma de la table a divergé de `toRow()` |
| `404` | mauvaise URL de projet, ou table absente |
| `identifiants absents de ce build` | les deux `HEXTECH_SUPABASE_*` ne sont pas arrivées |

Création complète à partir de rien :

```sql
create table feedback (
  id             uuid primary key,
  created_at     timestamptz not null default now(),
  install_id     uuid not null,
  app_version    text not null,
  patch          text not null,
  builds_patch   text,
  champion       text not null,
  role           text not null,
  level          int  not null,
  completed_items int not null,
  item_id        int,
  item_rank      int  not null,
  reason_code    text not null,
  comment        text,
  had_skeleton   boolean not null,
  skeleton_games int,
  snapshot       jsonb not null
);
create index on feedback (champion, role);
create index on feedback (created_at desc);

-- Table déjà créée avant la v0.1.12 ? Une seule ligne à jouer :
--   alter table feedback add column if not exists comment text;

-- RLS : le client ne peut QU'insérer. Aucune lecture avec la clé anon.
alter table feedback enable row level security;
create policy "insert only" on feedback for insert to anon with check (true);
```

La clé `anon` est **publique par conception** — elle est faite pour être
embarquée dans un client. La sécurité tient entièrement à la policy ci-dessus :
insertion seule, aucune lecture. Réserve honnête : quiconque extrait la clé du
binaire peut insérer des lignes. À l'échelle d'un cercle d'amis c'est
acceptable ; si ça devient un problème, mettre un Cloudflare Worker devant pour
faire le rate-limit.

### Jamais d'upsert sur une table en insertion seule

**Le piège qui a bloqué la `v0.1.13`.** L'envoi partait avec
`Prefer: resolution=ignore-duplicates`, pour rendre le renvoi idempotent. Cet
en-tête transforme l'`INSERT` en **upsert**, et un upsert sous RLS réclame plus
que la seule policy `INSERT` — sur une table en « insertion seule » il est donc
rejeté, avec le message d'une policy manquante :

```
HTTP 401 — 42501 : new row violates row-level security policy for table "feedback"
```

Le symptôme imite parfaitement une policy absente, et c'est ce qui fait perdre
du temps : la lecture répond `200 []`, l'insertion est refusée, et `pg_policies`
montre pourtant une policy `PERMISSIVE / INSERT / {anon} / true` irréprochable.

**Règle de diagnostic : si la policy est visible et correcte, le problème est
côté client, pas côté SQL.** Ne pas ajouter de policy `SELECT` ou `UPDATE` pour
faire passer l'upsert — ça ouvrirait la lecture des signalements à quiconque
extrait la clé du binaire. L'idempotence est reprise côté client dans
[supabase.ts](src/main/feedback/supabase.ts) : le lot part en insertion simple,
et si un `id` est déjà présent (`409` / `23505`) les rapports repartent un par
un, un doublon comptant comme envoyé.

Mesuré le 6 septembre 2026, sur la vraie base :

| Requête | Résultat |
|---|---|
| `apikey` seul, `Prefer: return=minimal` | **201** |
| `apikey` + `Authorization: Bearer`, `Prefer: return=minimal` | **201** |
| `Prefer: return=minimal,resolution=ignore-duplicates` | **401** `42501` |

Note au passage : envoyer une clé `sb_publishable_…` sur `Authorization: Bearer`
**fonctionne**, contrairement à ce qu'on pouvait craindre. `authHeaders()` ne
l'envoie quand même que sur `apikey`, par conformité à la doc Supabase et pour
ne pas dépendre d'une compatibilité présentée comme transitoire — mais ce n'est
pas un correctif de bug.

### Où trouver les deux valeurs

Dans le tableau de bord Supabase : **Project Settings → API**.
- `HEXTECH_SUPABASE_URL` = *Project URL* (`https://xxxxxxxx.supabase.co`)
- `HEXTECH_SUPABASE_ANON_KEY` = la clé **`anon` / `public`** (surtout **pas**
  la clé `service_role`, qui donne un accès total et ne doit jamais être
  embarquée dans le client).

### Injection dans le build

Ces deux valeurs sont **remplacées textuellement au moment du build**, par
`define` dans `electron.vite.config.ts` — le process principal n'a aucun accès
à l'environnement de la machine de l'utilisateur final.

⚠️ Corollaire : dans `supabase.ts`, la lecture doit rester en **notation
pointée** (`process.env.HEXTECH_SUPABASE_URL`). En `process.env['…']` le
remplacement n'a pas lieu et la valeur serait vide chez tout le monde.

Le `.env` de la racine est chargé au build (`loadEnv` avec un préfixe vide dans
`electron.vite.config.ts`) ; l'environnement du shell — donc la CI — reste
prioritaire sur le fichier.

```bash
# .env à la racine (gitignoré)
HEXTECH_SUPABASE_URL=https://xxxx.supabase.co
HEXTECH_SUPABASE_ANON_KEY=eyJhbGci...
```

En CI, deux **secrets de dépôt** du même nom : le workflow `release` les passe
déjà au build. **Sans ces variables, l'app se construit quand même** — l'envoi
est simplement inerte et les signalements s'empilent en local.

Pour vérifier qu'un build les a bien reçues :
```bash
grep -o "supabase.co" out/main/index.js
```

## Traiter les signalements

Ajoute au `.env` la clé **`service_role`** (Project Settings → API). Elle donne
un accès total : elle ne quitte jamais ta machine et n'est **jamais** embarquée
dans l'app. L'URL est reprise de `HEXTECH_SUPABASE_URL`.

```bash
# .env
SUPABASE_SERVICE_KEY=eyJhbGci...   # service_role

npm run feedback:review
```

Pour chaque ligne : le champion, l'item contesté, **ce que le moteur conseille
aujourd'hui**, et un `✓ changé` si la reco a bougé depuis. Puis :

```bash
npm run feedback:review -- --freeze <id>
```

écrit `test/fixtures/pro-scenarios/feedback-<champion>-<id>.json`, que
`scenarios.pro.test.ts` rejoue automatiquement. La boucle est fermée : une
plainte devient un test.
