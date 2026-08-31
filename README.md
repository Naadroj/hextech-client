# Hextech Client

Client compagnon **externe** pour League of Legends. Il pilote uniquement l'API
locale **LCU** (REST + WebSocket) exposée par le client officiel : aucune
injection de DLL, aucune lecture/écriture mémoire, aucune modification de fichier
du jeu. Le client officiel continue de tourner normalement en arrière-plan.

## Stack

- **electron-vite** + **Electron** + **React** + **TypeScript**
- **Tailwind CSS v3** (thème Hextech)
- **Vitest** + Testing Library

## Scripts

```bash
npm install        # dépendances (télécharge le binaire Electron)
npm run dev        # lance l'app en développement (HMR)
npm run test       # tests unitaires
npm run typecheck  # vérification des types (main + renderer)
npm run lint       # ESLint
npm run build      # build de production dans out/
npm run assets     # (re)génère build/icon.png et build/tray.png
```

## Structure

| Chemin | Rôle |
| --- | --- |
| `src/main/` | Process principal Electron (fenêtre, IPC, systray, config) |
| `src/main/lcu/` | Cœur LCU : lockfile, credentials, REST, WebSocket, orchestrateur |
| `src/main/ipc/` | Surface IPC du pont LCU (liste blanche, relais d'événements) |
| `src/preload/` | Pont `contextBridge` sécurisé vers le renderer |
| `src/renderer/` | UI React (composants Hextech, vues) |
| `src/shared/` | Types et utilitaires partagés main ↔ renderer |
| `resources/` | Fichiers embarqués au runtime (`riotgames.pem`, SFX) |
| `test/` | Setup Vitest + fixtures (cert auto-signé pour les tests HTTPS) |

## Avancement (voir le plan de phases)

- [x] **Phase 0** — Fondations & outillage
- [x] **Phase 1** — Design System Hextech (Button, Panel, Modal, Divider, NavRail, TitleBar, Kitchen Sink)
- [x] **Phase 2** — Cœur LCU (lockfile, credentials, REST `node:https`, WebSocket WAMP, orchestrateur)
- [x] **Phase 3** — Pont IPC (`window.app.lcu`) : liste blanche d'endpoints (`read` = GET only), relais d'événements filtré, mutations sur canaux dédiés
- [x] **Phase 4** — Connexion & Statut joueur : vue Accueil (icône, niveau/XP, rang solo/flex), `StatusBadge`, systray, option « réduire le client officiel »
- [x] **Phase 5** — Lobby & Matchmaking : sélecteur de mode, création/départ de lobby, recherche de partie + chrono, modale **Ready Check** (Accepter / Décliner sur clic explicite), suivi `gameflow`
- [ ] **Phase 6** — Champ Select
- [ ] Phases 7 → 9

## Note OneDrive

Le dossier est synchronisé par OneDrive. Exclure `node_modules/`, `out/` et
`dist/` de la synchronisation (ou déplacer le projet hors OneDrive) pour éviter
les verrous de fichiers pendant les builds.
