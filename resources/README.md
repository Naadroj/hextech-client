# resources/

Fichiers embarqués dans l'application au runtime (copiés via `extraResources`
lors du packaging — Phase 9).

## `riotgames.pem` (optionnel mais recommandé)

Certificat racine publié par Riot pour valider la chaîne TLS de la LCU.

- **Présent** → le client REST et le WebSocket valident le certificat de façon
  stricte (`rejectUnauthorized: true`, `ca: riotgames.pem`).
- **Absent** → repli sur `rejectUnauthorized: false`. L'hôte étant toujours
  `127.0.0.1`, le risque reste nul, mais la validation stricte est préférable.

Le fichier n'est volontairement pas versionné ici. Pour l'ajouter :

```bash
# À récupérer depuis le dépôt officiel lol-status / la doc communautaire LCU
curl -o resources/riotgames.pem https://static.developer.riotgames.com/docs/lol/riotgames.pem
```

Le code (`src/main/lcu/`) détecte automatiquement la présence du fichier :
aucune configuration supplémentaire.

## `sfx/` (Phase « polish »)

Effets sonores Hextech (clic, survol, ready-check). À venir.
