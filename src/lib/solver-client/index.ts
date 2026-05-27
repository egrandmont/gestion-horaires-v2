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
    duration_minutes?: number;
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
    console.warn("⚠️ SOLVER_URL is not set. Falling back to local greedy solver mock.");
    
    const assignments: Array<{ match_id: string; slot_id: string }> = [];
    const occupiedSlots = new Set<string>();
    const teamMatchTimes = new Map<string, Array<{ start: number; end: number }>>();

    // Helper parsing date and start_time to absolute minutes
    const baseDate = new Date(payload.slots[0]?.date || "2026-01-01");
    const getAbsMins = (dateStr: string, timeStr: string) => {
      const d = new Date(dateStr);
      const days = Math.round((d.getTime() - baseDate.getTime()) / (1000 * 60 * 60 * 24));
      const [h, m] = timeStr.split(":").map(Number);
      return days * 1440 + h * 60 + m;
    };

    const sortedSlots = [...payload.slots].sort((a, b) => {
      return getAbsMins(a.date, a.start_time) - getAbsMins(b.date, b.start_time);
    });

    const minRest = payload.hard_constraints.min_rest_minutes ?? 180;
    const restMode = payload.rest_calculation_mode ?? "end_to_start";

    for (const match of payload.matchups) {
      const mDur = match.duration_minutes ?? 70;
      const hTeam = match.home_team_id;
      const aTeam = match.away_team_id;

      let assignedSlotId: string | null = null;

      for (const slot of sortedSlots) {
        if (occupiedSlots.has(slot.id)) continue;
        if (slot.duration_minutes < mDur) continue;

        const slotStart = getAbsMins(slot.date, slot.start_time);
        const slotEnd = slotStart + slot.duration_minutes;

        let overlap = false;
        const checkTeamRest = (teamId: string) => {
          const teamMatches = teamMatchTimes.get(teamId) || [];
          for (const mTime of teamMatches) {
            if (Math.max(slotStart, mTime.start) < Math.min(slotEnd, mTime.end)) {
              return false;
            }
            let rest = 0;
            if (slotStart >= mTime.start) {
              rest = restMode === "end_to_start" ? slotStart - mTime.end : slotStart - mTime.start;
            } else {
              rest = restMode === "end_to_start" ? mTime.start - slotEnd : mTime.start - slotStart;
            }
            if (rest < minRest) {
              return false;
            }
          }
          return true;
        };

        if (hTeam && !checkTeamRest(hTeam)) overlap = true;
        if (aTeam && !checkTeamRest(aTeam)) overlap = true;

        if (!overlap) {
          assignedSlotId = slot.id;
          occupiedSlots.add(slot.id);
          
          if (hTeam) {
            const arr = teamMatchTimes.get(hTeam) || [];
            arr.push({ start: slotStart, end: slotEnd });
            teamMatchTimes.set(hTeam, arr);
          }
          if (aTeam) {
            const arr = teamMatchTimes.get(aTeam) || [];
            arr.push({ start: slotStart, end: slotEnd });
            teamMatchTimes.set(aTeam, arr);
          }
          break;
        }
      }

      if (assignedSlotId) {
        assignments.push({ match_id: match.id, slot_id: assignedSlotId });
      } else {
        // Fallback to any slot that fits
        for (const slot of sortedSlots) {
          if (!occupiedSlots.has(slot.id) && slot.duration_minutes >= mDur) {
            assignedSlotId = slot.id;
            occupiedSlots.add(slot.id);
            assignments.push({ match_id: match.id, slot_id: assignedSlotId });
            break;
          }
        }
      }
    }

    return {
      status: assignments.length === payload.matchups.length ? "OPTIMAL" : "FEASIBLE",
      objective: 0,
      bound: 0,
      assignments,
      diagnostics: {
        message: "Planification simulée localement (SOLVER_URL absent).",
        scheduled_matches: assignments.length,
        total_matches: payload.matchups.length,
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
