# Benchmark du moteur Coach sur de vraies parties (A4.2)

On valide le recommandeur d'items contre les **décisions d'achat réelles** de
joueurs Challenger, reconstruites depuis l'API **Riot Match-V5**.

## Principe

Un frame de timeline à l'instant T + les événements d'items rejoués =
un `LiveGameData` identique en forme à celui de la Live Client Data API. Le
**prochain achat de légendaire** du joueur = la vérité terrain.

`src/shared/engine/replay/` (pur, testé) fait la reconstruction :
`reconstructState(match, timeline, atMs, pid, staticData)` et
`extractDecisions(match, timeline, staticData)`.

## 1. Moissonner (une fois par patch)

```bash
# Clé de développeur : https://developer.riotgames.com/  (valable 24 h)
export RIOT_API_KEY=RGAPI-xxxxxxxx
export RIOT_PLATFORM=euw1     # euw1 | na1 | kr | eun1 …  (défaut euw1)
export RIOT_REGION=europe     # europe | americas | asia   (défaut europe)

npm run harvest              # ~30 joueurs × 6 parties ≈ 5 min (limité à 1 req/1,3 s)
# npm run harvest -- 50 8    # plus de volume
```

Écrit `bench/raw/{matchId}.match.json` + `.timeline.json` (gitignored). Ne garde
que la queue 420, la Faille, et le **patch du `snapshot.json` embarqué** (sinon
les ids d'items ne correspondent pas). Ré-exécutable : saute ce qui est déjà en
cache.

### Tester sur un **autre** échantillon (validation croisée)

Après avoir réglé le moteur sur un jeu de parties, re-mesurer sur un jeu
**indépendant** pour vérifier qu'on n'a pas sur-appris :

```bash
rm -rf bench/raw                              # repartir propre
RIOT_PLATFORM=na1  RIOT_REGION=americas  npm run harvest   # autre serveur
# ou kr / asia, ou eun1 / europe, ou simplement quelques jours plus tard
npm run bench:coach
```

Le ladder Challenger bouge chaque jour : même sans changer de région, un
`rm -rf bench/raw` + `harvest` quelques jours après donne un échantillon neuf.
Si le `bucket` tient (± quelques points), le réglage généralise.

## 2. Mesurer

```bash
npm run bench:coach
```

Pour chaque décision : `reconstructState` → `assessGame` → `recommend`, puis :

| Métrique | Sens |
| --- | --- |
| **top-1** | l'item conseillé en primaire == l'item réellement acheté (bas, ~20-30 %) |
| **top-3** | l'item acheté ∈ {primaire, alternatives} (cible ~55-70 %) |
| **cat** | *accord de catégorie* — même famille fonctionnelle (`armor-pen`, `magic-resist`, `antiheal`, `stasis`…). **La métrique de référence** : tolère « Lord Dominik's vs Serylda's ». |

Ventilé par rôle, phase de partie, et champions les moins bien servis. Rapport
complet dans `bench/report.json`. C'est le tableau de bord à surveiller quand on
règle les poids du moteur.

## 3. Figer des scénarios golden

Depuis le corpus, on gèle une poignée de cas **illustratifs** en tests golden
stables (comme `scenarios.test.ts`, mais issus de vraies parties) :

```bash
npm run freeze-scenario -- --match EUW1_1234567890 --pid 3 --at 1080 \
    --name syndra-mid-vs-zed-fed --category stasis
```

Écrit `test/fixtures/pro-scenarios/{name}.json` (`{ meta, live }`). La vérité
terrain (`expectedItemId` + `expectedCategory`) est déduite du prochain
légendaire acheté après `--at` ; `--category` permet de forcer.

`scenarios.pro.test.ts` charge tous ces fichiers et vérifie, pour chacun, que la
catégorie attendue apparaît dans le top-3 du moteur. Tant que le dossier est
vide, ce test ne fait rien.

## Relevé (patch 16.17, 143 parties Challenger, 3655 décisions)

`npm run bench:coach` sort, en plus des taux :
- **`bucket`** = l'item conseillé et l'item acheté partagent la même *intention*
  d'itémisation (`ap-damage`, `ad-lethality`, `ad-crit`, `ad-onhit`,
  `ad-bruiser`, `tank`, `antiheal`, `qss`, `stasis`…). **Métrique de référence.**
- **Direction des ratés** : `too-defensive` / `too-greedy` /
  `wrong-offense-axis` / `wrong-defense-axis` → dit dans quel sens pousser.
