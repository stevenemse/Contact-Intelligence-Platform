# Connecter Supabase à Contact Intelligence Platform

L'application est entièrement branchée sur Supabase (Auth + Postgres).
Tant que les clés ne sont pas configurées, les pages afficheront des erreurs
parce que la base n'existe pas encore. Suivez ces 5 étapes (~10 minutes, compte gratuit).

## 1. Créez le projet

1. Allez sur **https://supabase.com** → *Start your project* → **New project**.
2. Nom suggéré : `contact-intelligence`. Mot de passe de base : notez-le.
3. Région : la plus proche de vos utilisateurs (ex. `Frankfurt`).

## 2. Créez le schéma

1. Dans le menu, ouvrez **SQL Editor** → **New query**.
2. Copiez-collez **tout** le contenu du fichier [`supabase/schema.sql`](supabase/schema.sql) de ce projet.
3. Cliquez **Run**. Vous devriez voir `Success. No rows returned` puis les tables
   apparaissent dans **Table Editor** (organizations, contacts, contact_phones, ...).

## 3. Activez l'authentification e-mail

1. **Authentication → Providers → Email** : vérifiez qu'il est **Enabled**.
2. Pendant le développement, désactivez **Confirm email** pour tester
   immédiatement avec le mot de passe choisi (vous pourrez le réactiver plus tard).

## 4. Copiez les clés

Dans **Project Settings → API**, copiez :

| Variable .env.local | Valeur Supabase |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (secret) |

Remplacez les placeholders dans [`/.env.local`](.env.local) puis **redémarrez** `npm run dev`.

> ⚠️ La clé `service_role` ne quitte **jamais** le serveur : elle est uniquement
> lue dans les Server Components et Route Handlers (`lib/supabase/server.ts`).
> Ne l'ajoutez jamais en prefixe `NEXT_PUBLIC_`.

## 5. Vérifiez

1. Ouvrez http://localhost:3012/setup — la page de diagnostic doit indiquer
   « Configuration Supabase détectée ».
2. Créez un compte (**/register**) → l'onboarding vous demande le nom du
   workspace → **Créer l'espace** → Redirigé vers le **Dashboard**.
3. Importez un CSV (**/imports/new**), regardez les contacts, créez un tag,
   testez une fusion de doublons, générez un export.

## Dépannage

| Symptôme | Cause probable |
|---|---|
| `Supabase non configuré` sur toute action | Variables env manquantes ou serveur non redémarré |
| `relation "memberships" does not exist` | schema.sql n'a pas été exécuté (étape 2) |
| Connexion « Email ou mot de passe incorrect » | Provider Email désactivé ou « Confirm email » actif sans confirmation |
| Page `/setup` affiche les clés manquantes | Placeholders `VOTRE-...` non remplacés |
| Rien dans la carte mondiale | Importer des contacts avec pays renseigné |

## Sécurité (optionnel)

Les tables ont la RLS activée avec le client **service_role côté serveur**
(l'autorisation est faite applicativement par `requireOrg()` : le rôle
owner/admin/manager/member/viewer contrôle chaque route API).
Si vous exposez un jour des données au navigateur avec la clé anon, ajoutez
des policies RLS par organisation.
