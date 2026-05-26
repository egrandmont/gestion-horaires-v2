def solve_schedule_logic(payload: dict) -> dict:
    """
    Logique du solveur pour la planification des matchs de hockey.
    Actuellement un stub pour le Jalon 1.
    """
    tournament_id = payload.get("tournament_id")
    phase = payload.get("phase", "preliminary")
    
    # Simuler une planification vide réussie pour le Jalon 1
    return {
        "status": "OPTIMAL",
        "objective": 0,
        "bound": 0,
        "assignments": [],
        "diagnostics": {
            "message": "Stub solver response",
            "tournament_id": tournament_id,
            "phase": phase
        }
    }
