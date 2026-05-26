import modal
from main import solve_schedule_logic

# Définition de l'application Modal
app = modal.App("hockey-tournament-solver")

# Construction de l'image de conteneur avec les packages requis
image = modal.Image.debian_slim().pip_install_from_requirements("requirements.txt")

@app.function(image=image)
@modal.web_endpoint(method="POST", label="solve")
def solve_schedule(payload: dict) -> dict:
    """
    Point d'accès HTTP (web endpoint) sur Modal.
    Prend un payload JSON en entrée et retourne le résultat de la planification.
    """
    return solve_schedule_logic(payload)
