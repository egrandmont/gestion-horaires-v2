import logging
from datetime import datetime, date
from ortools.sat.python import cp_model

# Configurer les logs
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("hockey_solver")

def parse_slot_time(slot: dict, min_date: date) -> tuple[int, int]:
    """
    Convertit la date et l'heure d'un créneau en minutes absolues.
    Retourne (start_mins, end_mins).
    """
    d = datetime.strptime(slot["date"], "%Y-%m-%d").date()
    days_diff = (d - min_date).days
    
    t_str = slot["start_time"]
    hours, minutes = map(int, t_str.split(":"))
    
    start_mins = days_diff * 1440 + hours * 60 + minutes
    end_mins = start_mins + slot["duration_minutes"]
    return start_mins, end_mins

def solve_schedule_logic(payload: dict) -> dict:
    """
    Planification de tournois de hockey utilisant Google OR-Tools CP-SAT.
    """
    logger.info("Starting solver execution...")
    
    # 1. Extraction et validation des données
    tournament_id = payload.get("tournament_id")
    phase = payload.get("phase", "preliminary")
    teams = payload.get("teams", [])
    slots = payload.get("slots", [])
    matchups = payload.get("matchups", [])
    
    hard_constraints = payload.get("hard_constraints", {})
    soft_constraints = payload.get("soft_constraints", {})
    
    rest_mode = payload.get("rest_calculation_mode", "end_to_start")
    time_limit = float(payload.get("time_limit_seconds", 300.0))
    seed = int(payload.get("seed", 42))
    
    logger.info(f"Loaded {len(teams)} teams, {len(slots)} slots, {len(matchups)} matchups.")
    
    if not matchups:
        return {
            "status": "OPTIMAL",
            "objective": 0,
            "bound": 0,
            "assignments": [],
            "diagnostics": {
                "message": "No matchups to schedule.",
                "solving_time_seconds": 0.0
            }
        }
        
    if not slots:
        return {
            "status": "INFEASIBLE",
            "objective": 0,
            "bound": 0,
            "assignments": [],
            "diagnostics": {
                "message": "No time slots provided for scheduling.",
                "solving_time_seconds": 0.0
            }
        }

    # 2. Détermination de la date de référence (min_date)
    parsed_dates = []
    for s in slots:
        try:
            parsed_dates.append(datetime.strptime(s["date"], "%Y-%m-%d").date())
        except Exception as e:
            logger.error(f"Error parsing date {s.get('date')}: {e}")
            
    min_date = min(parsed_dates) if parsed_dates else date.today()
    
    # 3. Calcul des temps absolus pour les créneaux
    slot_times = {}
    for s in slots:
        slot_times[s["id"]] = parse_slot_time(s, min_date)

    # 4. Initialisation du modèle CP-SAT
    model = cp_model.CpModel()
    
    # 5. Création des variables de décision x[m_id, s_id]
    x = {}
    for m in matchups:
        m_id = m["id"]
        # Durée requise du match (incluant resurfaçage si déjà calculée par Next.js, sinon par défaut)
        m_dur = m.get("duration_minutes", 70)
        
        for s in slots:
            s_id = s["id"]
            s_dur = s["duration_minutes"]
            # Le match ne peut être affecté que si le créneau est assez long
            if s_dur >= m_dur:
                x[m_id, s_id] = model.NewBoolVar(f"x_{m_id}_{s_id}")
                
    # 6. Contrainte dure : Chaque match doit être affecté à EXACTEMENT UN créneau compatible
    for m in matchups:
        m_id = m["id"]
        valid_slots = [s["id"] for s in slots if (m_id, s["id"]) in x]
        if not valid_slots:
            logger.error(f"Infeasible: Match {m_id} (duration {m.get('duration_minutes', 70)}) has no compatible slots.")
            return {
                "status": "INFEASIBLE",
                "objective": 0,
                "bound": 0,
                "assignments": [],
                "diagnostics": {
                    "message": f"Match {m_id} (durée {m.get('duration_minutes', 70)} min) n'a aucun créneau compatible ou disponible."
                }
            }
        model.Add(sum(x[m_id, s_id] for s_id in valid_slots) == 1)

    # 7. Contrainte dure : Au plus un match par créneau
    for s in slots:
        s_id = s["id"]
        valid_matches = [m["id"] for m in matchups if (m["id"], s_id) in x]
        if valid_matches:
            model.Add(sum(x[m_id, s_id] for m_id in valid_matches) <= 1)

    # 8. Contrainte dure : Prévention des chevauchements physiques sur la même surface
    slots_by_surface = {}
    for s in slots:
        slots_by_surface.setdefault(s["surface_id"], []).append(s)
        
    for surf_id, surf_slots in slots_by_surface.items():
        for i in range(len(surf_slots)):
            s1 = surf_slots[i]
            s1_id = s1["id"]
            start1, end1 = slot_times[s1_id]
            for j in range(i + 1, len(surf_slots)):
                s2 = surf_slots[j]
                s2_id = s2["id"]
                start2, end2 = slot_times[s2_id]
                
                # S'ils se chevauchent dans le temps
                if max(start1, start2) < min(end1, end2):
                    s1_vars = [x[m["id"], s1_id] for m in matchups if (m["id"], s1_id) in x]
                    s2_vars = [x[m["id"], s2_id] for m in matchups if (m["id"], s2_id) in x]
                    if s1_vars or s2_vars:
                        model.Add(sum(s1_vars) + sum(s2_vars) <= 1)

    # 9. Regroupement des matchs par équipe pour contraintes d'équipe
    matches_by_team = {}
    for m in matchups:
        m_id = m["id"]
        t1 = m.get("home_team_id")
        t2 = m.get("away_team_id")
        if t1:
            matches_by_team.setdefault(t1, []).append(m_id)
        if t2:
            matches_by_team.setdefault(t2, []).append(m_id)

    # 10. Contraintes dures sur les équipes
    min_rest = hard_constraints.get("min_rest_minutes", 180)
    
    for team_id, m_ids in matches_by_team.items():
        if len(m_ids) <= 1:
            continue
            
        for i in range(len(m_ids)):
            m1 = m_ids[i]
            for j in range(i + 1, len(m_ids)):
                m2 = m_ids[j]
                
                for s1 in slots:
                    s1_id = s1["id"]
                    if (m1, s1_id) not in x:
                        continue
                    start1, end1 = slot_times[s1_id]
                    
                    for s2 in slots:
                        s2_id = s2["id"]
                        if s1_id == s2_id or (m2, s2_id) not in x:
                            continue
                        start2, end2 = slot_times[s2_id]
                        
                        # Calcul du repos entre les deux créneaux
                        if start2 >= start1:
                            rest = (start2 - end1) if rest_mode == "end_to_start" else (start2 - start1)
                        else:
                            rest = (start1 - end2) if rest_mode == "end_to_start" else (start1 - start2)
                            
                        # Si le repos est inférieur au repos minimal strict (inclut le chevauchement négatif/direct)
                        if rest < min_rest:
                            model.Add(x[m1, s1_id] + x[m2, s2_id] <= 1)

    # 11. Objectifs souples (Pénalités)
    penalties = []
    
    # 11a. Pénalité repos cible (écart avec target_rest_minutes)
    target_rest = soft_constraints.get("target_rest_minutes", 240)
    rest_dev_weight = soft_constraints.get("weights", {}).get("rest_target_deviation", 10)
    
    if rest_dev_weight > 0:
        for team_id, m_ids in matches_by_team.items():
            if len(m_ids) <= 1:
                continue
            for i in range(len(m_ids)):
                m1 = m_ids[i]
                for j in range(i + 1, len(m_ids)):
                    m2 = m_ids[j]
                    for s1 in slots:
                        s1_id = s1["id"]
                        if (m1, s1_id) not in x:
                            continue
                        start1, end1 = slot_times[s1_id]
                        
                        for s2 in slots:
                            s2_id = s2["id"]
                            if s1_id == s2_id or (m2, s2_id) not in x:
                                continue
                            start2, end2 = slot_times[s2_id]
                            
                            # Calcul du repos
                            if start2 >= start1:
                                rest = (start2 - end1) if rest_mode == "end_to_start" else (start2 - start1)
                            else:
                                rest = (start1 - end2) if rest_mode == "end_to_start" else (start1 - start2)
                                
                            if min_rest <= rest < target_rest:
                                # Pénalité proportionnelle à l'écart en minutes
                                dev = target_rest - rest
                                pair_active = model.NewBoolVar(f"soft_rest_{team_id}_{m1}_{m2}_{s1_id}_{s2_id}")
                                model.AddBoolAnd([x[m1, s1_id], x[m2, s2_id]]).OnlyEnforceIf(pair_active)
                                model.AddBoolOr([x[m1, s1_id].Not(), x[m2, s2_id].Not()]).OnlyEnforceIf(pair_active.Not())
                                penalties.append(pair_active * (dev * rest_dev_weight))

    # 11b. Pénalité sur-programmation quotidienne (> max_daily_games_per_team)
    max_daily_games = soft_constraints.get("max_daily_games_per_team", 2)
    daily_game_violation_weight = soft_constraints.get("weights", {}).get("daily_game_limit_violation", 100)
    
    if daily_game_violation_weight > 0:
        slots_by_day = {}
        for s in slots:
            slots_by_day.setdefault(s["date"], []).append(s["id"])
            
        for team_id, m_ids in matches_by_team.items():
            for day, day_slot_ids in slots_by_day.items():
                day_vars = []
                for m_id in m_ids:
                    for s_id in day_slot_ids:
                        if (m_id, s_id) in x:
                            day_vars.append(x[m_id, s_id])
                
                # Si l'équipe a plus de matchs potentiels que le maximum sur cette journée
                if len(day_vars) > max_daily_games:
                    violation = model.NewBoolVar(f"daily_violation_{team_id}_{day}")
                    # Si violation = False, la somme doit être <= max_daily_games
                    model.Add(sum(day_vars) <= max_daily_games).OnlyEnforceIf(violation.Not())
                    penalties.append(violation * daily_game_violation_weight)

    # 12. Définition de l'objectif global
    if penalties:
        model.Minimize(sum(penalties))
    else:
        # Si aucun objectif, on cherche juste une solution faisable
        model.Minimize(0)

    # 13. Résolution
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = time_limit
    solver.parameters.random_seed = seed
    
    logger.info("Invoking CP-SAT solver...")
    status = solver.Solve(model)
    logger.info(f"Solver finished with status: {solver.StatusName(status)}")
    
    # 14. Construction du résultat
    status_map = {
        cp_model.OPTIMAL: "OPTIMAL",
        cp_model.FEASIBLE: "FEASIBLE",
        cp_model.INFEASIBLE: "INFEASIBLE",
        cp_model.MODEL_INVALID: "INFEASIBLE",
        cp_model.UNKNOWN: "INFEASIBLE"
    }
    
    result_status = status_map.get(status, "INFEASIBLE")
    
    assignments = []
    if result_status in ("OPTIMAL", "FEASIBLE"):
        for m in matchups:
            m_id = m["id"]
            for s in slots:
                s_id = s["id"]
                if (m_id, s_id) in x and solver.BooleanValue(x[m_id, s_id]):
                    assignments.append({
                        "match_id": m_id,
                        "slot_id": s_id
                    })
                    
        return {
            "status": result_status,
            "objective": int(solver.ObjectiveValue()),
            "bound": int(solver.BestObjectiveBound()),
            "assignments": assignments,
            "diagnostics": {
                "solving_time_seconds": solver.WallTime(),
                "search_nodes": solver.NumBranches(),
                "message": "Planification complétée avec succès." if status == cp_model.OPTIMAL else "Solution faisable trouvée."
            }
        }
    else:
        return {
            "status": "INFEASIBLE",
            "objective": 0,
            "bound": 0,
            "assignments": [],
            "diagnostics": {
                "solving_time_seconds": solver.WallTime(),
                "message": "Impossible de trouver une solution respectant les contraintes strictes. Essayez d'allonger la période de tournoi ou de rajouter des créneaux de glace."
            }
        }
