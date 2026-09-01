# Squelette de build hi-elo (phase A4.3)

Par champion + rôle : les légendaires (+ bottes) que les joueurs Challenger
achètent réellement, avec **taux de pick** (`pickRate`) et **position d'achat
moyenne** (`avgSlot`). Le moteur Coach s'en sert comme *prior* additif au score
(`src/shared/engine/recommend/build-prior.ts`) — il corrige les choix qu'aucun
modèle de stats ne peut deviner (Nasus veut de l'accélération avant du tank).
L'heuristique situationnelle (menace, tempo, antisoin, QSS, stase) reste la
couche de départage / override.

## Le fichier

`resources/builds.json` (`BuildBookFile`) :

```jsonc
{
  "patch": "16.17",              // DOIT correspondre au snapshot (ids d'items)
  "generatedAt": "2026-…Z",
  "sampleGames": 348,            // parties distinctes lues
  "params": { "minGames": 6, "coreMinPickRate": 0.3, "situationalMinPickRate": 0.12 },
  "builds": [
    { "slug": "Nasus", "roles": [
      { "role": "TOP", "games": 41, "patchSpan": "16.16→16.17",  // si complété N-1
        "boots": [{ "id": 3158, "pickRate": 0.55, "avgSlot": 0 }],
        "core": [{ "id": 3078, "pickRate": 0.63, "avgSlot": 1.6 }, …],
        "situational": [{ "id": 6662, "pickRate": 0.22, "avgSlot": 2.1 }, …] }
    ]}
  ]
}
```

- **Séparé** du catalogue Riot (`snapshot.json`). Repli offline embarqué.
- Un couple champion+rôle vu `< minGames` fois → **pas d'entrée** → le moteur
  retombe sur l'heuristique pure (`BUILD_MIN_GAMES` dans `build-prior.ts`).

## Générer localement

```bash
# 1. moissonner (clé Riot requise — voir BENCH.md) : garde patch courant + N-1
RIOT_API_KEY=… RIOT_PLATFORM=euw1 RIOT_REGION=europe  npm run harvest -- 30 6
RIOT_API_KEY=… RIOT_PLATFORM=kr   RIOT_REGION=asia    npm run harvest -- 30 6

# 2. agréger  [minGames] [coreMinPickRate] [situationalMinPickRate]
npm run builds
npm run builds -- 10 0.35 0.15
```

`npm run builds` lit **tout** `bench/raw/`, fusionne les régions, écrit
`resources/builds.json`.

### Repli patch N-1

`npm run harvest` conserve aussi les parties du patch précédent (`previousPatch`
dans `scripts/lib/local.ts`). `npm run builds` agrège d'abord le patch courant ;
pour tout couple champion+rôle sous `minGames`, il **complète** avec les parties
N-1 (ids filtrés au catalogue courant) et marque `patchSpan`. Utile surtout les
2-3 jours suivant un patch, quand les champions rares manquent de volume. Le
raté du 1er patch d'une saison (`x.1`) : pas de N-1 connu → pas de repli.

## Autonomie : CI + téléchargement client

L'app n'agrège rien et n'a **aucune clé Riot**. Le fichier est régénéré côté
serveur et le client le télécharge.

### `.github/workflows/build-book.yml`

- Déclencheurs : cron **hebdo** (le méta bouge à peine sur un patch) +
  `workflow_dispatch` manuel.
- Étapes : `npm ci` → `npm run staticdata` (cale les ids d'items sur le dernier
  patch) → `npm run harvest` EUW/KR/NA → `npm run builds` → publie
  `resources/builds.json` comme asset de la Release au tag stable **`builds-latest`**
  (`gh release upload … --clobber`).
- **Prérequis** : secret de dépôt `RIOT_API_KEY` = une **Personal API Key**
  (pas une clé de dev — elle expire en 24 h et casserait le job). Demande :
  <https://developer.riotgames.com/> → *Register Product* → *Personal API Key*.

### Côté client (`src/main/engine/build-book.ts`)

Au démarrage, `src/main/index.ts` :

1. `resolveBuildBook()` — lit le meilleur fichier **sur disque** : cache
   `%APPDATA%/hextech-client/builds.json` si son `patch` == catalogue courant,
   sinon l'embarqué, sinon le plus gros `sampleGames`. Synchrone, jamais bloquant.
2. `refreshBuildBook()` en tâche de fond — GET `BUILD_BOOK_URL`. Le fichier n'est
   adopté (et mis en cache) **que si `file.patch === patch courant`**. Réseau
   KO / format invalide / patch différent ⇒ on garde la version locale.
3. Rejoué à chaque rafraîchissement de patch du snapshot (`staticData.onUpdated`).

`BUILD_BOOK_URL` (constante dans `build-book.ts`) : **aligner `owner/repo` sur
`electron-builder.yml`** (`publish:`). Surcharge test : `HEXTECH_BUILDS_URL`.

## À faire par le mainteneur (une fois)

Dépôt : **`github.com/Naadroj/hextech-client`** (déjà câblé dans
`electron-builder.yml` `publish.owner` et `BUILD_BOOK_URL`).

1. Pousser le code : `git remote add origin https://github.com/Naadroj/hextech-client.git`
   puis `git push -u origin main` (rien n'est committé pour l'instant).
2. Obtenir une **Personal API Key** Riot → l'ajouter en secret de dépôt
   `RIOT_API_KEY` (Settings → Secrets and variables → Actions).
3. Activer GitHub Actions. Lancer une fois `build-book` en manuel (onglet Actions
   → *build-book* → *Run workflow*) pour créer le tag `builds-latest`.

Ensuite : plus rien. Le cron régénère, les clients récupèrent au lancement.

## Rafraîchir le repli embarqué

`resources/builds.json` committé sert de repli offline ; il n'a pas besoin
d'être frais. De temps en temps (ou avant un `npm run dist`), relancer
`npm run harvest` + `npm run builds` en local et committer le résultat.
