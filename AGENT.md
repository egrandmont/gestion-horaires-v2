# CLAUDE.md — Plateforme de tournois de hockey

Ce fichier est relu à chaque session. Il contient les conventions durables du projet.
La spécification complète du produit vit dans `CAHIER_DE_CHARGES.md` — la lire avant toute décision de conception.

## Nature du projet
Application web de création et de gestion de tournois de hockey mineur québécois : configuration, génération d'horaire par optimisation sous contraintes (OR-Tools CP-SAT), saisie de scores en direct, génération automatique des rondes éliminatoires.

## Stack
- Frontend / hébergement : Next.js (App Router), déployé sur Vercel via GitHub.
- Backend / base de données : Supabase (PostgreSQL, Auth, RLS, Realtime).
- Moteur d'optimisation : OR-Tools CP-SAT (Python). NE PAS utiliser d'heuristique maison ; le moteur doit être CP-SAT.
- Design : utiliser le skill `frontend-design` pour toute l'interface.

## Principes de conception non négociables
- Utilisateur cible : bénévole d'association de hockey, peu technophile, qui monte un tournoi 1 à 2 fois par an. L'outil doit être d'une facilité déconcertante.
- Tout ce qui pourrait être une contrainte doit être paramétrable.
- Valeurs par défaut intelligentes partout (conventions Hockey Québec). Un organisateur pressé doit pouvoir tout accepter et obtenir un horaire valide.
- Conception « on ne peut pas se tromper » : validation en temps réel, impossible de soumettre un état incohérent.
- Toujours offrir une prévisualisation avant une opération lourde.

## Méthode de travail
- Livrer en jalons démontrables (voir section 11 du cahier). À chaque jalon, l'app doit tourner et être inspectable.
- Utiliser des agents parallèles là où c'est pertinent (voir section 12 du cahier).
- Avant de coder une fonctionnalité majeure, expliquer brièvement l'approche retenue et les décisions de conception qui méritent validation.
- Maintenir un module de validation indépendant qui vérifie a posteriori qu'un horaire respecte toutes les contraintes, sans faire confiance au moteur.

## Conventions de français québécois (tout contenu visible : UI, libellés, messages, exports)
- Pas de virgule avant « et » (pas de virgule d'Oxford).
- Pas de majuscule à chaque mot dans les titres ; seul le premier mot prend la majuscule.
- Terminologie québécoise : aréna, glace, créneau, poule (ou bloc), ronde préliminaire, ronde éliminatoire, fusillade, franc-jeu, départage.

## À compléter par Claude Code après le jalon 1
- Commandes : installation, développement local, build, test, lint, déploiement.
- Architecture des dossiers une fois l'échafaudage en place.
- Contrats d'interface entre le service OR-Tools et l'API Next.js.
- Schéma de données de référence (lien vers les migrations Supabase).
