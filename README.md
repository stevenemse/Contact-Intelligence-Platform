# Contact Intelligence Platform (CIP)

Application web moderne de gestion de contacts : import CSV avec normalisation,
nettoyage, dédoublonnage, segments dynamiques (AND/OR/NOT), exports, cartes
mondiales, équipe multi-rôles et historique d'activité.

**Stack** : Next.js 16 (App Router, React 19) · Supabase (Auth + Postgres) ·
Tailwind CSS 4 · Recharts · libphonenumber · PapaParse · Zod.

## Démarrage rapide

```bash
npm install
npm run dev
```

Puis suivez [`SUPABASE-SETUP.md`](SUPABASE-SETUP.md) pour créer et connecter la base
(5 étapes, ~10 min). L'app tourne ensuite sur http://localhost:3012.

## Architecture

```
app/
  (app)/                 # espace protégé (dashboard, contacts, doublons, segments…)
  api/                   # Route Handlers : auth, contacts, phones, emails, tags,
                         # custom-fields, segments(+count), duplicates/merge,
                         # imports, exports/run, team, settings, onboarding
  login/ register/ reset/ onboarding/ setup/
components/               # UI cliquable (tables, wizards, builders, managers)
lib/
  supabase/
    server.ts             # client SSR (cookies) + client service-role
    org-context.ts        # requireOrg() : user + org + rôle (owner/admin/…)
    data.ts               # requêtes SQL typées (contacts, phones, emails, tags)
    segment-engine.ts     # moteur de règles AND/OR/NOT partagé
supabase/schema.sql       # schéma complet à exécuter une fois dans le SQL Editor
```

## Modèle de données (Postgres)

- `organizations` + `memberships` (rôles) → isolation multi-tenant par `organization_id`
- `contacts` + `contact_phones` / `contact_emails` / `contact_tags` + `tags`
- `custom_fields`, `segments` (règles jsonb), `import_batches`, `export_runs`
- `activity_logs`, `merge_logs`, `contact_changes` (audit complet)

## Rôles

| Rôle | Permissions |
|---|---|
| owner | tout (immodifiable/irretirable) |
| admin | gestion équipe + données |
| manager | lecture + analyses + exports |
| member | manipulation des contacts |
| viewer | lecture seule |

## Scripts

```bash
npm run dev     # serveur de développement
npm run build   # build production
npm run lint    # ESLint
```
