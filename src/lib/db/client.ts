import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== "production") {
  console.warn("⚠️ DATABASE_URL is not set. DB calls will fail.");
}

/**
 * Récupère une instance de Drizzle configurée.
 * Si l'utilisateur est authentifié, on injecte son JWT Clerk pour que Neon Authorize
 * applique la RLS native de PostgreSQL de manière sécurisée.
 */
export async function getDb() {
  const url = databaseUrl || "postgres://dummy:dummy@localhost:5432/dummy";

  try {
    const { getToken } = await auth();
    // "neon" est le nom du template JWT configuré dans Clerk pour Neon
    const token = await getToken({ template: "neon" });

    if (token) {
      // Remplace le mot de passe d'origine par le jeton JWT Clerk dans l'URL de connexion
      const authenticatedUrl = url.replace(
        /(postgres(?:ql)?:\/\/[^:]+:)[^@]+(@.+)/,
        `$1${token}$2`
      );
      const sql = neon(authenticatedUrl);
      return drizzle({ client: sql, schema });
    }
  } catch (error) {
    // Contexte hors-requête (build) ou utilisateur non connecté
  }

  // Fallback sur la connexion standard (non authentifiée ou via mot de passe classique)
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}

