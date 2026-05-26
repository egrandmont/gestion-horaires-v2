import { SolveSchedulePayload, SolveScheduleResult } from "../solver-client";

export interface ValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Valide de manière indépendante qu'un horaire généré respecte toutes les contraintes dures.
 * Ce module sert de garde-fou non négociable avant la publication d'un horaire.
 * (Logique détaillée à compléter au Jalon 3)
 */
export function validateSchedule(
  payload: SolveSchedulePayload,
  result: SolveScheduleResult
): ValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Pour le Jalon 1, la validation est un stub valide par défaut
  if (result.status === "INFEASIBLE") {
    errors.push("Le solveur a retourné un état infaisable (INFEASIBLE).");
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
