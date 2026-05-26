"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/clerk";
import {
  tournaments,
  tournamentMembers,
  arenas,
  surfaces,
  timeSlots,
  categories,
  teams,
  formats,
  constraints,
  tiebreakRules,
} from "@/lib/db/schema";

// --- TYPES ---

export interface CreateTournamentInput {
  name: string;
  startDate: string;
  endDate: string;
  restCalculationMode: "start_to_start" | "end_to_start";
  timezone: string;
}

export interface UpdateTournamentInput extends CreateTournamentInput {
  id: string;
  status: "planning" | "active" | "completed";
}

export interface SurfaceInput {
  id?: string;
  name: string;
}

export interface ArenaInput {
  id?: string;
  name: string;
  address?: string;
  surfaces: SurfaceInput[];
}

export interface TimeSlotInput {
  id?: string;
  surfaceId: string;
  date: string;
  startTime: string; // HH:MM
  durationMinutes: number;
  status: "open" | "blocked";
  note?: string;
}

export interface CategoryInput {
  id?: string;
  ageValue: string; // ex: M13, 2012
  ageConvention: "year" | "tier";
  level?: string; // ex: AA, A, D1
  gender?: "M" | "F" | null;
  displayLabel: string;
}

export interface TeamInput {
  id?: string;
  name: string;
  club?: string;
}

export interface SaveFormatInput {
  prelimType: "round_robin" | "pools";
  guaranteedMatches: number;
  prelimGameMinutes: number;
  prelimResurfaceMinutes: number;
  prelimSlotMinutes: number;
  playoffGameMinutes: number;
  playoffResurfaceMinutes: number;
  playoffSlotMinutes: number;
}

export interface SaveConstraintInput {
  id?: string;
  scope: "tournament" | "category" | "team";
  scopeId?: string;
  type: string;
  params: Record<string, any>;
  isHard: boolean;
  weight?: number;
}

// --- ACTIONS ---

/**
 * Création d'un tournoi (Jalon 1)
 */
export async function createTournamentAction(data: CreateTournamentInput) {
  try {
    const db = await getDb();
    const userId = await requireUserId();

    if (!data.name || !data.startDate || !data.endDate) {
      return { success: false, error: "Tous les champs obligatoires doivent être remplis." };
    }

    const newTournament = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(tournaments)
        .values({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          restCalculationMode: data.restCalculationMode,
          timezone: data.timezone || "America/Montreal",
          status: "planning",
          isPublic: false,
        })
        .returning();

      await tx.insert(tournamentMembers).values({
        tournamentId: inserted.id,
        userId: userId,
        role: "owner",
      });

      return inserted;
    });

    revalidatePath("/tournaments");
    return { success: true, id: newTournament.id };
  } catch (error: any) {
    console.error("❌ Error in createTournamentAction:", error);
    return { success: false, error: error.message || "Une erreur est survenue lors de la création." };
  }
}

/**
 * Étape 1 : Mettre à jour les infos de base d'un tournoi
 */
