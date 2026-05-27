import { auth } from "@clerk/nextjs/server";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && process.env.NODE_ENV !== "production") {
  console.warn("⚠️ DATABASE_URL is not set. DB calls will fail.");
}

export async function getDb() {
  const url = databaseUrl || "postgres://dummy:dummy@localhost:5432/dummy";

  try {
    const { getToken } = await auth();
    // "neon" est le nom du template JWT configuré dans Clerk pour Neon
    const token = await getToken({ template: "neon" });

    if (token) {
      // Connexion via le rôle `authenticated` avec RLS Neon.
      // Si DATABASE_AUTHENTICATED_URL n'est pas configuré, on le dérive de DATABASE_URL.
      const authenticatedUrl =
        process.env.DATABASE_AUTHENTICATED_URL ||
        url.replace(/(postgres(?:ql)?:\/\/)[^:]*(?::[^@]*)?(@.+)/, "$1authenticated:$2");

      const sql = neon(authenticatedUrl, {
        authToken: async () => token,
      });
      return drizzle({ client: sql, schema });
    }
  } catch (error) {
    // Contexte hors-requête (build) ou utilisateur non connecté
  }

  // Fallback sur la connexion standard (non authentifiée ou via mot de passe classique)
  const sql = neon(url);
  return drizzle({ client: sql, schema });
}


