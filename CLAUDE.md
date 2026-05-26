# CLAUDE.md — Plateforme de tournois de hockey

Ce fichier est relu à chaque session. Il contient les conventions durables du projet.
La spécification complète du produit vit dans `CAHIER_DE_CHARGES.md` — la lire avant toute décision de conception.

## Nature du projet
Application web de création et de gestion de tournois de hockey mineur québécois : configuration, génération d'horaire par optimisation sous contraintes (OR-Tools CP-SAT), saisie de scores en direct, génération automatique des rondes éliminatoires.

## Stack
- Frontend / hébergement : Next.js 16 (App Router), déployé sur Vercel via GitHub.
- Backend / base de données : Neon (PostgreSQL serverless) + Clerk (Auth) avec intégration Neon Authorize pour la RLS native de PostgreSQL.
- Moteur d'optimisation : OR-Tools CP-SAT (Python), hébergé sur Modal.com.
- Design : Tailwind CSS v4, shadcn/ui.

## Principes de conception non négociables
- Utilisateur cible : bénévole d'association de hockey, peu technophile, qui monte un tournoi 1 à 2 fois par an. L'outil doit être d'une facilité déconcertante.
- Tout ce qui pourrait être une contrainte doit être paramétrable.
- Valeurs par défaut intelligentes partout (conventions Hockey Québec). Un organisateur pressé doit pouvoir tout accepter et obtenir un horaire valide.
- Conception « on ne peut pas se tromper » : validation en temps réel, impossible de soumettre un état incohérent.
- Toujours offrir une prévisualisation avant une opération lourde.

## Méthode de travail
- Livrer en jalons démontrables (voir `CAHIER_DE_CHARGES.md`). À chaque jalon, l'app doit tourner et être inspectable.
- Avant de coder une fonctionnalité majeure, expliquer brièvement l'approche retenue et les décisions de conception qui méritent validation.
- Maintenir un module de validation indépendant (`src/lib/validators/schedule.ts`) qui vérifie a posteriori qu'un horaire respecte toutes les contraintes, sans faire confiance au moteur.

## Commandes utiles
- Installation : `pnpm install`
- Développement local : `pnpm dev`
- Compilation (build) : `pnpm build`
- Linter : `pnpm lint`
- Générer les migrations Drizzle : `pnpm drizzle-kit generate`

## Architecture des dossiers
- `solver/` : Code Python du solveur (Modal.com)
  - `main.py` : Logique de planification OR-Tools CP-SAT (stub v1)
  - `modal_app.py` : Configuration de l'application serverless Modal
- `src/app/` : Routes Next.js (App Router)
  - `tournaments/` : Tableau de bord et assistant de configuration (sécurisés par Clerk)
  - `page.tsx` : Page d'accueil publique (vitrine premium)
- `src/components/` : Composants UI (Dialogs, inputs, tables shadcn/ui)
- `src/lib/` : Modules utilitaires
  - `auth/clerk.ts` : Helpers d'authentification Clerk (serveur)
  - `db/` : Client Neon (`client.ts`) et schéma Drizzle (`schema.ts`)
  - `solver-client/` : Client TypeScript d'appel au solveur Modal
  - `validators/schedule.ts` : Validateur indépendant des contraintes d'horaires
- `drizzle/` : Fichiers SQL de migration de schéma et de RLS
- `docs/` : Contrats d'API et spécifications de communication

## Contrats d'interface & Schéma de données
- Les contrats d'API JSON détaillés du solveur sont documentés dans [docs/contracts.md](file:///c:/Users/EtienneGrandmont/Desktop/Projets/gestion-horaires-v2/docs/contracts.md).
- Le schéma de données PostgreSQL est défini dans [src/lib/db/schema.ts](file:///c:/Users/EtienneGrandmont/Desktop/Projets/gestion-horaires-v2/src/lib/db/schema.ts).
- Les politiques RLS (Row-Level Security) via Neon Authorize sont définies dans le fichier de migration [drizzle/0001_rls.sql](file:///c:/Users/EtienneGrandmont/Desktop/Projets/gestion-horaires-v2/drizzle/0001_rls.sql).

## Conventions de français québécois (tout contenu visible : UI, libellés, messages, exports)
- Pas de virgule avant « et » (pas de virgule d'Oxford).
- Pas de majuscule à chaque mot dans les titres ; seul le premier mot prend la majuscule.
- Terminologie québécoise : aréna, glace, créneau, pool (et non poule), ronde préliminaire, ronde éliminatoire, fusillade, franc-jeu, départage.
