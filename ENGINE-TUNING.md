# Paramètres réglables du moteur Coach

Tout le moteur de recommandation est **déterministe** : sa qualité tient à une
poignée de constantes. Régler = boucle `npm run bench:coach` (voir `BENCH.md`).
Chaque changement doit garder les tests verts (`npx vitest run src/shared/engine`).

---

## `src/shared/engine/recommend/weights.ts` — pondération des sous-scores

### `baseWeights(roles)` — poids de base par profil (somme = 1)

| profil | offense | defense | utility | costEff | quand l'ajuster |
| --- | --- | --- | --- | --- | --- |
| `carry` (MARKSMAN/ASSASSIN/BURST/MAGE solo) | **0.55** | 0.20 | 0.15 | 0.10 | bot/mid `too-defensive` → ↑offense |
| `tank` (TANK/VANGUARD/WARDEN) | 0.12 | **0.53** | 0.25 | 0.10 | tank `too-greedy` → ↑defense |
| `utilitaire` (ENCHANTER, mage-support) | 0.10 | 0.22 | **0.58** | 0.10 | support faible = **structurel** (pas de notion d'item d'enchanteur), pas un poids |
| `combattant` (JUGGERNAUT/DIVER/FIGHTER) | **0.40** | 0.35 | 0.15 | 0.10 | **top faible** → ↑offense (0.40→0.48), ↓util |

### `contextWeights()` — modulations (ajouts avant renormalisation)

| trigger | effet | levier `too-defensive` |
| --- | --- | --- |
| `behindHard` | ce +0.08, def +0.05, off −0.13 | — |
| `aheadHard` | off +0.10, def −0.10 | ↑ l'offense si l'avance n'est pas exploitée |
| `beingFocused` | def +0.16, off −0.16 | ↓ à +0.10 si trop défensif |
| `threat.burst > 0.55 && carry` | def +0.10, off −0.10 | ↓ |
| `enemyHealing === 'heavy'` | util +0.14 | ↓ |
| `enemyHealing === 'moderate'` | util +0.07 | ↓ (déjà baissé) |
| `enemyHardCC` | util +0.20 | garder haut (QSS = build-defining) |
| `+ 0.16 * burstSeverity` | util | **principal levier `too-defensive`** → 0.16 → 0.10 |

---

## `src/shared/engine/recommend/score.ts`

### `utilityScore(item, a)` — bonus situationnels (plafonné à 1.6)

| condition | bonus actuel | note |
| --- | --- | --- |
| antisoin + `enemyHealing === 'heavy'` | +1.1 | garder |
| antisoin + `moderate` | **+0.35** | baissé de 0.7 → a fait `antiheal → crit` |
| QSS + `enemyHardCC` | +1.1 | garder |
| « bouée » (stase/lifeline) + `burstSeverity > 0.45` OU `beingFocused` | **+0.25 + 0.6·max(severity, 0.45)** | seuil 0.25→0.45 et magnitude baissés → a réglé `stasis → dégâts` |
| mana + `isManaConstrained` | +0.4 | — |
| adéquation résistance (`threat.physical/magic ≥ 0.5`) | 0.15 + 0.7·(part−0.5)/0.5, ×1.5 si burst | ↓ le ×1.5 si `mr/armor` sur-recommandés |
| anti-auto-attaque (`AA_PUNISH_IDS`) | +0.45 | — |

### amortisseur d'offense + `coreBuild`

| constante | valeur | rôle |
| --- | --- | --- |
| `KNEE` | **0.7** | au-delà, gain d'offense × 0.7. ↑ vers 0.8 si `too-defensive` persiste sur les carries |
| `coreBuild` | **+0.2 · onAxis** si carry & `burstSeverity < 0.5` & pas de CC/soin-lourd/focus/retard & `< 5` items & `onAxis ≥ 0.45` | nudge « continue tes items de dégâts ». ↑ le facteur ou desserrer les gardes si carries encore `too-defensive` |

### `DEFENSIVE_SAVE_IDS` / `AA_PUNISH_IDS`

Petites listes d'ids curées (GA, Sablier, Maw, Hexdrinker… / Randuin, Cœur gelé,
Épines). À compléter au fil des patchs.

---

## `src/shared/engine/recommend/tempo.ts` — coût d'opportunité

