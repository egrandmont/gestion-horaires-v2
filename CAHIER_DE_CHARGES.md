# Cahier de charges — Plateforme de création et de gestion de tournois de hockey

> Document de référence destiné à Claude Code. Il décrit **quoi** construire et **pourquoi**, pas **comment** ligne par ligne. Claude Code doit produire son propre plan d'exécution détaillé à partir de ce document, puis livrer en jalons vérifiables (voir la section « Méthode de livraison »).

---

## 1. Vision du produit

Une application web qui permet à un organisateur de tournoi de hockey mineur de **créer de zéro l'horaire complet d'un tournoi**, de gérer les **résultats en direct** pendant le week-end, et de **générer automatiquement les rondes éliminatoires** à partir des classements.

Le cœur du système est un **moteur d'optimisation sous contraintes** qui place les matchs sur les glaces disponibles en respectant un ensemble de règles entièrement paramétrables (repos, couvre-feu par catégorie, fenêtres horaires, etc.).

L'outil doit être **d'une facilité déconcertante à utiliser** pour un bénévole d'association de hockey peu à l'aise avec la technologie, qui monte un tournoi une ou deux fois par année.

### Principe directeur du design
- Assistant pas-à-pas (wizard) qui guide l'organisateur d'un bout à l'autre.
- Valeurs par défaut intelligentes partout (conformes aux conventions Hockey Québec).
- Prévisualisation avant tout calcul lourd.
- Conception « on ne peut pas se tromper » : validation en temps réel, messages d'erreur clairs, impossibilité de soumettre un état incohérent.

---

## 2. Stack technique imposée

