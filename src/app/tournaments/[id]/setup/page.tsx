import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/clerk";
import { tournaments, tournamentMembers } from "@/lib/db/schema";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ChevronRight, Settings, Sliders, Calendar, Trophy, Shield } from "lucide-react";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentSetupPage({ params }: SetupPageProps) {
  const { id } = await params;
  const userId = await requireUserId();
  const db = await getDb();

  // Récupérer les détails du tournoi et vérifier si l'utilisateur est membre
  let tournament = null;
  let memberRole = null;

  try {
    const results = await db
      .select({
        tournament: tournaments,
        member: tournamentMembers,
      })
      .from(tournaments)
      .innerJoin(tournamentMembers, eq(tournaments.id, tournamentMembers.tournamentId))
      .where(
        and(
          eq(tournaments.id, id),
          eq(tournamentMembers.userId, userId)
        )
      );

    if (results.length > 0) {
      tournament = results[0].tournament;
      memberRole = results[0].member.role;
    }
  } catch (error) {
    console.error("❌ Error fetching tournament details:", error);
  }

  if (!tournament) {
    notFound();
  }

  // Formatter de date simple
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString("fr-CA", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-8">
      {/* Breadcrumbs / Back button */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/tournaments" className="hover:text-zinc-300 transition-colors">
          Tournois
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-zinc-300">{tournament.name}</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">{tournament.name}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Assistant de configuration de votre tournoi de hockey.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tournaments"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white cursor-pointer"
            )}
          >
            Retour aux tournois
          </Link>
        </div>
      </div>

      {/* Jalon 2 Banner Info */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-blue-950/40 to-cyan-950/20 border border-blue-900/40 text-zinc-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-900/50 text-blue-200 border border-blue-800/60">
            Étape en attente — Jalon 2
          </div>
          <h2 className="text-lg font-bold text-white">Assistant de configuration en 6 étapes</h2>
          <p className="text-zinc-400 text-sm leading-relaxed max-w-2xl">
            L'assistant complet permettant de configurer vos arénas, glaces, catégories de jeu, équipes, formats de tournoi et règles de départage sera pleinement fonctionnel lors du **Jalon 2**.
          </p>
        </div>
        <div className="flex items-center gap-3 self-stretch md:self-auto justify-end">
          <div className="h-10 w-10 rounded-xl bg-blue-900/30 flex items-center justify-center text-blue-400 border border-blue-800/20">
            <Sliders className="h-5 w-5 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Tournament Details Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Info */}
        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Settings className="h-5 w-5 text-blue-400" />
              Paramètres fondamentaux
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Détails configurés lors de la création du tournoi.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-0 border-t border-zinc-800/40 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6">
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Nom du tournoi</span>
                <p className="text-white font-medium">{tournament.name}</p>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Rôle de l'utilisateur</span>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Shield className="h-4 w-4 text-blue-400" />
                  <span className="capitalize">{memberRole === "owner" ? "Propriétaire" : "Organisateur"}</span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Période du tournoi</span>
                <div className="flex items-center gap-2 text-zinc-300">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <span>
                    Du {formatDate(tournament.startDate)} au {formatDate(tournament.endDate)}
                  </span>
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500 font-semibold uppercase tracking-wider">Mode de calcul du repos</span>
                <p className="text-zinc-300 font-medium">
                  {tournament.restCalculationMode === "end_to_start" ? "Fin à début" : "Début à début"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sidebar Info */}
        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <Trophy className="h-5 w-5 text-cyan-400" />
              Prochaines étapes
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Ce que vous pourrez configurer bientôt :
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-0 border-t border-zinc-800/40 mt-2">
            <ul className="space-y-3 text-sm text-zinc-400 list-decimal list-inside pt-6">
              <li>Arénas et glaces de jeu</li>
              <li>Catégories (Âge / Niveau / Sexe)</li>
              <li>Équipes participantes</li>
              <li>Formats (Round-robin, pools, brackets)</li>
              <li>Contraintes dures et souples</li>
              <li>Ordre des critères de départage</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
