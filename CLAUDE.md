# Hextech Client — reprise du projet

Ce fichier est chargé automatiquement par Claude Code à chaque session dans ce
dépôt. Il dit **où on en est**, **ce qui ne se négocie pas**, et **ce qui reste
à faire**. Les détails techniques vivent dans les docs dédiées (voir plus bas) ;
ici on ne garde que ce qu'on ne peut pas deviner en lisant le code.

Dernière mise à jour : **6 septembre 2026** (version publiée : `v0.1.13`).

## Ce qu'est le projet

Client compagnon **externe** pour League of Legends : Electron + React +
TypeScript. Il parle au client officiel via la **LCU API** (lockfile local) et à
la partie en cours via la **Live Client Data API** (`https://127.0.0.1:2999`).

Il embarque un sous-projet **« Coach »** qui conseille le prochain item à
acheter, en temps réel, façon Blitz/Porofessor — moteur heuristique pur, tourné
dans le process principal, plus un « squelette de build » hi-elo agrégé en CI.

Distribué à un cercle d'amis via GitHub Releases (installeur NSIS Windows,
auto-update `electron-updater`).

## Règles absolues

1. **Ne jamais créer ni pousser un tag git, ni bumper la version dans
   `package.json`, sans demande explicite de l'utilisateur.** Un tag déclenche le
   workflow `release`, qui publie un installeur public. Commiter et pousser sur
   `master` reste normal et ne demande pas d'autorisation.
2. **Aucune injection, aucun hook, aucune lecture mémoire, aucune modification
   de fichier de jeu.** Tout passe par les API locales officielles. L'overlay est
   une fenêtre Electron transparente posée par-dessus, rien de plus.
3. **La vraie clé Riot ne va que dans `.env`** (gitignoré) ou l'environnement du
   shell. `.env.example` ne contient que des valeurs bidon. Elle n'est jamais
   embarquée dans l'application — elle ne sert qu'aux scripts de moisson.
4. **La clé Supabase `service_role` ne va jamais dans l'app.** Seule la clé
   *publishable* (ex-`anon`) est embarquée : elle est publique par conception et
   la sécurité repose entièrement sur la policy RLS « insert only ».
   `service_role` ne sert qu'à `npm run feedback:review`, depuis la machine du
   mainteneur.
5. **Le code, les commentaires, l'UI et les messages de commit sont en
   français.** Les commentaires expliquent *pourquoi*, pas *quoi*.

## Démarrer sur une nouvelle machine

```bash
git clone https://github.com/Naadroj/hextech-client.git
cd hextech-client
npm ci
cp .env.example .env   # puis y mettre les vraies valeurs (voir ci-dessous)
npm run dev
```

Node 22+ (développé sous 24.13, npm 11.8). Windows — le projet cible Windows,
et la détection de fenêtre au premier plan de l'overlay est spécifique à Win32.

### Contenu de `.env`

| Variable | À quoi ça sert | Sans elle |
|---|---|---|
| `RIOT_API_KEY` | scripts `harvest` / `topup` uniquement | l'app tourne, la moisson locale non |
| `RIOT_PLATFORM`, `RIOT_REGION` | idem | idem |
| `HEXTECH_SUPABASE_URL` | inliné **au build** dans le bundle main | l'envoi des signalements est inerte |
| `HEXTECH_SUPABASE_ANON_KEY` | idem (clé `sb_publishable_…`) | idem |
| `SUPABASE_SERVICE_KEY` | `npm run feedback:review` seulement | on ne peut pas relire les signalements |

Les deux variables `HEXTECH_SUPABASE_*` sont **remplacées textuellement au
build** par `define` dans `electron.vite.config.ts`, qui lit `.env` via
`loadEnv`. D'où la notation **pointée obligatoire** dans
[supabase.ts](src/main/feedback/supabase.ts) : `process.env.HEXTECH_SUPABASE_URL`
et surtout pas `process.env['…']`, sinon la lecture se ferait à l'exécution sur
la machine de l'utilisateur et la valeur serait toujours vide.

Côté CI, les mêmes valeurs sont des **secrets de dépôt** déjà configurés
(`HEXTECH_SUPABASE_URL`, `HEXTECH_SUPABASE_ANON_KEY`, `RIOT_API_KEY`).

### Commandes

```bash
npm run dev          # electron-vite en dev
npm test             # vitest (564 tests)
npm run typecheck    # tsc sur les projets node + web
npm run lint         # eslint
npm run build        # bundle (inline les identifiants Supabase)
npm run dist         # installeur NSIS
npm run builds       # régénère resources/builds.json depuis bench/raw/
npm run feedback:probe    # teste l'envoi d'un signalement (clé anon, ligne factice)
npm run feedback:review   # relit les signalements en base (service_role)
```

## Architecture

