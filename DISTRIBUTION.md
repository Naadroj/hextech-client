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
- **Aucune télémétrie**, aucun compte, aucun backend applicatif. Requêtes
  sortantes, toutes en GET anonyme : CDN publics **Data Dragon** / **Meraki
  Analytics** (catalogue), et **GitHub Releases** (le `builds.json` pré-agrégé).
  Aucune donnée du joueur n'est envoyée. Coupe le réseau → l'app reste
  fonctionnelle avec le snapshot et le `builds.json` embarqués.
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
- **Pas de mise à jour automatique** (electron-updater = phase ultérieure) :
  pour mettre à jour, re-télécharger et relancer l'installateur.
- **Electron 33** est en retard sur les versions LTS (`npm audit`). Bump prévu
  en phase de durcissement ; les vulnérabilités signalées sont dans des
  dépendances **de build** (electron-builder), pas dans l'app livrée.
- Le moteur d'itémisation est **heuristique** (pas de données de win rate
  agrégées) : il raisonne sur les stats d'items + l'état de la partie, avec la
  justification chiffrée affichée pour que tu juges. À calibrer avec de vraies
  parties.