- **Frontend / hébergement** : Next.js (App Router) déployé sur Vercel, via repo GitHub.
- **Backend / base de données** : Supabase (PostgreSQL, Auth, Row-Level Security, Realtime pour la saisie de scores en direct).
- **Moteur d'optimisation** : OR-Tools (CP-SAT, programmation par contraintes). Comme OR-Tools est une bibliothèque Python, l'exposer via un service Python séparé (par exemple un endpoint serverless Python, ou un petit service conteneurisé appelé par l'API Next.js). Claude Code décide de l'approche d'intégration la plus propre pour Vercel + Supabase, mais le moteur DOIT être OR-Tools CP-SAT, pas une heuristique maison.
- **Design** : utiliser impérativement le skill `frontend-design` pour toute l'interface, afin d'obtenir une UI distinctive et de qualité production, en évitant l'esthétique générique.

---

## 3. Périmètre fonctionnel

Le produit couvre l'intégralité du cycle de vie d'un tournoi, en trois grands blocs :

### Bloc A — Configuration du tournoi (avant l'événement)
1. Création d'un tournoi (nom, dates, lieu).
2. Déclaration des **arénas**, de leurs **glaces**, et des **créneaux disponibles/indisponibles** par journée (interface façon calendrier Outlook que l'on « book »).
3. Déclaration des **catégories** (axes : âge, niveau, sexe — voir section 5).
4. Inscription des **équipes** par catégorie (3 à 24 équipes par catégorie).
5. Définition du **format de tournoi** par catégorie (poules ou non, nombre de matchs garantis, structure éliminatoire — voir section 6).
6. Définition des **contraintes** globales et spécifiques (voir section 7).
7. Définition de l'**ordre des critères de départage** (glisser-déposer — voir section 8).

### Bloc B — Génération de l'horaire (moteur d'optimisation)
8. Génération automatique des **confrontations** de la ronde préliminaire (round-robin ou poules).
9. **Placement physique** de tous les matchs sur les glaces et créneaux, toutes catégories résolues ensemble (elles partagent les glaces).
10. Optimisation sous contraintes avec OR-Tools, retournant la **meilleure solution trouvée dans une limite de temps configurable** (pas de garantie d'optimalité absolue exigée vu l'échelle).
11. Détection et **signalement clair de l'infaisabilité** (si les contraintes se contredisent, expliquer laquelle pose problème plutôt que d'échouer silencieusement).

### Bloc C — Gestion en direct (pendant l'événement)
12. **Saisie des scores** des matchs au fur et à mesure (avec Supabase Realtime pour mise à jour instantanée).
13. Calcul automatique du **classement** de chaque poule selon les critères de départage ordonnés.
14. **Génération automatique des rondes éliminatoires** (brackets) une fois le classement préliminaire connu, avec gestion des byes.
15. Affichage public de l'horaire et des résultats (vue lecture seule partageable).

---

## 4. Modèle de données (Supabase / PostgreSQL)

Structure hiérarchique. Claude Code raffine les types exacts, mais respecte cette organisation.

- **tournaments** — un tournoi (nom, dates de début/fin, fuseau, statut, organisateur_id).
- **arenas** — un aréna rattaché à un tournoi (nom, adresse).
- **surfaces** — une glace rattachée à un aréna (nom, ex. « Desjardins », « Sports Rousseau »).
- **time_slots** — les créneaux disponibles par glace et par journée. Modèle « calendrier » : une glace a des plages d'ouverture par jour, découpées en créneaux. Permettre de marquer un créneau comme indisponible (entretien, location externe, etc.). Un créneau a une glace, une date, une heure de début, une durée.
- **categories** — une catégorie de jeu rattachée à un tournoi. Trois axes (voir section 5).
- **teams** — une équipe rattachée à une catégorie (nom, ville/association, contraintes spécifiques).
- **pools** — une poule rattachée à une catégorie (les équipes y sont réparties).
- **formats** — la configuration de format d'une catégorie (type de ronde préliminaire, structure éliminatoire, nombre de matchs garantis).
- **matches** — un match. C'est la SORTIE du moteur. Contient : catégorie, glace, créneau (date+heure), équipe visiteur, équipe locale, phase (préliminaire/éliminatoire), poule (si applicable), position de bracket (si éliminatoire), score visiteur, score local, statut.
- **constraints** — contraintes paramétrables, rattachées soit au tournoi (globales), soit à une catégorie, soit à une équipe (voir section 7).
- **tiebreak_rules** — l'ordre des critères de départage pour le tournoi (ou par catégorie).
- **bracket_templates** — la définition des structures éliminatoires (positions à trous, dépendances).

### Points d'attention sur le modèle
- Un **match préliminaire** référence deux équipes connues. Un **match éliminatoire** référence d'abord des *positions de bracket* (ex. « 1er poule A » vs « 4e classement général »), résolues en équipes réelles seulement une fois les résultats préliminaires saisis. Le modèle doit représenter les deux états.
- Les contraintes doivent être **typées et extensibles** : prévoir une structure qui permet d'ajouter un nouveau type de contrainte sans migration lourde (par ex. un champ `type` + un champ `params` en JSONB), tout en gardant les contraintes courantes en colonnes typées pour la performance et la validation.

---

## 5. Catégories — trois axes

Une catégorie est définie par la combinaison de trois axes. Le système ne doit PAS imposer une liste fermée de catégories : l'organisateur les compose.

### Axe 1 — Âge (DEUX conventions au choix, stockées telles quelles)
- **Par année de naissance** : 2006 à 2020 (et au-delà selon les années).
- **Par palier** : M7, M9, M11, M13, M15, M17, M18, Collégial, Junior, Sénior.
- Important : ne PAS convertir automatiquement l'une en l'autre. Stocker et afficher exactement la convention choisie par l'organisateur. Un tournoi affiche « 2012 D1 », un autre « M13 AA » — les deux ressortent tels quels sur la grille.

### Axe 2 — Niveau
Liste de départ (avec valeurs par défaut) : D1, D1 Open, D1 Élite, D2, D2 Mixte, D2 Open, D3, AAA, AA, A, Récréatif.
- Prévoir la **saisie libre** d'un niveau personnalisé, car de nouveaux niveaux apparaissent.

### Axe 3 — Sexe
- Masculin, Féminin, ou **non spécifié** (mixte de fait).

### Règle de composition
- L'axe Âge est obligatoire. Les axes Niveau et Sexe peuvent être laissés vides (ex. « 2012 Récréatif » sans sexe).
- L'étiquette d'affichage de la catégorie se construit à partir des axes renseignés, dans l'ordre Âge → Niveau → Sexe.

---

## 6. Formats de tournoi

Recherche effectuée sur les conventions Hockey Québec / tournois de printemps. Le système doit supporter les formats les plus courants, configurables par catégorie.

### Ronde préliminaire
- **Round-robin simple** : chaque équipe affronte toutes les autres une fois (adapté aux petites catégories).
- **Poules (blocs) avec round-robin interne** : les équipes sont réparties en N poules, chaque équipe affronte les autres de sa poule. Convention fréquente : garantir un minimum de 3 ou 4 matchs par équipe.
- Le nombre de **matchs garantis** est paramétrable (souvent 3 ou 4).
- Gérer le **nombre d'équipes variable de 3 à 24** par catégorie : la répartition en poules et le nombre de matchs s'ajustent automatiquement. Gérer proprement les nombres qui ne tombent pas juste (poules inégales, nombre impair d'équipes).

### Ronde éliminatoire (structures à trous)
- Au moment de générer l'horaire, les occupants des matchs éliminatoires sont INCONNUS : ce sont des positions (« 1er poule A », « meilleur 2e », etc.) résolues après la ronde préliminaire.
- Supporter les structures courantes : demi-finales + finale ; quarts + demis + finale ; huitièmes + quarts + demis + finale.
- Supporter les variantes fréquentes au Québec : finales A et B (les 1ers de poule vont en finale A, les 2es en finale B — voir l'exemple Victoriaville dans la recherche), classement croisé (4e meilleure fiche vs 1re, 3e vs 2e), etc.
- **Byes automatiques** : quand le nombre d'équipes qualifiées n'est pas une puissance de 2, calculer et placer les byes (les mieux classés passent un tour).
- L'équipe **locale en éliminatoire** est généralement la mieux classée de la ronde préliminaire (sauf en finale, souvent par tirage au sort) — rendre ce comportement paramétrable.

### Placement physique (commun aux deux rondes)
- Tous les matchs de toutes les catégories sont placés ensemble sur les glaces partagées.
- Aucune prolongation en préliminaire (les matchs nuls existent) ; en éliminatoire, prévoir que les matchs peuvent être plus longs (prolongation + fusillade) — donc durée de match potentiellement différente entre préliminaire et éliminatoire (paramétrable).

---

## 7. Contraintes paramétrables

Principe fondamental : **tout ce qui pourrait être une contrainte doit être paramétrable.** Le moteur distingue deux natures de contraintes.

### Contraintes dures (jamais violées — une solution qui en viole une est rejetée)
- **Confrontations figées** : le moteur ne change jamais qui affronte qui (en ronde préliminaire générée, il les crée ; une fois créées, il ne les altère pas lors du placement).
- **Capacité des glaces** : une glace n'accueille qu'un seul match par créneau.
- **Pas de chevauchement d'équipe** : une équipe ne peut pas jouer deux matchs au même moment.
- **Fenêtres d'ouverture des arénas** : aucun match hors des plages déclarées.
- **Durée des créneaux** : respecter la durée de match configurée (paramétrable, ex. 70 min de départ en départ, avec resurfaçage à prévoir — voir note).
- **Repos minimal** entre deux matchs d'une même équipe (paramétrable, ex. plancher de 3 h). Calculé comme l'écart entre les **heures de début** de deux matchs consécutifs (convention à confirmer/configurer : début-à-début ou fin-à-début).

### Contraintes souples / objectifs (optimisées, pondérées)
- **Repos cible** par équipe (ex. fenêtre 3 h–5 h, préférence pour ~4 h).
- **Réduction des longs écarts** entre deux matchs d'une même journée (éviter les attentes interminables qui font décrocher les jeunes).
- **Équité inter-journée** : une équipe qui finit tard un jour ne devrait pas être celle qui ouvre tôt le lendemain.
- **Couvre-feu par catégorie** : les jeunes catégories ne jouent pas en soirée (ex. aucun match des plus jeunes après une heure configurable ; seuils différents par palier d'âge). Doit être entièrement paramétrable par catégorie.
- **Réservation des derniers créneaux** à certaines catégories (ex. les plus vieux ferment la soirée).
- **Contraintes spécifiques par équipe** : une équipe peut avoir des disponibilités réduites, une préférence d'aréna, une demande de ne pas jouer avant une certaine heure, etc.
- **Préférences de glace** par catégorie ou équipe.

### Note importante sur le resurfaçage (à intégrer dès la conception)
La durée du créneau doit distinguer le **temps de jeu réel** du **temps de glace total** (jeu + resurfaçage Zamboni). Le moteur doit pouvoir garantir qu'il reste assez de temps entre deux matchs consécutifs sur une même glace pour le resurfaçage. Rendre ce buffer paramétrable. C'est un point qui fait rejeter un horaire par les coordonnateurs d'aréna s'il est ignoré.

### Exigence d'extensibilité
La liste ci-dessus n'est pas exhaustive. Concevoir le système de contraintes pour qu'on puisse en **ajouter de nouvelles** sans réarchitecturer le moteur. Chaque contrainte = un module qui sait (a) se présenter dans l'UI, (b) se sérialiser en base, (c) s'injecter dans le modèle OR-Tools comme contrainte dure ou terme d'objectif pondéré.

---

## 8. Règles de départage (classement des poules)

Recherche effectuée sur l'article 9.8 du guide administratif Hockey Québec et plusieurs tournois. À implémenter fidèlement.

### Critères disponibles (l'organisateur les ordonne par glisser-déposer)
1. Plus grand nombre de points (victoire = 2, nul = 1, défaite = 0 — paramétrable, certains utilisent 3 pts).
2. Plus grand nombre de victoires.
3. Moins de buts contre.
4. Meilleur différentiel (buts pour − buts contre).
5. Plus de buts pour.
6. Confrontation directe (pour départage à 2 équipes).
7. But le plus rapide marqué dans le tournoi.
8. Points Franc-Jeu accumulés.
9. Tirage au sort (critère ultime).

L'ordre par défaut suit le standard Hockey Québec : points → victoires → buts contre (ou différentiel) → buts pour → but le plus rapide → franc-jeu → tirage. Mais l'organisateur peut réordonner librement.

### Algorithme de départage (à implémenter précisément)
- **Départage à 2 équipes** : commencer par la confrontation directe (la gagnante a préséance), puis appliquer les autres critères dans l'ordre.
- **Départage à 3 équipes ou plus** : établir un **classement spécial ne tenant compte que des matchs joués entre ces équipes à égalité** (matchs communs), puis appliquer les critères dans l'ordre sur ce sous-ensemble.
- **Mécanique itérative** : à chaque critère, ne conserver que les équipes encore à égalité. Dès qu'une équipe est départagée (identifiée comme la meilleure ou éliminée), recommencer le processus depuis le premier critère pour les équipes restantes.
- **Règle de l'équipe absente** : si une équipe ne se présente pas à un match, les résultats des matchs joués contre elle ne sont pas comptés dans le calcul des buts pour/contre/différentiel des autres équipes.
- Un match gagné par défaut accorde généralement les points de la victoire (paramétrable).

Ces subtilités sont précisément ce qui fait qu'un organisateur fait confiance à l'outil. Les implémenter correctement n'est pas optionnel.

---

## 9. Le moteur d'optimisation (OR-Tools CP-SAT)

### Approche de modélisation
- Variables de décision : l'affectation de chaque match à un (créneau, glace). Les confrontations préliminaires sont d'abord générées (qui joue qui), puis placées.
- Contraintes dures : injectées comme contraintes CP-SAT strictes.
- Objectifs souples : combinés en une fonction objectif pondérée (le solveur maximise/minimise). Exposer les pondérations comme paramètres pour que l'organisateur puisse arbitrer (ex. « privilégier le repos » vs « minimiser les déplacements »).
- **Limite de temps configurable** : le solveur cherche pendant X secondes/minutes et retourne la meilleure solution trouvée (CP-SAT fournit nativement la meilleure solution courante + une borne de qualité). Afficher à l'organisateur un indicateur de qualité (« solution optimale prouvée » vs « meilleure solution trouvée en X min »).

### Génération des confrontations
- Pour un round-robin : générer toutes les paires.
- Pour des poules : répartir les équipes en poules équilibrées (gérer 3 à 24 équipes, poules inégales si nécessaire), puis round-robin interne.
- La répartition en poules peut elle-même être un objectif (équilibrer les forces si un classement de tête de série est fourni — optionnel).

### Phase éliminatoire
- Générer la **structure de bracket** appropriée selon le nombre d'équipes qualifiées et le format choisi, avec byes automatiques.
- Placer les matchs éliminatoires comme des **positions à trous** dans l'horaire (créneaux réservés), dont les occupants seront résolus après la saisie des scores préliminaires.
- Respecter les dépendances temporelles : un quart de finale doit avoir lieu après que les matchs préliminaires dont il dépend soient terminés ; une demi après les quarts ; etc.

### Gestion de l'infaisabilité
- Si CP-SAT retourne INFEASIBLE, ne pas échouer silencieusement. Tenter d'identifier le sous-ensemble de contraintes en conflit (ex. en relâchant progressivement les contraintes souples, ou en signalant les contraintes dures incompatibles) et présenter un message actionnable : « Impossible de respecter X et Y simultanément. Suggestion : assouplir Z. »

---

## 10. Exigences UX (utilisateur cible : bénévole peu technophile)

L'outil doit être d'une facilité déconcertante. Utiliser le skill `frontend-design`.

### Parcours en assistant (wizard)
Un fil conducteur clair, étape par étape, avec barre de progression :
1. **Mon tournoi** : nom, dates.
2. **Mes arénas et glaces** : ajout d'arénas, puis de glaces, puis des plages horaires par journée (interface calendrier « book » des créneaux, glisser pour sélectionner des plages, marquer des indisponibilités).
3. **Mes catégories** : composer les catégories avec les trois axes (sélecteurs intelligents).
4. **Mes équipes** : inscrire les équipes par catégorie (import en lot possible : coller une liste).
5. **Mon format** : choisir poules/round-robin, matchs garantis, structure éliminatoire (avec aperçus visuels des brackets).
6. **Mes règles** : contraintes (avec valeurs par défaut Hockey Québec déjà cochées) et ordre de départage (glisser-déposer).
7. **Aperçu et génération** : prévisualisation de ce qui va être calculé, puis lancement du moteur avec indicateur de progression.
8. **Résultat** : grille générée, visualisable, ajustable, exportable.

### Principes UX non négociables
- **Valeurs par défaut intelligentes** : tout doit être pré-rempli selon les conventions courantes ; un organisateur pressé peut tout accepter et obtenir un horaire valide.
- **Impossible de se tromper** : validation en temps réel, on ne peut pas avancer dans un état incohérent, messages d'erreur en langage clair (pas de jargon technique).
- **Prévisualisation avant calcul** : toujours montrer ce qui va se passer avant de lancer une opération lourde.
- **Réversibilité** : pouvoir revenir en arrière dans le wizard sans perdre ses données ; pouvoir relancer le moteur avec des paramètres ajustés.
- **Affichage de l'horaire** : vue claire par jour / par glace / par catégorie / par équipe, avec code couleur. Vue publique partageable en lecture seule.

### Saisie de scores en direct (pendant l'événement)
- Interface mobile-friendly ultra-simple pour entrer un score (gros boutons, pensée pour être utilisée au bord de la glace sur un téléphone).
- Mise à jour en temps réel (Supabase Realtime) : dès qu'un score est entré, le classement se recalcule et les brackets se remplissent automatiquement.
- Affichage live du classement de chaque poule et de l'avancement des brackets.

---

## 11. Méthode de livraison (jalons vérifiables)

Claude Code reçoit le périmètre complet et produit son propre plan. Cependant, pour préserver la visibilité de l'organisateur du projet, livrer en **jalons démontrables** plutôt qu'en un seul bloc. À chaque jalon, l'application doit tourner et être inspectable.

- **Jalon 1 — Fondations** : schéma Supabase complet + auth + structure Next.js déployée sur Vercel (page d'accueil vide mais en ligne). Démontrable : on peut créer un tournoi vide en base.
- **Jalon 2 — Configuration** : le wizard complet de configuration (arénas, glaces, créneaux, catégories, équipes, format, contraintes, départage). Démontrable : on peut configurer entièrement un tournoi sans encore générer d'horaire.
- **Jalon 3 — Moteur préliminaire** : intégration OR-Tools, génération des confrontations et placement physique de la ronde préliminaire avec toutes les contraintes. Démontrable : on génère un horaire préliminaire valide et on l'exporte. (C'est le cœur ; le valider solidement avant d'aller plus loin.)
- **Jalon 4 — Saisie et classement** : saisie de scores en direct + calcul du classement avec départage. Démontrable : on entre des scores et le classement se calcule correctement, y compris les cas de départage à 2 et à 3+ équipes.
- **Jalon 5 — Éliminatoire** : génération des brackets à trous, byes, résolution automatique après classement. Démontrable : les rondes éliminatoires se remplissent à partir des résultats.
- **Jalon 6 — Raffinement UI/UX et vues publiques** : polissage avec `frontend-design`, vue publique partageable, affichage mobile de la saisie de scores.

À chaque jalon, fournir : ce qui fonctionne, comment le tester, et les décisions de conception prises qui méritent validation.

---

## 12. Orchestration en agents parallèles

Claude Code (Opus) supporte les équipes d'agents travaillant en parallèle. Utiliser des agents parallèles là où c'est pertinent. Pistes parallélisables suggérées (Claude Code ajuste la répartition s'il juge mieux) :
- **Agent Données & Moteur** : schéma Supabase, RLS, service OR-Tools, logique de départage.
- **Agent Interface** : wizard Next.js/React, composants, application du skill `frontend-design`.
- **Agent Export & Temps réel** : export (Excel/PDF/vue web), Supabase Realtime, saisie de scores mobile.

Les agents doivent se coordonner sur les contrats d'interface (schéma de données, signatures d'API) définis tôt au Jalon 1.

---

## 13. Validation et qualité

- Reprendre le principe de **validation indépendante** : un module qui vérifie a posteriori qu'un horaire généré respecte TOUTES les contraintes (sans faire confiance au moteur). C'est le filet de sécurité.
- Tests sur les cas limites : nombre impair d'équipes, poules inégales, 3 équipes (minimum), 24 équipes (maximum), contraintes contradictoires (doit signaler l'infaisabilité proprement), équipe absente (impact sur le départage).
- Tests des deux conventions d'âge (année et palier) côte à côte dans un même tournoi.

---

## 14. Conventions de rédaction (français québécois)

Tout le contenu visible (UI, libellés, messages, exports) en **français québécois** :
- Pas de virgule avant « et » (pas de virgule d'Oxford).
- Pas de majuscule à chaque mot dans les titres : seul le premier mot prend la majuscule.
- Terminologie québécoise du hockey (aréna, glace, créneau, poule/bloc, ronde préliminaire, ronde éliminatoire, fusillade, franc-jeu).