```
src/main/       process principal : LCU, poller Live, coach, overlay,
                signalements, historique, updater, IPC
src/preload/    pont contextIsolé → window.app.{lcu,live,coach,history,…}
src/renderer/   React + Tailwind (vues, composants hextech, hooks)
src/shared/     types + moteur PUR (aucun accès Electron/Node)
  engine/model/       stats effectives, EHP, débit de dégâts
  engine/context/     évaluation menace, fed-o-meter, déclencheurs
  engine/recommend/   candidats, scoring, justifications, prior de build
  engine/replay/      reconstruction de parties Match-V5 (benchmark)
scripts/        moisson Riot, agrégation du squelette, bench, revue
```

Le moteur (`src/shared/engine/`) est **pur et déterministe** : pas d'I/O, pas
d'Electron. C'est ce qui permet de le rejouer sur des fixtures et de transformer
un signalement utilisateur en test de non-régression.

## Le pipeline de données (important)

C'est la partie la moins devinable du projet.

1. Le workflow **`build-book`** (cron hebdo + `workflow_dispatch`) moissonne des
   parties Challenger/GM/Master via **Match-V5**, région par région. Le corpus
   brut (`bench/raw/`) est **mis en cache par patch + région** et grossit à
   chaque run ; un nouveau patch repart d'un cache neuf, pour que les parties du
   patch précédent ne soient jamais prioritaires.
2. Il agrège en `resources/builds.json` : par champion + rôle, les items `core`
   / `situational` / `boots` / `starters` avec taux de pick et position d'achat
   moyenne.
3. **Il ne commite rien dans le dépôt.** Il publie `builds.json` comme asset de
   la release **`builds-latest`**.
4. L'app **télécharge cet asset au lancement** et le met en cache dans
   `userData/builds.json` ([build-book.ts](src/main/engine/build-book.ts)). Le
   `resources/builds.json` du dépôt n'est qu'un repli hors ligne.

**Conséquence à retenir : les données et le code se livrent séparément.** Un
nouveau `builds.json` arrive chez les utilisateurs sans release ; inversement,
tagger une version ne rafraîchit pas les données.

Dernier run (4 sept. 2026, 2 h 31) : **16 578 parties**, 173 champions, 627
entrées, 512 avec starters, **48 variantes d'axe AD/AP**. Couverture : 522
couples champion+rôle au seuil de 50 parties, 311 en dessous.

## État des fonctionnalités

Phases 0 → 6 faites, phase 7 (Boutique) et 8-9 à faire. Sous-projet Coach
A0 → A7 fait. Détail dans [README.md](README.md).

Trois chantiers récents, tous livrés en `v0.1.11` → `v0.1.13` :

### Switch d'axe AD/AP

Segmenté `Auto · AD · AP` dans l'onglet Coach et l'overlay déplié ; en mode
réduit, un bouton unique qui cycle. **Toujours disponible en partie**, même si le
livre de builds n'a pas deux variantes pour ce champion : c'est une
*orientation*, pas une consultation de statistiques.

Forcer un axe retire l'axe opposé du slot principal, **et rien d'autre**. Les
items neutres (armure, résistance magique, antisoin, QSS, stase) n'appartiennent
à aucun axe et restent proposés — on peut donc toujours partir tanky.

L'axe est remis à `null` à chaque changement de partie (on peut jouer AD Shaco
puis AP Shaco). **Pas de bouton « Hybride »** : « Auto » l'est déjà — il ne veut
pas dire « aucun axe » mais « déduis-le de mon inventaire », et sur un inventaire
mixte il laisse les deux côtés en lice.

