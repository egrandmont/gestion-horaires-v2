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
  pools,
  poolMemberships,
  matches,
} from "@/lib/db/schema";
import { solveSchedule } from "@/lib/solver-client";

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

/**
 * Génère toutes les confrontations préliminaires pour chaque catégorie du tournoi.
 * Répartit automatiquement en poules si le format est "pools".
 */
export async function generatePreliminaryMatchupsAction(tournamentId: string) {
  try {
    const db = await getDb();
    await requireUserId();

    const generatedMatches = await db.transaction(async (tx) => {
      // 1. Charger toutes les catégories pour ce tournoi
      const catList = await tx
        .select()
        .from(categories)
        .where(eq(categories.tournamentId, tournamentId));

      if (catList.length === 0) {
        throw new Error("Aucune catégorie de configurée pour ce tournoi.");
      }

      const catIds = catList.map((c) => c.id);

      // 2. Nettoyer les anciens matchs préliminaires et poules (on cascade automatique)
      await tx
        .delete(matches)
        .where(and(inArray(matches.categoryId, catIds), eq(matches.phase, "preliminary")));

      await tx.delete(pools).where(inArray(pools.categoryId, catIds));

      // 3. Pour chaque catégorie, générer les affrontements selon le format
      for (const cat of catList) {
        // Charger le format de la catégorie
        const [fmt] = await tx
          .select()
          .from(formats)
          .where(eq(formats.categoryId, cat.id));

        const prelimType = fmt?.prelimType || "round_robin";
        const gameMinutes = fmt?.prelimGameMinutes || 60;
        const resurfaceMinutes = fmt?.prelimResurfaceMinutes || 10;
        const slotMinutes = fmt?.prelimSlotMinutes || 70;

        // Charger toutes les équipes de cette catégorie
        const catTeams = await tx
          .select()
          .from(teams)
          .where(eq(teams.categoryId, cat.id));

        if (catTeams.length < 2) {
          // Besoin d'au moins 2 équipes pour faire des matchs
          continue;
        }

        if (prelimType === "pools") {
          // Diviser en poules équilibrées de 3 à 5 équipes
          // num_pools = Math.floor((N + 2) / 4), minimum 1
          const numPools = Math.max(1, Math.floor((catTeams.length + 2) / 4));
          
          // Initialiser les listes d'équipes par poule
          const poolBuckets: typeof catTeams[] = Array.from({ length: numPools }, () => []);
          catTeams.forEach((team, idx) => {
            poolBuckets[idx % numPools].push(team);
          });

          // Créer chaque poule en DB, lier les équipes et générer les confrontations
          for (let pIdx = 0; pIdx < numPools; pIdx++) {
            const poolTeams = poolBuckets[pIdx];
            if (poolTeams.length < 2) continue;

            const poolName = `Poule ${String.fromCharCode(65 + pIdx)}`;
            const [insertedPool] = await tx
              .insert(pools)
              .values({
                categoryId: cat.id,
                name: poolName,
              })
              .returning();

            // Lier les équipes à la poule
            await tx.insert(poolMemberships).values(
              poolTeams.map((t) => ({
                poolId: insertedPool.id,
                teamId: t.id,
              }))
            );

            // Générer le round-robin de poule
            for (let i = 0; i < poolTeams.length; i++) {
              for (let j = i + 1; j < poolTeams.length; j++) {
                await tx.insert(matches).values({
                  categoryId: cat.id,
                  poolId: insertedPool.id,
                  phase: "preliminary",
                  homeTeamId: poolTeams[i].id,
                  awayTeamId: poolTeams[j].id,
                  gameMinutes,
                  resurfaceMinutes,
                  slotMinutes,
                  status: "scheduled",
                });
              }
            }
          }
        } else {
          // Mode round-robin global
          for (let i = 0; i < catTeams.length; i++) {
            for (let j = i + 1; j < catTeams.length; j++) {
              await tx.insert(matches).values({
                categoryId: cat.id,
                phase: "preliminary",
                homeTeamId: catTeams[i].id,
                awayTeamId: catTeams[j].id,
                gameMinutes,
                resurfaceMinutes,
                slotMinutes,
                status: "scheduled",
              });
            }
          }
        }
      }

      const matchesResult = await tx
        .select()
        .from(matches)
        .where(and(inArray(matches.categoryId, catIds), eq(matches.phase, "preliminary")));

      return matchesResult.map((m) => ({
        id: m.id,
        categoryId: m.categoryId,
        poolId: m.poolId || undefined,
        homeTeamId: m.homeTeamId || undefined,
        awayTeamId: m.awayTeamId || undefined,
        surfaceId: m.surfaceId || undefined,
        slotId: m.slotId || undefined,
        phase: m.phase as "preliminary" | "playoff",
      }));
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    return { success: true, matches: generatedMatches };
  } catch (error: any) {
    console.error("❌ Error in generatePreliminaryMatchupsAction:", error);
    return { success: false, error: error.message || "Erreur de génération des confrontations." };
  }
}

/**
 * Lance le solveur d'optimisation (Modal / local mock) pour planifier les matchs préliminaires générés.
 */
export async function runPreliminarySolverAction(tournamentId: string) {
  try {
    const db = await getDb();
    await requireUserId();

    // 1. Charger les métadonnées fondamentales du tournoi
    const [tournament] = await db
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, tournamentId));

    if (!tournament) {
      throw new Error("Tournoi introuvable.");
    }

    // 2. Charger les catégories et leurs équipes
    const catList = await db
      .select()
      .from(categories)
      .where(eq(categories.tournamentId, tournamentId));

    if (catList.length === 0) {
      throw new Error("Aucune catégorie dans ce tournoi.");
    }

    const catIds = catList.map((c) => c.id);
    const teamList = await db
      .select()
      .from(teams)
      .where(inArray(teams.categoryId, catIds));

    // 3. Charger tous les créneaux libres disponibles du tournoi
    const arenaList = await db
      .select()
      .from(arenas)
      .where(eq(arenas.tournamentId, tournamentId));

    if (arenaList.length === 0) {
      throw new Error("Veuillez configurer au moins un aréna.");
    }

    const arenaIds = arenaList.map((a) => a.id);
    const surfaceList = await db
      .select()
      .from(surfaces)
      .where(inArray(surfaces.arenaId, arenaIds));

    if (surfaceList.length === 0) {
      throw new Error("Veuillez configurer au moins une glace.");
    }

    const surfaceIds = surfaceList.map((s) => s.id);
    const slotList = await db
      .select()
      .from(timeSlots)
      .where(
        and(
          inArray(timeSlots.surfaceId, surfaceIds),
          eq(timeSlots.status, "open")
        )
      );

    if (slotList.length === 0) {
      throw new Error("Veuillez ajouter des plages horaires (créneaux ouverts) pour votre tournoi.");
    }

    // 4. Charger toutes les confrontations préliminaires créées
    const matchList = await db
      .select()
      .from(matches)
      .where(
        and(
          inArray(matches.categoryId, catIds),
          eq(matches.phase, "preliminary")
        )
      );

    if (matchList.length === 0) {
      throw new Error("Veuillez d'abord générer les affrontements préliminaires à l'étape 7.");
    }

    // 5. Charger les contraintes
    const constraintList = await db
      .select()
      .from(constraints)
      .where(eq(constraints.tournamentId, tournamentId));

    // Trouver le repos minimum strict (min_rest)
    const minRestRule = constraintList.find((c) => c.type === "min_rest");
    const minRestMinutes = minRestRule?.params ? (minRestRule.params as any).min_minutes : 180;

    // Prépare le payload de l'API solveur
    const payload = {
      tournament_id: tournamentId,
      phase: "preliminary" as const,
      rest_calculation_mode: tournament.restCalculationMode,
      teams: teamList.map((t) => ({
        id: t.id,
        category_id: t.categoryId,
        name: t.name,
        club: t.club || undefined,
      })),
      slots: slotList.map((s) => ({
        id: s.id,
        surface_id: s.surfaceId,
        date: s.date,
        start_time: s.startTime,
        duration_minutes: s.durationMinutes,
      })),
      matchups: matchList.map((m) => ({
        id: m.id,
        category_id: m.categoryId,
        pool_id: m.poolId || undefined,
        home_team_id: m.homeTeamId || undefined,
        away_team_id: m.awayTeamId || undefined,
        duration_minutes: m.slotMinutes,
      })),
      hard_constraints: {
        min_rest_minutes: minRestMinutes,
        prevent_team_overlap: true,
        respect_ice_capacity: true,
      },
      soft_constraints: {
        target_rest_minutes: 240,
        max_daily_games_per_team: 2,
        weights: {
          rest_target_deviation: 10,
          daily_game_limit_violation: 100,
          long_wait_between_games: 5,
        },
      },
      time_limit_seconds: 300,
      seed: 42,
    };

    // 6. Appeler le solveur d'optimisation
    const result = await solveSchedule(payload);

    if (result.status === "INFEASIBLE") {
      return {
        success: false,
        error: result.diagnostics?.message || "La planification est infaisable avec les contraintes courantes.",
      };
    }

    // Map rapide pour retrouver la surface liée à un créneau (slot_id)
    const slotSurfaceMap = new Map<string, string>();
    slotList.forEach((s) => {
      slotSurfaceMap.set(s.id, s.surfaceId);
    });

    // 7. Enregistrer les résultats de planification en DB
    await db.transaction(async (tx) => {
      // Réinitialiser les anciennes affectations de la ronde préliminaire pour ce tournoi
      await tx
        .update(matches)
        .set({
          slotId: null,
          surfaceId: null,
        })
        .where(
          and(
            inArray(matches.categoryId, catIds),
            eq(matches.phase, "preliminary")
          )
        );

      // Appliquer les nouvelles affectations
      for (const assign of result.assignments) {
        const surfId = slotSurfaceMap.get(assign.slot_id);
        if (!surfId) continue;

        await tx
          .update(matches)
          .set({
            slotId: assign.slot_id,
            surfaceId: surfId,
          })
          .where(eq(matches.id, assign.match_id));
      }
    });

    revalidatePath(`/tournaments/${tournamentId}/setup`);
    revalidatePath(`/tournaments/${tournamentId}/schedule`);

    return {
      success: true,
      diagnostics: result.diagnostics,
    };
  } catch (error: any) {
    console.error("❌ Error in runPreliminarySolverAction:", error);
    return { success: false, error: error.message || "Erreur lors de l'exécution du solveur." };
  }
}
