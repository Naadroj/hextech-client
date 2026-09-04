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

Champion, rôle, niveau, or, items des 10 joueurs, menace, l'item contesté, la
catégorie optionnelle, la version de l'app et le patch — plus un **UUID
d'installation anonyme**. Aucun pseudo, aucun Riot ID, aucun puuid.

Activé par défaut ; interrupteur dans **Réglages → Signalements**. Le clic écrit
d'abord dans une file locale (`%APPDATA%/hextech-client/feedback/pending.jsonl`)
— il ne dépend jamais du réseau — puis l'envoi part au lancement et toutes les
5 min, par lots idempotents.

## Mise en place Supabase (une fois)

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
  reason_code    text,
  had_skeleton   boolean not null,
  skeleton_games int,
  snapshot       jsonb not null
);
create index on feedback (champion, role);
create index on feedback (created_at desc);

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

```bash
# Build local — .env à la racine (gitignoré), ou variables du shell
HEXTECH_SUPABASE_URL=https://xxxx.supabase.co HEXTECH_SUPABASE_ANON_KEY=eyJhbGci... npm run dist
```

En CI, deux **secrets de dépôt** du même nom : le workflow `release` les passe
déjà au build. **Sans ces variables, l'app se construit quand même** — l'envoi
est simplement inerte et les signalements s'empilent en local.

Pour vérifier qu'un build les a bien reçues :
```bash
grep -o "supabase.co" out/main/index.js
```

## Traiter les signalements

```bash
# .env : SUPABASE_URL + SUPABASE_SERVICE_KEY (clé de service, jamais embarquée)
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