export async function updateTournamentAction(data: UpdateTournamentInput) {
  try {
    const db = await getDb();
    await requireUserId(); // Vérification de session, RLS fera le reste

    await db
      .update(tournaments)
      .set({
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        restCalculationMode: data.restCalculationMode,
        status: data.status,
        timezone: data.timezone,
      })
      .where(eq(tournaments.id, data.id));

    revalidatePath(`/tournaments/${data.id}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in updateTournamentAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 2 : Sauvegarder les arénas et leurs glaces
 */
export async function saveArenasAndSurfacesAction(tournamentId: string, arenasData: ArenaInput[]) {
  try {
    const db = await getDb();
    await requireUserId();

    await db.transaction(async (tx) => {
      // 1. Récupérer les arénas actuelles pour savoir lesquelles supprimer
      const currentArenas = await tx
        .select({ id: arenas.id })
        .from(arenas)
        .where(eq(arenas.tournamentId, tournamentId));
      
      const incomingArenaIds = arenasData.map(a => a.id).filter((id): id is string => !!id);
      const arenasToDelete = currentArenas.filter(a => !incomingArenaIds.includes(a.id));

      if (arenasToDelete.length > 0) {
        await tx
          .delete(arenas)
          .where(
            and(
              eq(arenas.tournamentId, tournamentId),
              inArray(arenas.id, arenasToDelete.map(a => a.id))
            )
          );
      }

      // 2. Traiter chaque arène
      for (const arenaData of arenasData) {
        let arenaId = arenaData.id;

        if (arenaId) {
          // Mise à jour arène existante
          await tx
            .update(arenas)
            .set({ name: arenaData.name, address: arenaData.address })
            .where(eq(arenas.id, arenaId));
        } else {
          // Création nouvelle arène
          const [inserted] = await tx
            .insert(arenas)
            .values({
              tournamentId,
              name: arenaData.name,
              address: arenaData.address,
            })
            .returning();
          arenaId = inserted.id;
        }

        // Gérer les surfaces pour cette arène
        const currentSurfaces = await tx
          .select({ id: surfaces.id })
          .from(surfaces)
          .where(eq(surfaces.arenaId, arenaId));

        const incomingSurfaceIds = arenaData.surfaces.map(s => s.id).filter((id): id is string => !!id);
        const surfacesToDelete = currentSurfaces.filter(s => !incomingSurfaceIds.includes(s.id));

        if (surfacesToDelete.length > 0) {
          await tx
            .delete(surfaces)
            .where(inArray(surfaces.id, surfacesToDelete.map(s => s.id)));
        }

        for (const surfaceData of arenaData.surfaces) {
          if (surfaceData.id) {
            await tx
              .update(surfaces)
              .set({ name: surfaceData.name })
              .where(eq(surfaces.id, surfaceData.id));
          } else {
            await tx
              .insert(surfaces)
              .values({
                arenaId,
                name: surfaceData.name,
              });
          }
        }
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveArenasAndSurfacesAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 2 (plages) : Sauvegarder les créneaux horaires pour une patinoire
 */
export async function saveTimeSlotsAction(tournamentId: string, slotsData: TimeSlotInput[]) {
  try {
    const db = await getDb();
    await requireUserId();

    if (slotsData.length === 0) {
      return { success: true };
    }

    await db.transaction(async (tx) => {
      // Pour ce Jalon, on synchronise les plages : on supprime les anciennes pour les patinoires concernées
      const surfaceIds = Array.from(new Set(slotsData.map(s => s.surfaceId)));
      
      if (surfaceIds.length > 0) {
        await tx
          .delete(timeSlots)
          .where(inArray(timeSlots.surfaceId, surfaceIds));
      }

      // Insérer les nouvelles plages
      for (const slot of slotsData) {
        await tx.insert(timeSlots).values({
          surfaceId: slot.surfaceId,
          date: slot.date,
          startTime: slot.startTime,
          durationMinutes: slot.durationMinutes,
          status: slot.status,
          note: slot.note,
        });
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveTimeSlotsAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 3 : Sauvegarder les catégories de jeu
 */
export async function saveCategoriesAction(tournamentId: string, categoriesData: CategoryInput[]) {
  try {
    const db = await getDb();
    await requireUserId();

    await db.transaction(async (tx) => {
      const currentCats = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.tournamentId, tournamentId));

      const incomingIds = categoriesData.map(c => c.id).filter((id): id is string => !!id);
      const catsToDelete = currentCats.filter(c => !incomingIds.includes(c.id));

      if (catsToDelete.length > 0) {
        await tx
          .delete(categories)
          .where(
            and(
              eq(categories.tournamentId, tournamentId),
              inArray(categories.id, catsToDelete.map(c => c.id))
            )
          );
      }

      for (const cat of categoriesData) {
        if (cat.id) {
          await tx
            .update(categories)
            .set({
              ageValue: cat.ageValue,
              ageConvention: cat.ageConvention,
              level: cat.level || null,
              gender: cat.gender || null,
              displayLabel: cat.displayLabel,
            })
            .where(eq(categories.id, cat.id));
        } else {
          await tx
            .insert(categories)
            .values({
              tournamentId,
              ageValue: cat.ageValue,
              ageConvention: cat.ageConvention,
              level: cat.level || null,
              gender: cat.gender || null,
              displayLabel: cat.displayLabel,
            });
        }
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveCategoriesAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 4 : Sauvegarder les équipes d'une catégorie (avec support d'import en bloc)
 */
export async function saveTeamsAction(tournamentId: string, categoryId: string, teamsData: TeamInput[]) {
  try {
    const db = await getDb();
    await requireUserId();

    await db.transaction(async (tx) => {
      // Récupérer les équipes courantes de la catégorie
      const currentTeams = await tx
        .select({ id: teams.id })
        .from(teams)
        .where(eq(teams.categoryId, categoryId));

      const incomingIds = teamsData.map(t => t.id).filter((id): id is string => !!id);
      const teamsToDelete = currentTeams.filter(t => !incomingIds.includes(t.id));

      if (teamsToDelete.length > 0) {
        await tx
          .delete(teams)
          .where(
            and(
              eq(teams.categoryId, categoryId),
              inArray(teams.id, teamsToDelete.map(t => t.id))
            )
          );
      }

      for (const team of teamsData) {
        if (team.id) {
          await tx
            .update(teams)
            .set({ name: team.name, club: team.club || null })
            .where(eq(teams.id, team.id));
        } else {
          await tx
            .insert(teams)
            .values({
              categoryId,
              name: team.name,
              club: team.club || null,
            });
        }
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveTeamsAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 5 : Sauvegarder le format de jeu pour une catégorie
 */
export async function saveFormatAction(tournamentId: string, categoryId: string, formatData: SaveFormatInput) {
  try {
    const db = await getDb();
    await requireUserId();

    await db.transaction(async (tx) => {
      // Vérifier si le format existe déjà
      const existing = await tx
        .select()
        .from(formats)
        .where(eq(formats.categoryId, categoryId));

      if (existing.length > 0) {
        await tx
          .update(formats)
          .set({
            prelimType: formatData.prelimType,
            guaranteedMatches: formatData.guaranteedMatches,
            prelimGameMinutes: formatData.prelimGameMinutes,
            prelimResurfaceMinutes: formatData.prelimResurfaceMinutes,
            prelimSlotMinutes: formatData.prelimSlotMinutes,
            playoffGameMinutes: formatData.playoffGameMinutes,
            playoffResurfaceMinutes: formatData.playoffResurfaceMinutes,
            playoffSlotMinutes: formatData.playoffSlotMinutes,
          })
          .where(eq(formats.categoryId, categoryId));
      } else {
        await tx
          .insert(formats)
          .values({
            categoryId,
            prelimType: formatData.prelimType,
            guaranteedMatches: formatData.guaranteedMatches,
            prelimGameMinutes: formatData.prelimGameMinutes,
            prelimResurfaceMinutes: formatData.prelimResurfaceMinutes,
            prelimSlotMinutes: formatData.prelimSlotMinutes,
            playoffGameMinutes: formatData.playoffGameMinutes,
            playoffResurfaceMinutes: formatData.playoffResurfaceMinutes,
            playoffSlotMinutes: formatData.playoffSlotMinutes,
          });
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveFormatAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}

/**
 * Étape 6 : Sauvegarder les contraintes de règles et l'ordre des critères de départage
 */
export async function saveRulesAndTiebreakersAction(
  tournamentId: string,
  rulesData: SaveConstraintInput[],
  orderedCriteria: string[]
) {
  try {
    const db = await getDb();
    await requireUserId();

    await db.transaction(async (tx) => {
      // 1. Sauvegarder les règles (constraints) : On nettoie et réinsère pour ce tournoi
      await tx
        .delete(constraints)
        .where(eq(constraints.tournamentId, tournamentId));

      for (const rule of rulesData) {
        await tx.insert(constraints).values({
          tournamentId,
          scope: rule.scope,
          scopeId: rule.scopeId || null,
          type: rule.type,
          params: rule.params,
          isHard: rule.isHard,
          weight: rule.weight || null,
        });
      }

      // 2. Sauvegarder la règle de départage (tiebreak_rules)
      const existingTiebreak = await tx
        .select()
        .from(tiebreakRules)
        .where(eq(tiebreakRules.tournamentId, tournamentId));

      if (existingTiebreak.length > 0) {
        await tx
          .update(tiebreakRules)
          .set({ orderedCriteria })
          .where(eq(tiebreakRules.tournamentId, tournamentId));
      } else {
        await tx.insert(tiebreakRules).values({
          tournamentId,
          orderedCriteria,
          scoring: { win: 2, tie: 1, loss: 0 },
        });
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true };
  } catch (error: any) {
    console.error("❌ Error in saveRulesAndTiebreakersAction:", error);
    return { success: false, error: error.message || "Erreur de sauvegarde." };
  }
}