| constante | valeur | rôle |
| --- | --- | --- |
| `tempoWeight` base | **0.18** | ↑ → le moteur préfère rester sur l'axe de dégâts (`too-greedy` ↓ mais attention aux vrais achats défensifs) |
| `phaseFactor` | 1 (<900 s) / 0.75 (<1500) / 0.5 | — |
| `itemFactor` | 1 (≤1 item) … 0.45 (≥4) | — |
| `leadFactor` | 1.1 ahead / 0.6 behind / 1.0 | biais **neutre** (consigne utilisateur) |
| `damageAxisKeys()` | MAGIC / MARKSMAN / BRUISER selon profil | si `ad-lethality → ad-bruiser` : l'axe BRUISER n'inclut pas `health` → un bruiser ne « voit » pas Trinity comme sur-axe |

---

## `src/shared/engine/recommend/build-prior.ts` — squelette de build hi-elo (A4.3)

Prior additif au score : bonus quand l'item candidat est dans le build que les
joueurs Challenger achètent réellement sur ce champion + rôle
(`resources/builds.json`, régénéré par `npm run builds`). Corrige les cas que le
modèle de stats ne peut pas deviner (Nasus → accélération avant tank).

| constante | valeur | rôle |
| --- | --- | --- |
| `BUILD_MIN_GAMES` | **5** | sous ce nombre d'échantillons pour le couple champion+rôle → prior ignoré (repli 100 % heuristique) |
| `BUILD_W_CORE` | **1.7** | poids d'un item `core` à l'ordre parfait (× `pickRate` × facteur d'ordre). ↑ → le squelette pèse plus lourd face aux triggers situationnels ; ↓ → l'heuristique reprend la main |
| `BUILD_W_SITUATIONAL` | **0.45** | poids d'un item vu mais sous le seuil `core` (× `pickRate`, sans signal d'ordre) |
| `BUILD_W_BOOTS` | **0.8** | poids des bottes du squelette (× `pickRate`) |
| `BUILD_SLOT_TOLERANCE` | **2.5** | largeur (en slots de légendaire) de la fenêtre d'ordre autour de `avgSlot` ; hors fenêtre le facteur décroît |
| `BUILD_MIN_ORDER_FACTOR` | **0.3** | plancher du facteur d'ordre — un item core reste favorisé même acheté « hors moment » |

Génération, repli patch N-1, CI et téléchargement client : **`BUILDS.md`**.
A/B au benchmark : `BENCH_NO_BUILDS=1 npm run bench:coach` mesure le moteur sans prior.
**Attention sur-apprentissage** : bencher sur les mêmes parties que celles ayant
servi à générer `builds.json` est *in-sample* — re-moissonner un échantillon
neuf pour le vrai chiffre (voir `BENCH.md`).

---

## `src/shared/engine/recommend/target.ts`

`representativeTarget()` : **65 %** cible la plus tuable + **35 %** moyenne équipe
ennemie. ↑ la part « moyenne » (→ 50 %) crédite plus la pénétration
(`ap-damage → tank` / `ad-lethality` sous-utilisés).

---

## `src/shared/engine/context/threat.ts` & `triggers.ts`

| constante | valeur | rôle |
| --- | --- | --- |
| `ROLE_DAMAGE_WEIGHT` | table (carry 1.0 … enchanteur 0.3) | poids de menace d'un rôle |
| `baseDamageWeight` | `0.6·max + 0.4·moy` des poids de rôle | adoucit les bruiser-mages |
| menace = `poids · (1 + fed·0.35)` | `0.35` | influence des ennemis fed sur la menace |
| `computeBurstSeverity` | `aheadFactor(fed/1.8) · kitDanger(0.35 + 0.35·role + 0.3·burst) + 0.15·fragilité` | **cœur du `too-defensive`** : si trop d'items défensifs sortent, baisser `kitDanger` ou exiger plus d'`aheadFactor` |

---

## Hors moteur : le profil de dégâts

`src/main/staticdata/overrides.json` (pipeline A1) — si un champion est
systématiquement mal servi (`bucket 0 %` récurrent) et que le rôle est correct,
c'est souvent son **profil de dégâts** (part phys/mag/vrai) qui est faux :
ajouter une entrée d'override. Voir la mémoire `hextech-client-phasing` §A1.
