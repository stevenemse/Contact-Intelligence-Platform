# Design — Refonte minimaliste (landing + dashboards) — 2026-10-26

## Intent (pourquoi)
La landing et l'espace connecté affichent aujourd'hui un design « carte partout » :
blocs arrondis à ombres douces, titres en Inter 900, dégradés de texte, sections
serrées. La référence visée (captures Stripe) est l'inverse : **peu de bruit,
beaucoup d'air, filets 1 px, grandes typographies, accents rares**. Objectif :
donner au produit ce niveau de finition sans toucher au contenu.

## Ce que le client a décidé
| Question | Décision |
|---|---|
| Périmètre | Landing publique + dashboards (espace connecté) |
| Palette | **Conserver l'accent actuel** |
| Amplitude | Refonte visuelle poussée (typo hero très grande, sections aérées, cartes plates à filets, plus d'ombres) |
| Contenu | **Style uniquement** : mêmes textes, même ordre des sections |
| Mode sombre | Pris en charge dès maintenant |
| Livraison | Lot 1 : landing (validation) → Lot 2 : dashboards |

## Réalité technique constatée (reconnaissance)
- `app/globals.css` : tokens clairs (`:root`), layout (`.app-shell`, `.main-area`, `.sidebar`), `.btn`, `.kpi-card`, `.section-title`, `.display-1`, `.feature-card`, `.landing-nav`, `.product-preview*`, formulaires, tableaux.
- `app/globals-part2.css` : checkboxes, chips, `dashboard-welcome`, `quick-action`, `preview-*`.
- `app/globals-part3.css` : overrides sidebar réduite + **mode sombre** (`html[data-theme='dark']`, 28 règles).
- `app/globals-part4.css` : tarifs/FAQ.
- `app/sidebar-admin.css` : pied de sidebar + habillage `/admin` (livré le 26/10).
- **Correction d'annonce** : l'accent réel est le **corail `#e85d4a`** (`--brand`), avec `--brand-deep #9f3328`, `--brand-light #ff8a72`. Le teal `#0d9488` cité dans l'en-tête du fichier et dans les noms de classes (`badge-teal`) est **mort**. Le vert forêt `#0d2621` reste la sidebar.
- La landing est structurée en : nav sticky · héro centré (max 860) · aperçu produit · bandeau stats · 6 features · CTA tarifs · CTA final · footer. **Aucune section ne sera ajoutée, retirée ni réordonnée.**

## Principes de la charte v4 (minimaliste)
1. **Le blanc domine.** Fond de page `#ffffff` en clair (aujourd'hui `#f4f6f5`) ; les zones fonctionnelles gardent un gris très léger. En sombre, fond `#0a0e0d`.
2. **Les filets remplacent les ombres.** Une carte = surface + `1px solid var(--border)`, rayon `12px`, **zéro ombre au repos** ; l'ombre n'apparaît plus qu'au survol (`--shadow-xs`) et sur les éléments flottants (menu, modal).
3. **La typographie porte la hiérarchie, pas les cadres.**
   - Hero : `clamp(44px, 7vw, 78px)`, weight 800, `letter-spacing: -.035em`, `line-height: 1.05`.
   - Titres de section : 30-34 px (aujourd'hui 22-26), weight 700.
   - Titres de carte : 15 px/700 inchangés, **libellés** à 12 px.
   - Rien au-delà de 800 : le 900 disparaît.
4. **Un seul accent, en plein.** Le dégradé sur `hero2` est remplacé par une couleur pleine (`--brand`), comme la phrase partielle de Stripe. Le corail ne sert plus qu'aux CTA, aux mots-clés et aux états actifs.
5. **Air vertical généreux.** Sections de landing : `padding-block: 96-120px` (aujourd'hui 60-80), marges entre blocs ×1,5.
6. **Échelle retenue** : rayons 12 px (aujourd'hui 10-14), `padding` de carte 20-24 px, boutons rayon 10 px.

## Lot 1 — Landing (à valider en aperçu)
- **Nav** : hauteur 72 px, fond blanc opaque, un seul filet bas, sans flou épais ; logo sans dégradé (marque pleine `--brand`).
- **Héro** : aligné **à gauche** dans un conteneur 1080, badge éventuellement retiré au profit d'une ligne de texte fine, sous-titre 18 px max-width 560, CTA primaire + secondaire alignés à gauche.
- **Aperçu produit** : encadré unique, filet 1 px, rayon 16, une seule ombre très légère au survol ; bandeau intérieur sans couleur marquée.
- **Stats** : supprimées en cartes → **rangée de chiffres libres** (valeur 34 px + libellé 12 px) séparée par des filets verticaux.
- **Features** : plus de cartes isolées → grille 3 colonnes sur fond blanc avec **filets de séparation** (continuité visuelle type Stripe), icône corail 20 px, titre 15, texte 14.
- **CTA final** : pleine largeur, fond `--bg-sunken`, filet haut, titre 32 px.
- **Footer** : filet haut, 12,5 px, rien d'autre.
- Mode sombre : mêmes règles sur tokens sombres.

## Lot 2 — Dashboards (après validation du lot 1)
- **Topbar** : blanc, filet bas, 64 px, sans `backdrop-filter`.
- **KPI** : filet 1 px, sans ombre, chiffre 28 px `font-variant-numeric: tabular-nums`, libellé 12 px muted, delta en corail/vert sobre.
- **Titres de section** : 15 px/700 + lien « Voir tout » corail 13 px (déjà en place).
- **Tableaux** : en-têtes 11 px uppercase letter-spacing .06em, lignes séparées par `--border-soft`, hover `rgba(13,38,33,.03)`, pas de zébrage.
- **Formulaires** : champs 42 px, filet 1 px, focus corail, pas d'ombre.
- **Sidebar** : conservée **verte forêt** (signature du produit), mais allégée — badges de rôle et pastilles moins saturés, filets plus discrets (décision soumise au client).
- **Cartes de page** (`kpi-card`, `glass-card`) : même traitement filet que le lot 1.

## Contraintes
- FR/EN intacts, aucun texte modifié, aucun ordre de section modifié.
- Accessibilité : contrastes ≥ 4,5:1 sur texte courant, focus visibles, `prefers-reduced-motion` conservé.
- Aucune dépendance ajoutée ; CSS seul, tokens partagés — les pages hors périmètre (pricing, login, admin) suivent mécaniquement sans réécriture.
- Vérification : `npm run lint` + `npm run build` verts, puis aperçu local (`npm run dev`, port 3000) pour revue visuelle.

## Non-goals / anti-goals
- Pas de nouveau contenu, de nouvelles sections, de refonte du copy.
- Pas de changement de palette d'accent (corail conservé).
- Pas de framework UI, pas de dépendance, pas de réécriture des composants métier.
- Pas de capture automatisée : cet environnement n'a pas de navigateur — la revue visuelle passe par l'aperçu local.

## Livrables
1. Ce document.
2. Lot 1 (landing) commité et poussé, revu en aperçu.
3. Lot 2 (dashboards) sur validation du lot 1.
4. Mise à jour de l'en-tête de `globals.css` (la mention « accent teal #0d9488 » devient « corail #e85d4a »).
