export interface SolveSchedulePayload {
  tournament_id: string;
  phase: "preliminary" | "playoff";
  teams: Array<{
    id: string;
    category_id: string;
    name: string;
    club?: string;
  }>;
  slots: Array<{
    id: string;
    surface_id: string;
    date: string;
    start_time: string;
    duration_minutes: number;
  }>;
  matchups: Array<{
    id: string;
    category_id: string;
    pool_id?: string;
    home_team_id?: string;
    away_team_id?: string;
    home_position_id?: string;
    away_position_id?: string;
  }>;
  hard_constraints: Record<string, any>;
  soft_constraints: Record<string, any>;
  rest_calculation_mode: "start_to_start" | "end_to_start";
  time_limit_seconds?: number;
  seed?: number;
}

export interface SolveScheduleResult {
  status: "OPTIMAL" | "FEASIBLE" | "INFEASIBLE";
  objective: number;
  bound: number;
  assignments: Array<{
    match_id: string;
    slot_id: string;
  }>;
  diagnostics: Record<string, any>;
}

/**
 * Appelle l'endpoint de résolution sur Modal ou effectue un mock local si SOLVER_URL n'est pas défini.
 */
export async function solveSchedule(payload: SolveSchedulePayload): Promise<SolveScheduleResult> {
  const solverUrl = process.env.SOLVER_URL;

  if (!solverUrl) {
    console.warn("⚠️ SOLVER_URL is not set. Falling back to local solver mock/stub.");
    return {
      status: "OPTIMAL",
      objective: 0,
      bound: 0,
      assignments: [],
      diagnostics: {
        message: "Mocked local solver stub response (no SOLVER_URL configured)",
        tournament_id: payload.tournament_id,
        phase: payload.phase,
      },
    };
  }

  try {
    const response = await fetch(`${solverUrl}/solve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Solver endpoint error: ${response.statusText} (${response.status})`);
    }

    return (await response.json()) as SolveScheduleResult;
  } catch (error) {
    console.error("❌ Error calling Modal solver:", error);
    throw error;
  }
}
