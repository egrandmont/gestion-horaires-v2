import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Les routes /tournaments et ses sous-routes (ex: wizard, configuration) nécessitent une authentification
const isProtectedRoute = createRouteMatcher(["/tournaments(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Ignorer les fichiers internes de Next.js et tous les fichiers statiques (avec extension)
    "/((?!_next|[^?]*\\.[^?]+$).*)",
    // Toujours exécuter pour les routes d'API
    "/(api|trpc)(.*)",
  ],
};
