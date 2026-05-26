import { auth } from "@clerk/nextjs/server";

/**
 * Récupère l'ID de l'utilisateur connecté depuis le contexte Clerk.
 * Retourne null si l'utilisateur n'est pas connecté.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId;
}

/**
 * Exige que l'utilisateur soit connecté, sinon lève une erreur.
 * Utile pour sécuriser les Server Actions et API routes.
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Authentification requise");
  }
  return userId;
}
