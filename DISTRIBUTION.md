# Distribution — Hextech Client

Notes pour builder l'application et la partager à des amis.

## Builder l'installateur

```bash
npm ci                 # dépendances (télécharge le binaire Electron)
npm run staticdata     # (optionnel) régénère resources/staticdata/snapshot.json au dernier patch
npm run build          # compile main + preload + renderer dans out/
npm run dist           # produit dist/Hextech Client Setup <version>.exe (NSIS x64)
```

`npm run pack` produit une version **décompressée** dans `dist/win-unpacked/`
(rapide, pour vérifier le packaging sans générer l'installateur).

Config : `electron-builder.yml`. L'installateur est **NSIS**, par utilisateur
(pas besoin d'admin), avec choix du dossier + raccourcis Bureau / menu Démarrer.

## Publier une mise à jour

```bash
npm version patch        # bump package.json + crée le tag vX.Y.Z
git push --follow-tags   # déclenche le workflow `release`
```

Le workflow construit l'installeur sous Windows et le publie en **GitHub
Release**, avec `latest.yml` (métadonnées lues par l'updater) et le `.blockmap`
(téléchargement différentiel). Lien à partager :
`https://github.com/Naadroj/hextech-client/releases/latest`.

Côté app, `electron-updater` ([updater.ts](src/main/updater.ts)) lit ce
`latest.yml`, compare à la version installée, télécharge et applique au
redémarrage. **Réglages → Mises à jour** : vérifier, télécharger (avec
progression), installer. Trois choix à connaître :

- **Vérification manuelle**, jamais au démarrage — pas de requête réseau non
  sollicitée. Le revers est en « Limites connues ».
- **`autoDownload = false`** : on demande avant de consommer la bande passante.
- **`autoInstallOnAppQuit = true`** : une mise à jour téléchargée mais non
  installée s'applique à la fermeture suivante.

Inerte hors application packagée (`app.isPackaged`) : en développement il n'y a
pas d'`app-update.yml`, l'écran affiche « disponible uniquement dans la version
installée ». **Conséquence : la seule façon de tester la chaîne est d'installer
une version, d'en publier une plus récente, et de cliquer.**

⚠️ `electron-updater` est **CommonJS** : l'importer par défaut puis
déstructurer. Un import nommé fait planter l'app *packagée* au démarrage, sans
rien casser en dev.

## Ce qui est embarqué

`extraResources` copie sous `resources/` de l'app installée :

| Fichier | Rôle |
| --- | --- |
| `staticdata/snapshot.json` | Catalogue Data Dragon + Meraki (items, champions, profils de dégâts) du patch au moment du build. **L'app fonctionne hors ligne avec ce snapshot** et le rafraîchit toute seule au lancement si un patch plus récent est publié (écrit dans `%APPDATA%/hextech-client/staticdata/`). |
| `builds.json` | Squelette de build hi-elo par champion + rôle (items cœur + ordre), pré-agrégé par la CI depuis la soloqueue Challenger. Repli hors ligne ; l'app télécharge une version fraîche (patch courant) depuis une Release GitHub au lancement, en cache dans `%APPDATA%/hextech-client/`. **Aucune clé Riot côté client.** |
| `riotgames.pem` *(optionnel, absent par défaut)* | Active la validation TLS stricte du LCU. Sans lui, l'app tolère le certificat auto-signé **uniquement sur `127.0.0.1`** (surface d'attaque nulle). |
| `tray.png` | Icône de la zone de notification. |

## Posture

- **Aucune injection**, aucune lecture/écriture mémoire, aucune modification de
  fichier du jeu. L'app lit seulement les API **locales** du client :
  - **LCU** (REST + WebSocket, port du lockfile) — profil, lobby, champ select ;
  - **Live Client Data API** (`https://127.0.0.1:2999`) — état de la partie en cours.
- **Aucun compte, aucune télémétrie passive.** Requêtes sortantes en GET
  anonyme : CDN publics **Data Dragon** / **Meraki Analytics** (catalogue) et
  **GitHub Releases** — pour le `builds.json` pré-agrégé, et pour la recherche
  de mise à jour, celle-ci **uniquement sur clic** dans les Réglages. Coupe le
  réseau → l'app reste fonctionnelle avec le snapshot et le `builds.json`
  embarqués.
- **Une seule donnée sort de l'app, et seulement sur action explicite** : le
  bouton **bug** de l'overlay enregistre un *signalement* « cet item n'est pas
  cohérent » **en local**, et l'onglet **Signalements** de l'app l'envoie sur
  clic explicite — il n'y a aucun vidage automatique. Le rapport porte l'état de
  la partie (champions, items, niveaux, or), le fil des propositions de cette
  partie-là et un **UUID d'installation anonyme** ; aucun pseudo, aucun
  identifiant Riot. Désactivable dans **Réglages → Signalements**. Détail
  complet et schéma de la table : `FEEDBACK.md`.
- L'**historique des propositions** (20 dernières parties, dans
  `%APPDATA%/hextech-client/history/`) est **purement local** : il se lit dans
  l'onglet Coach et ne part sur le réseau que s'il est joint à un signalement,
  c'est-à-dire jamais sans un clic sur ☟.
- L'**overlay in-game** est une simple fenêtre Electron transparente toujours
  au-dessus — **aucune injection, aucun hook**, elle lit les mêmes données
  locales que le reste de l'app. Elle laisse passer les clics vers le jeu sauf
  au survol de la carte. Nécessite League en mode **Sans bordure** (le plein
  écran exclusif passe devant toute fenêtre). Activé par défaut, en mode réduit
  (icône du prochain item seule) ; la flèche déplie le détail.
- Toutes les actions LCU (accepter un ready-check, pick/ban, etc.) restent
  derrière un **clic explicite** — jamais d'automatisation par timer.
- Le Coach ne fait **que conseiller** : il n'achète rien, ne touche pas à
  l'inventaire.

## Robustesse

- **Client League non lancé** → l'app attend (badge de statut), les vues
  affichent un message d'attente.
- **Pas de partie en cours** → le Coach affiche « Aucune partie en cours ».
- **Snapshot périmé** (patch plus récent, champions inconnus) → le moteur
  dégrade proprement (profil de repli) et le Coach affiche un bandeau
  « catalogue en cours de mise à jour ». Le rafraîchissement auto corrige au
  prochain lancement.

## Limites connues

- **Installateur non signé** → Windows SmartScreen affiche « Éditeur inconnu »
  au premier lancement : *Informations complémentaires → Exécuter quand même*.
  La signature de code (certificat EV) est une étape ultérieure.
- **Vérification des mises à jour à la demande, pas au démarrage** : l'app ne
  contacte GitHub que si on clique dans les Réglages. Volontaire — aucune
  requête réseau non sollicitée au lancement —, mais quelqu'un qui n'ouvre
  jamais les Réglages peut rester sur une version ancienne.
- **Electron 33** est en retard sur les versions LTS (`npm audit`). Bump prévu
  en phase de durcissement ; les vulnérabilités signalées sont dans des
  dépendances **de build** (electron-builder), pas dans l'app livrée.
- Le moteur d'itémisation est **heuristique** (pas de données de win rate
  agrégées) : il raisonne sur les stats d'items + l'état de la partie, avec la
  justification chiffrée affichée pour que tu juges. À calibrer avec de vraies
  parties.
