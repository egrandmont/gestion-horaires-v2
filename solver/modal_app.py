import modal
from main import solve_schedule_logic

# Définition de l'application Modal
app = modal.App("hockey-tournament-solver")

# Construction de l'image de conteneur avec les packages requis
import os
req_path = os.path.join(os.path.dirname(__file__), "requirements.txt")
image = modal.Image.debian_slim().pip_install_from_requirements(req_path)

@app.function(image=image)
@modal.fastapi_endpoint(method="POST", label="solve")
def solve_schedule(payload: dict) -> dict:
    """
    Point d'accès HTTP (web endpoint) sur Modal.
    Prend un payload JSON en entrée et retourne le résultat de la planification.
    """
    return solve_schedule_logic(payload)
