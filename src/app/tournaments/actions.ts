"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/clerk";
import { tournaments, tournamentMembers } from "@/lib/db/schema";

export interface CreateTournamentInput {
  name: string;
  startDate: string;
  endDate: string;
  restCalculationMode: "start_to_start" | "end_to_start";
}

/**
 * Action serveur pour créer un tournoi.
 * Insère le tournoi et définit le créateur comme propriétaire (owner) dans la même transaction.
 */
export async function createTournamentAction(data: CreateTournamentInput) {
  try {
    const db = await getDb();
    const userId = await requireUserId();

    if (!data.name || !data.startDate || !data.endDate) {
      return { success: false, error: "Tous les champs obligatoires doivent être remplis." };
    }

    const newTournament = await db.transaction(async (tx) => {
      // 1. Insérer le tournoi
      const [inserted] = await tx
        .insert(tournaments)
        .values({
          name: data.name,
          startDate: data.startDate,
          endDate: data.endDate,
          restCalculationMode: data.restCalculationMode,
          status: "planning",
          isPublic: false,
        })
        .returning();

      // 2. Insérer le membre créateur en tant que 'owner'
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
