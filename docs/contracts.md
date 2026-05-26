# Contrats d'API — Plateforme de planification

Ce document fige les contrats d'API entre l'application Next.js (client) et le solveur de planification (Modal Python).

## 1. Contrat d'appel du solveur

L'appel s'effectue via une requête HTTP POST sur l'URL du service Modal : `POST /solve`.

### Payload (Entrée)

```json
{
  "tournament_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "phase": "preliminary",
  "rest_calculation_mode": "end_to_start",
  "time_limit_seconds": 300,
  "seed": 42,
  "teams": [
    {
      "id": "t1",
      "category_id": "cat-m13-aa",
      "name": "Étoiles de l'Est",
      "club": "Hockey Est"
    },
    {
      "id": "t2",
      "category_id": "cat-m13-aa",
      "name": "Dragons du Nord",
      "club": "Nord Hockey"
    }
  ],
  "slots": [
    {
      "id": "slot-01",
      "surface_id": "ice-rosemer-1",
      "date": "2026-06-05",
      "start_time": "08:00",
      "duration_minutes": 70
    },
    {
      "id": "slot-02",
      "surface_id": "ice-rosemer-1",
      "date": "2026-06-05",
      "start_time": "09:10",
      "duration_minutes": 70
    }
  ],
  "matchups": [
    {
      "id": "match-01",
      "category_id": "cat-m13-aa",
      "pool_id": "pool-a",
      "home_team_id": "t1",
      "away_team_id": "t2"
    }
  ],
  "hard_constraints": {
    "min_rest_minutes": 180,
    "prevent_team_overlap": true,
    "respect_ice_capacity": true
  },
  "soft_constraints": {
    "target_rest_minutes": 240,
    "max_daily_games_per_team": 2,
    "weights": {
      "rest_target_deviation": 10,
      "daily_game_limit_violation": 100,
      "long_wait_between_games": 5
    }
  }
}
```

### Response (Sortie)

```json
{
  "status": "OPTIMAL",
  "objective": 120,
  "bound": 120,
  "assignments": [
    {
      "match_id": "match-01",
      "slot_id": "slot-01"
    }
  ],
  "diagnostics": {
    "solving_time_seconds": 1.24,
    "search_nodes": 5420,
    "message": "Planning completed successfully."
  }
}
```

---

## 2. Structure des contraintes

Les contraintes sont stockées dans la table `constraints` avec une structure flexible en JSONB :
- `type` : Chaîne de caractères identifiant la règle.
- `params` : Objet de paramètres propres à cette règle.
- `is_hard` : Booléen.
- `weight` : Entier représentant la pénalité si souple.

### Exemples de règles

#### Couvre-feu par catégorie (`curfew`)
```json
{
  "type": "curfew",
  "is_hard": false,
  "weight": 50,
  "params": {
    "latest_start_time": "20:30"
  }
}
```

#### Plancher de repos minimal (`min_rest`)
```json
{
  "type": "min_rest",
  "is_hard": true,
  "params": {
    "min_minutes": 180,
    "calculation_mode": "end_to_start"
  }
}
```

---

## 3. Format du classement

Le classement d'une poule est calculé sous forme de liste triée d'équipes avec les statistiques suivantes :

```json
[
  {
    "team_id": "t1",
    "games_played": 3,
    "points": 6,
    "wins": 3,
    "losses": 0,
    "ties": 0,
    "goals_for": 12,
    "goals_against": 2,
    "goal_differential": 10,
    "tiebreaker_notes": ["1er au classement général (confrontation directe gagnée contre t2)"]
  }
]
```
