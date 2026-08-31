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
```

## Structure

| Chemin | Rôle |
| --- | --- |
| `src/main/` | Process principal Electron (fenêtre, IPC, futur cœur LCU) |
| `src/preload/` | Pont `contextBridge` sécurisé vers le renderer |
| `src/renderer/` | UI React (composants Hextech, vues) |
| `src/shared/` | Types et utilitaires partagés main ↔ renderer |
| `test/` | Setup Vitest |

## Avancement (voir le plan de phases)

- [x] **Phase 0** — Fondations & outillage
- [x] **Phase 1** — Design System Hextech (Button, Panel, Modal, Divider, NavRail, TitleBar, Kitchen Sink)
- [ ] **Phase 2** — Cœur LCU (lockfile, credentials, REST, WebSocket)
- [ ] Phases 3 → 9

## Note OneDrive

Le dossier est synchronisé par OneDrive. Exclure `node_modules/`, `out/` et
`dist/` de la synchronisation (ou déplacer le projet hors OneDrive) pour éviter
les verrous de fichiers pendant les builds.
