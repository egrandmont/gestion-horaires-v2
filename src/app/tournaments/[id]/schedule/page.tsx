import { notFound } from "next/navigation";
import Link from "next/link";
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
  matches,
} from "@/lib/db/schema";
import { ChevronRight, Calendar } from "lucide-react";
import { ScheduleView } from "./schedule-view";

export const dynamic = "force-dynamic";

interface SchedulePageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentSchedulePage({ params }: SchedulePageProps) {
  const { id } = await params;
  const userId = await requireUserId();
  const db = await getDb();

  // 1. Récupérer les détails du tournoi et valider l'appartenance de l'utilisateur
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

  if (results.length === 0) {
    notFound();
  }

  const { tournament } = results[0];

  // 2. Récupérer les catégories
  const categoriesResult = await db
    .select()
    .from(categories)
    .where(eq(categories.tournamentId, id));

  const categoryIds = categoriesResult.map((c) => c.id);

  // 3. Récupérer les équipes
  const teamsResult = categoryIds.length > 0
    ? await db.select().from(teams).where(inArray(teams.categoryId, categoryIds))
    : [];

  // 4. Récupérer les arénas et surfaces
  const arenasResult = await db
    .select()
    .from(arenas)
    .where(eq(arenas.tournamentId, id));

  const arenaIds = arenasResult.map((a) => a.id);
  const surfacesResult = arenaIds.length > 0
    ? await db.select().from(surfaces).where(inArray(surfaces.arenaId, arenaIds))
    : [];

  const surfaceIds = surfacesResult.map((s) => s.id);

  // 5. Récupérer les créneaux horaires
  const timeSlotsResult = surfaceIds.length > 0
    ? await db.select().from(timeSlots).where(inArray(timeSlots.surfaceId, surfaceIds))
    : [];

  // 6. Récupérer tous les matchs
  const matchesResult = categoryIds.length > 0
    ? await db
        .select()
        .from(matches)
        .where(inArray(matches.categoryId, categoryIds))
    : [];

  // Formater les données pour la vue client
  const formattedMatches = matchesResult.map((m) => ({
    id: m.id,
    categoryId: m.categoryId,
    poolId: m.poolId || undefined,
    phase: m.phase,
    surfaceId: m.surfaceId || undefined,
    slotId: m.slotId || undefined,
    homeTeamId: m.homeTeamId || undefined,
    awayTeamId: m.awayTeamId || undefined,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    status: m.status,
  }));

  const formattedSlots = timeSlotsResult.map((ts) => ({
    id: ts.id,
    surfaceId: ts.surfaceId,
    date: ts.date,
    startTime: ts.startTime,
    durationMinutes: ts.durationMinutes,
  }));

  const formattedSurfaces = surfacesResult.map((s) => ({
    id: s.id,
    arenaId: s.arenaId,
    name: s.name,
    arenaName: arenasResult.find((a) => a.id === s.arenaId)?.name || "",
  }));

  return (
    <div className="space-y-8">
      {/* Breadcrumbs / Back button */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/tournaments" className="hover:text-zinc-300 transition-colors">
          Tournois
        </Link>
        <ChevronRight className="h-4 w-4" />
        <Link href={`/tournaments/${id}/setup`} className="hover:text-zinc-300 transition-colors">
          Configuration
        </Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-zinc-300">Horaire & Résultats</span>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-900 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-blue-500" />
            Horaire officiel du tournoi
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Visualisez, filtrez et gérez le calendrier des matchs programmés de {tournament.name}.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/tournaments/${id}/setup`}
            className="px-4 py-2 text-sm bg-zinc-900 hover:bg-zinc-850 text-white rounded-lg border border-zinc-800 font-semibold transition-all cursor-pointer"
          >
            Ajuster la configuration
          </Link>
        </div>
      </div>

      {/* Client View Component */}
      <ScheduleView
        tournament={{ id: tournament.id, name: tournament.name }}
        matches={formattedMatches}
        slots={formattedSlots}
        surfaces={formattedSurfaces}
        categories={categoriesResult}
        teams={teamsResult}
      />
    </div>
  );
}