Côté données, `sampleAxis` classe **chaque joueur** par sa propre séquence de
légendaires (pas l'item isolément), et une variante `champion|RÔLE#axe` n'est
émise que si les deux côtés atteignent `minGames` et que le minoritaire pèse
≥ 25 %. C'est ce qui évite de scinder à tort un champion mono-chemin dont les
items portent AD *et* magique (Kaï'Sa).

### Signalements, en deux temps

- **En jeu** : l'icône bug de l'overlay ouvre le choix du motif. Pas de
  signalement en un clic, et **jamais sans motif** — sans lui un rapport n'est
  pas exploitable. Le clic écrit dans une file locale JSONL, et s'arrête là.
- **Après la partie** : l'onglet **Signalements** relit la file, permet d'ajouter
  des précisions à froid, de jeter un rapport, et **c'est le seul endroit d'où
  quelque chose part** (bouton « Envoyer »). Aucun vidage automatique.

Un signalement a exactement la forme d'une fixture golden : `snapshot.live` se
rejoue tel quel avec `assessGame` → `recommend`. `npm run feedback:review --
--freeze <id>` le fige en test de non-régression. Schéma SQL et policy RLS dans
[FEEDBACK.md](FEEDBACK.md).

### Historique des propositions

Une partie = un fichier JSONL dans `userData/history/` (en-tête + une ligne par
changement réel de proposition ; les battements de cœur du coach ne sont pas
enregistrés). 20 parties conservées. Relisible dans l'onglet Coach, y compris
hors partie. Les 30 dernières étapes sont jointes aux signalements, dans
`snapshot.history`.

## En cours / à faire

### 1. L'envoi des signalements — résolu le 6 septembre 2026

**La cause était dans notre code, pas dans la base.** L'envoi partait avec
`Prefer: resolution=ignore-duplicates`, pour rendre un renvoi idempotent. Cet
en-tête fait un **upsert**, et un upsert sous RLS réclame plus que la seule
policy `INSERT` : sur une table en « insertion seule » il est rejeté, avec le
message d'une policy manquante. Corrigé dans
[supabase.ts](src/main/feedback/supabase.ts) — insertion simple, et l'idempotence
est reprise côté client sur le `409` (`23505`), les rapports repartant un par un.

Vérifié contre la vraie base : insertion acceptée, lecture toujours vide avec la
clé publique. Détail des mesures dans [FEEDBACK.md](FEEDBACK.md).

**La leçon, elle vaut plus que le correctif.** Le symptôme imitait parfaitement
une policy absente, et le débogage a cherché côté Supabase pendant tout ce
temps — en vain, la base était juste depuis le début. La question qui tranche :

```sql
select policyname, permissive, roles, cmd, with_check
from pg_policies where schemaname = 'public' and tablename = 'feedback';
```

Une policy `PERMISSIVE / INSERT / {anon} / true` visible **et** un `INSERT`
refusé ⇒ chercher côté client. Et ne jamais ajouter de policy `SELECT`/`UPDATE`
pour faire passer une requête : ça ouvrirait la lecture des signalements.

**Pas encore dans un binaire publié** : la `v0.1.13` installée continuera
d'échouer jusqu'à une nouvelle version.

Corrigés en route : la colonne `comment` n'était pas envoyée et l'échec était
muet (`v0.1.13`), et il n'existait aucun moyen de tester l'envoi hors de l'app
(`npm run feedback:probe`).

### 2. Variantes d'axe : faux positifs sur les enchanteurs

Les 48 variantes produites sont majoritairement justes — Shaco JUNGLE
AD(Voltaic/Umbral/Youmuu) vs AP(Blackfire/Mandate/Liandry) est exactement ce
qu'on veut, et l'AD Katarina détecté est un vrai build de ce patch.

Mais **Lulu SUPPORT sort en AD(465) / AP(269)** alors qu'aucun des deux côtés
n'est un build de dégâts : `sampleAxis` compte probablement l'Encensoir ardent
(vitesse d'attaque) comme `ad-onhit`. Même suspicion sur Yuumi SUPPORT AD(46).
Piste : exclure les items d'intention `enchanter`/support de `sampleAxis`, ou
exiger un minimum d'or de dégâts avant de déclarer un axe. Voir
[aggregate.ts](scripts/lib/aggregate.ts).

Impact limité aujourd'hui (l'entrée combinée reste utilisée par défaut), mais un
joueur qui force un axe sur Lulu recevrait un squelette bancal.

### 3. Reporté

- Runes + ordre de compétences + import en 1 clic via la LCU.
- Builds conditionnés au matchup.
- Phase 7 : Boutique & Inventaire.

## Documentation

| Fichier | Sujet |
|---|---|
| [README.md](README.md) | plan de phases, structure, scripts |
| [DISTRIBUTION.md](DISTRIBUTION.md) | posture vie privée, packaging, auto-update |
| [BUILDS.md](BUILDS.md) | squelette de build hi-elo, pipeline CI |
| [BENCH.md](BENCH.md) | corpus Match-V5, benchmark, scénarios golden |
| [ENGINE-TUNING.md](ENGINE-TUNING.md) | réglages du moteur de recommandation |
| [FEEDBACK.md](FEEDBACK.md) | signalements : schéma SQL, RLS, revue |

## Pièges connus

- **Le dossier est synchronisé par OneDrive.** Exclure `node_modules/`, `out/`
  et `dist/`, sinon verrous de fichiers pendant les builds.
- **L'overlay exige League en mode « Sans bordure »** : le plein écran exclusif
  passe devant toute fenêtre.
- **`electron-updater` est CommonJS** : l'importer en `import electronUpdater
  from 'electron-updater'` puis déstructurer. Un import nommé fait planter l'app
  packagée au démarrage.
- **Le drag de l'overlay est piloté par le process principal** (suivi du
  curseur), pas par `-webkit-app-region: drag` — celui-ci exige le focus, ce qui
  est incompatible avec le click-through.
- `src/renderer/views/Lobby.test.tsx` est instable dans la suite complète mais
  passe seul. Connu, ce n'est pas une régression.