- **Confusions** : `bucket moteur → bucket pro` les plus fréquentes → dit
  *quel* paramètre régler.

| | départ | réglage poids | + modèle de sorts (A2.2) |
| --- | --- | --- | --- |
| **global** | 34 % | 65 % | **67 %** |
| mid | 34 % | 78 % | 76 % |
| bot | 36 % | 70 % | 68 % |
| support | 26 % | 64 % | 68 % |
| jungle | 47 % | 63 % | 66 % |
| top | 22 % | 51 % | 55 % |

A2.2 (ratios de sorts réels) : `wrong-offense-axis` 15 % → 13,6 %,
`too-greedy` 5 % → 3,9 %, top-3 7,4 % → 8,7 %.

### Validation croisée — 116 parties **Challenger KR** (2890 décisions, échantillon indépendant)

| | EUW (réglage) | KR (contrôle) |
| --- | --- | --- |
| **global** | 67 % | **65 %** |
| mid | 76 % | 76 % |
| bot | 68 % | 70 % |
| jungle | 66 % | 65 % |
| top | 54 % | 54 % |
| support | 68 % | **56 %** |

**Le réglage généralise** : global à −1,4 pt, la plupart des rôles à ±2 pts —
pas de sur-apprentissage sur EUW. **Sauf le support (−12 pts)** : confirme la
limite structurelle (aucune notion d'item d'enchanteur — Lulu, Bard, Rakan à
0-16 %). Faiblesses **constantes** sur les deux échantillons, donc réelles :
`ad-carry → ad-bruiser` (~5 %), `ap-damage → ad-onhit` (~4 %), et les champions
hybrides (Corki, Kai'Sa, Camille).

(top-1 ~2 %, top-3 ~7 % — normaux : beaucoup d'items « corrects » à un instant donné.)

### Réglages appliqués pour passer de 34 % à 65 %

1. **Métrique par *intention*** (`itemIntent`) au lieu de bucket fin : Bâton du
   néant ≈ Rabadon (`ap-damage`), IE ≈ Collector ≈ Lord Dominik's (`ad-carry`).
2. **Bonus défensifs baissés** (`score.ts`) : antisoin `moderate` 0.7→0.35,
   « bouée » stase/lifeline seuil `burstSeverity` 0.25→0.45.
3. **`coreBuild` desserré** : le garde exigeait `enemyHealing === 'none'`
   (jamais vrai en Challenger) → `!== 'heavy'`, facteur 0.2·onAxis.
4. **Axe de dégâts « tanky »** (`tempo.ts`) : bruisers / battlemages / tanks-AP
   ont `health` sur leur axe → Trinity/Riftmaker/Sundered Sky ne paient plus un
   tempo plein (règle `ad-lethality → ad-bruiser`, `ap-damage → tank`).
5. `representativeTarget` mélangé 65 % cible tuable / 35 % moyenne d'équipe.

## Comment régler

Boucle : **un seul paramètre à la fois** → `npm run bench:coach` → comparer
`bucket` **global ET par rôle** (un gain sur un rôle peut casser un autre) →
garder ou annuler.

1. **Lire la « direction des ratés »**.
   - `too-defensive` élevé → le moteur sur-recommande armure / RM / antisoin /
     stase. Leviers, du plus fort au plus fin :
     `score.ts utilityScore` — bonus antisoin `moderate`, bonus « bouée »
     (`isSaveItem`, seuil `burstSeverity > …` et magnitude) ;
     `weights.ts` — modulations `enemyHealing` / `burstSeverity` sur `util` ;
     `weights.ts baseWeights` — poids `util` / `def` du profil concerné.
   - `too-greedy` élevé → l'inverse : remonter ces mêmes bonus, ou baisser
     `score.ts coreBuild` (nudge « continue ta courbe de carry ») et remonter
     `tempo.ts tempoWeight` (base `0.18`).
2. **Lire les « confusions »** pour cibler.
   - `ap-damage → *` trop fréquent → le moteur défaut trop sur le Bâton du néant :
     `damageOutputIndex` sur-valorise la pénétration magique, ou
     `representativeTarget` (mélange 65/35) donne trop de RM.
   - `ad-lethality → ad-bruiser` → les bruisers top sont profilés « assassin » :
     regarder `damageAxisKeys` (`tempo.ts`) et le profil de dégâts Meraki
     (`overrides.json` du pipeline statique).
   - `wrong-offense-axis` (crit ↔ létalité ↔ on-hit) → depuis A2.2,
     `damageOutputIndex` utilise les **vrais dégâts de sorts** ; un raté
     persistant = un sort mal parsé → regarder `getSpellDamage(slug)` et le
     parseur `src/main/staticdata/spell-damage.ts`.
3. **Regarder « champions les moins bien servis »** : les `0 %` récurrents sont
   souvent un profil de dégâts faux (Meraki / `overrides.json`) ou un champion
   absent du catalogue, pas un poids.
4. Quand le `bucket` global stagne (**~65 % atteint** ; c'est le plafond
   réaliste du proxy sans ratios de sorts), **figer 20-30 golden** avec
   `npm run freeze-scenario` puis re-`harvest` sur un autre échantillon avant de
   pousser — sinon on sur-apprend ces 143 parties.

Les paramètres (avec leur rôle) sont regroupés dans **`ENGINE-TUNING.md`**.
Pour dépasser 65 %, il faut un vrai modèle de dégâts de sorts — voir §« Ratios ».

## Ratios de sorts (A2.2 — fait)

Les ratios viennent de **Meraki `champions.json`**
(`abilities.{P,Q,W,E,R}[].effects[].leveling[].modifiers[]`) :

```
Syndra Q  →  75/110/145/180/215  +  60 % AP
Zed Q     →  80/120/160/200/240  + 100 % bonus AD
```

- `src/main/staticdata/spell-damage.ts` — `deriveSpellDamage()` parse ~1 effet
  de dégâts par slot ; **170/173 champions, 514 sorts** dans le snapshot
  (`snapshot.spellDamage`, +0,06 Mo). Unités gérées : `% AP`, `% bonus AD`,
  `% AD`, `% max/bonus HP`, `% target max/current/missing HP`, `% armor`, `% MR`,
  `% mana`. Le reste (ratios composés, DoT par tick, passifs exotiques) est
  ignoré → repli proxy pour ce sort.
- `src/shared/engine/model/spell-damage.ts` — `rotationDamage(abilities, atk,
  tgt)` = dégâts Q+W+E+R au rang du niveau, après résistances. `rankAtLevel`
  générique (R à 6/11/16, Q/W/E maxé ~12).
- `damageOutputIndex` (offense.ts) utilise ce calcul réel quand les ratios sont
  là (`opts.abilities`), sinon l'ancien proxy.
- **Régénérer** : `npm run staticdata` (relit Meraki, réécrit `snapshot.json`).

Ne couvre pas : cooldowns (donc pas de vrai DPS soutenu, seulement le burst
d'une rotation), les passifs, les multi-hits. Suffisant pour la comparaison
marginale d'items.

## Squelette de build (A4.3 — hybride)

`resources/builds.json` = par champion + rôle, les légendaires que les joueurs
Challenger achètent réellement (taux de pick + position d'achat moyenne). Le
moteur s'en sert comme *prior* de score ; l'heuristique reste la couche
d'override situationnel. **Génération, repli patch N-1, publication CI et
téléchargement client : voir `BUILDS.md`.** Constantes moteur :
`ENGINE-TUNING.md` §`build-prior.ts`.

### Mesurer l'apport au benchmark

```bash
BENCH_NO_BUILDS=1 npm run bench:coach   # moteur seul
npm run bench:coach                     # moteur + squelette
```

`bench:coach` n'évalue que les parties **au patch du snapshot** (les parties
N-1 laissées dans `bench/raw/` pour `npm run builds` sont ignorées ici).

⚠️ **In-sample** : si `builds.json` a été généré depuis les parties actuellement
dans `bench/raw/`, le gain est optimiste (le squelette « connaît » ces achats).
Vrai chiffre : `npm run builds`, `rm -rf bench/raw`, re-`harvest` un échantillon
**neuf**, `npm run bench:coach`.

## Notes

- **Pas de pass/fail par partie** : deux Challengers divergent (Kraken vs
  Shieldbow). On raisonne en *taux* sur le corpus et en catégories.
- Vrai pro (LCK/LEC) : les timelines minute par minute passent par un partenaire
  data licencié (Bayes/GRID). La soloqueue Challenger est le substitut pragmatique.
- Au changement de patch du snapshot : re-`harvest` et vider
  `test/fixtures/pro-scenarios/`.
- La clé Riot n'est **jamais** committée ni écrite sur disque.
