# Design — SaaS solide : i18n complet, Pricing, Stripe, Admin (2026-10-23)

## Intent (pourquoi)
Transformer Contact Intelligence Platform en SaaS vendable :
- une présentation claire de la valeur (pricing 4 plans),
- un encaissement fiable (Stripe),
- un pilotage interne (dashboard admin des abonnements),
- une expérience bilingue FR/EN **partout**, y compris la landing,
- thème jour/nuit accessible depuis la landing aussi.

## État du code (analyse)
- i18n : `lib/i18n/dictionaries.ts` ne couvre que nav / dash / contacts / auth / landing (partiel) / common. La majorité du contenu des pages est en français codé en dur. Provider client déjà en place (`useI18n`), cookie `locale` lu côté serveur dans `app/(app)/layout.tsx`.
- Plans : `organizations.plan` (défaut `free`) + `contact_quota` (défaut 5000) existent dans `supabase/schema.sql` ; rôle via `memberships.role` (owner/admin/manager/member/viewer) ; `requireOrg()` expose `orgPlan` et `quota`.
- Billing : **rien** (aucune mention Stripe, pas de table d'abonnement, pas de route billing).
- Thème : `data-theme` + ThemeToggle déjà dans la sidebar ; la landing a déjà les styles dark mais pas le bouton.

## Principes de conception
1. **Source unique des plans** : `lib/plans.ts` définit FREE/STARTER/BUSINESS/ENTERPRISE (quota contacts, sièges, features flags, prix) — utilisé par la page pricing, les gardes de quota, l'admin et le webhook Stripe.
2. **i18n sans refonte** : on étend le dictionnaire par section de page et on fait passer `t` (calculé côté serveur depuis le cookie `locale`) aux pages ; les composants client restent sur `useI18n()`. Aucune routing `/fr` `/en` (cookie, comme aujourd'hui).
3. **Stripe = vérité du paiement, Supabase = vérité applicative** : le webhook Stripe met à jour `organizations.plan/contact_quota/subscription_*` ; l'admin peut forcer un plan manuellement (grant) — la table `plan_changes` trace chaque changement.

## Phase 1 — i18n complet + landing (bilingue, jour/nuit)
- Dictionnaire étendu : `imports`, `exports`, `segments`, `map`, `team`, `settings`, `duplicates`, `tags`, `fields`, `activity`, `pricing`, `billing`, `admin`, `notFound`.
- Passage des textes des 22 pages vers `t.*` (serveur : cookie ; client : useI18n).
- Landing : traduction complète (nav, hero, features, pricing teaser, FAQ, footer) + **LanguageToggle** (réutilisable, aussi dans la sidebar) + **ThemeToggle** dans la landing-nav.
- Auth (login/register/reset), onboarding, setup, 404.

## Phase 2 — Page /pricing (publique)
- 4 cartes de plans + tableau comparatif + FAQ + CTA (session absente → `/register?plan=X` ; session présente → checkout).
- Mes défauts de plans (**mes choix, à valider**) :
  | Plan | Contacts | Sièges | Points forts | Prix (proposition) |
  |---|---|---|---|---|
  | Free | 1 000 | 1 | import CSV, dédoublonnage, exports | 0 |
  | Starter | 10 000 | 3 | + segments, carte mondiale, tags illimités | 9 900 FCFA/mois (~15 €) |
  | Business | 50 000 | 10 | + champs perso illimités, exports segmentés, support prioritaire | 24 900 FCFA/mois (~38 €) |
  | Entreprise | Illimité | Illimité | + SSO, SLA, onboarding dédié, facturation annuelle | Sur devis (contact) |
  - Annuel = 2 mois offerts. Devise à trancher (question 2).

## Phase 3 — Stripe (encaissement)
- Service : **Stripe** (SDK officiel `stripe` + checkout hébergé + customer portal).
- Env requises : `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` (optionnel ici), `STRIPE_WEBHOOK_SECRET`.
- Migration SQL (à exécuter dans Supabase) :
  ```sql
  alter table organizations add column if not exists stripe_customer_id text,
    add column if not exists subscription_status text default 'none',
    add column if not exists current_period_end timestamptz,
    add column if not exists billing_email text;
  create table if not exists plan_changes (
    id uuid primary key default gen_random_uuid(),
    organization_id uuid not null references organizations(id) on delete cascade,
    from_plan text, to_plan text not null,
    source text not null check (source in ('stripe','admin','import')),
    actor_email text,
    created_at timestamptz not null default now()
  );
  create index if not exists plan_changes_org_idx on plan_changes(organization_id);
  ```
- Routes :
  - `POST /api/billing/checkout` — crée une Checkout Session (price du plan cible, customer réutilisé), redirige Stripe.
  - `POST /api/billing/webhook` — `checkout.session.completed`, `customer.subscription.updated/deleted` → maj `organizations` + insert `plan_changes(source='stripe')`. Signature vérifiée.
  - `POST /api/billing/portal` — renvoie vers le portail client (changer de carte, annuler).
- Page `/settings/billing` (owner/admin) : plan actuel, statut, renouvellement, boutons Changer de plan / Gérer la facturation.
- **Garde de quota** : à l'import et à l'ajout de contact, si `count >= contact_quota` → écran « quota atteint » avec CTA `/pricing`.

## Phase 4 — Dashboard admin (super-admin)
- Accès : liste d'emails super-admins dans la variable d'environnement `SUPER_ADMIN_EMAILS` (initialement `steveemse@gmail.com`), vérifiée côté serveur sur chaque route `/admin` et `/api/admin/*`.
- `/admin` : table des organisations (nom, plan, statut d'abonnement, contacts utilisés / quota, période courante), recherche, tri.
- Actions sur une org : **changer le plan** (menu 4 plans + statut manuel) → update DB + `plan_changes(source='admin', actor=moi)`. Le grant manuel ne touche pas Stripe (utile pour offres, essais, exceptions).
- Détail org : historique `plan_changes`, membres, dernier import.
- Bouton « Voir admin » ajouté à la sidebar seulement pour les super-admins.
- **Ton compte** : via `/admin`, passer l'organisation de steveemse@gmail.com en `enterprise` (statut `manual_grant`).

## Non-goals (pour l'instant)
- Factures PDF / numérotation fiscale, TVA automatique, multi-devises, proration personnalisée, marketplace d'intégrations.

## Décisions validées (2026-10-23)
- Prix en **euros** : Starter 15 €/mois (150 €/an), Business 38 €/mois (380 €/an), annuel = 2 mois offerts.
- **Entreprise** : sur devis (CTA contact, pas de checkout) — attribution manuelle via l'admin.
- **Free** : 1 000 contacts, 1 siège.
- **Admin** : réservé au propriétaire (liste `SUPER_ADMIN_EMAILS`, défaut stevenemse@gmail.com).
- **Stripe** : compte à créer — tout le parcours est livré en mode « dégradé propre » (messages de setup) et s'active dès que STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / STRIPE_PRICE_STARTER / STRIPE_PRICE_BUSINESS sont définis.

## Ordre d'exécution
1 → 2 (tout statique, livrable immédiat) → 3 (nécessite les clés Stripe) → 4 (nécessite la migration SQL + SUPER_ADMIN_EMAILS).
