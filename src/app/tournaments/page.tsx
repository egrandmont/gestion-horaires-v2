import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { requireUserId } from "@/lib/auth/clerk";
import { tournaments, tournamentMembers } from "@/lib/db/schema";
import { CreateTournamentDialog } from "@/components/CreateTournamentDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Trophy, Shield, ArrowRight } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TournamentsPage() {
  const userId = await requireUserId();
  const db = await getDb();

  // Récupérer les tournois liés à l'utilisateur actuel
  let userTournaments: any[] = [];
  let errorMsg = null;

  try {
    userTournaments = await db
      .select({
        id: tournaments.id,
        name: tournaments.name,
        startDate: tournaments.startDate,
        endDate: tournaments.endDate,
        status: tournaments.status,
        role: tournamentMembers.role,
      })
      .from(tournaments)
      .innerJoin(tournamentMembers, eq(tournaments.id, tournamentMembers.tournamentId))
      .where(eq(tournamentMembers.userId, userId));
  } catch (error: any) {
    console.error("❌ Error fetching tournaments:", error);
    errorMsg = "Impossible de charger vos tournois pour le moment. Veuillez vérifier la configuration de votre base de données.";
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "planning":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-950/40 border border-amber-900/60 text-amber-300">
            Planification
          </span>
        );
      case "active":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-950/40 border border-green-900/60 text-green-300">
            En cours
          </span>
        );
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-800 border border-zinc-700 text-zinc-300">
            Terminé
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Title + Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Mes tournois</h1>
          <p className="text-zinc-400 text-sm mt-1">
            Gérez et planifiez vos tournois de hockey.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <CreateTournamentDialog />
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      {/* Main Grid */}
      {userTournaments.length === 0 ? (
        /* Empty State */
        <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm py-16 text-center">
          <CardContent className="flex flex-col items-center max-w-md mx-auto space-y-6">
            <div className="h-16 w-16 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center text-zinc-400">
              <Trophy className="h-8 w-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Aucun tournoi trouvé</h2>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Vous n'avez pas encore créé de tournoi de hockey. Créez-en un nouveau dès maintenant pour commencer la planification !
              </p>
            </div>
            <CreateTournamentDialog />
          </CardContent>
        </Card>
      ) : (
        /* List of tournaments */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}/setup`}
              className="block group"
            >
              <Card className="bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700 group-hover:bg-zinc-900/60 transition-all duration-300 relative h-full flex flex-col justify-between">
                <CardHeader className="space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="p-2.5 rounded-xl bg-blue-900/20 border border-blue-800/20 text-blue-400 group-hover:scale-105 transition-transform">
                      <Trophy className="h-5 w-5" />
                    </div>
                    {getStatusBadge(tournament.status)}
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="text-lg font-bold text-white group-hover:text-blue-400 transition-colors">
                      {tournament.name}
                    </CardTitle>
                    <CardDescription className="text-zinc-400 text-xs">
                      Créé en tant que propriétaire
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <div className="space-y-2 text-sm text-zinc-400 border-t border-zinc-800/60 pt-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-zinc-500" />
                      <span>
                        Du {formatDate(tournament.startDate)} au {formatDate(tournament.endDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-zinc-500" />
                      <span className="capitalize">
                        Rôle : {tournament.role === "owner" ? "Propriétaire" : "Organisateur"}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center text-sm font-semibold text-blue-400 group-hover:text-blue-300 gap-1 pt-2">
                    <span>Accéder à la configuration</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
