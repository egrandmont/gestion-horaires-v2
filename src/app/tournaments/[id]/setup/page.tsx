import Link from "next/link";
import { notFound } from "next/navigation";
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
  matches,
} from "@/lib/db/schema";
import { WizardSteps } from "./wizard-steps";
import { ChevronRight } from "lucide-react";
import { ArenaInput, TimeSlotInput, CategoryInput, TeamInput, SaveFormatInput, SaveConstraintInput } from "../../actions";

export const dynamic = "force-dynamic";

interface SetupPageProps {
  params: Promise<{ id: string }>;
}

export default async function TournamentSetupPage({ params }: SetupPageProps) {
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

  // 2. Récupérer les arénas et glaces du tournoi
  const arenasResult = await db
    .select()
    .from(arenas)
    .where(eq(arenas.tournamentId, id));

  const arenaIds = arenasResult.map((a) => a.id);
  const surfacesResult = arenaIds.length > 0
    ? await db.select().from(surfaces).where(inArray(surfaces.arenaId, arenaIds))
    : [];

  const initialArenas: ArenaInput[] = arenasResult.map((a) => ({
    id: a.id,
    name: a.name,
    address: a.address || undefined,
    surfaces: surfacesResult
      .filter((s) => s.arenaId === a.id)
      .map((s) => ({ id: s.id, name: s.name })),
  }));

  // 3. Récupérer les plages horaires (time slots) pour toutes les glaces du tournoi
  const surfaceIds = surfacesResult.map((s) => s.id);
  const timeSlotsResult = surfaceIds.length > 0
    ? await db.select().from(timeSlots).where(inArray(timeSlots.surfaceId, surfaceIds))
    : [];

  const initialTimeSlots: TimeSlotInput[] = timeSlotsResult.map((ts) => ({
    id: ts.id,
    surfaceId: ts.surfaceId,
    date: ts.date,
    startTime: ts.startTime,
    durationMinutes: ts.durationMinutes,
    status: ts.status as "open" | "blocked",
    note: ts.note || undefined,
  }));

  // 4. Récupérer les catégories
  const categoriesResult = await db
    .select()
    .from(categories)
    .where(eq(categories.tournamentId, id));

  const initialCategories: CategoryInput[] = categoriesResult.map((c) => ({
    id: c.id,
    ageValue: c.ageValue,
    ageConvention: c.ageConvention as "year" | "tier",
    level: c.level || undefined,
    gender: c.gender as "M" | "F" | undefined,
    displayLabel: c.displayLabel,
  }));

  const categoryIds = categoriesResult.map((c) => c.id);

  // 5. Récupérer les équipes par catégorie
  const teamsResult = categoryIds.length > 0
    ? await db.select().from(teams).where(inArray(teams.categoryId, categoryIds))
    : [];

  const initialTeams: Record<string, TeamInput[]> = {};
  for (const catId of categoryIds) {
    initialTeams[catId] = teamsResult
      .filter((t) => t.categoryId === catId)
      .map((t) => ({
        id: t.id,
        name: t.name,
        club: t.club || undefined,
      }));
  }

  // 6. Récupérer le format de jeu par catégorie
  const formatsResult = categoryIds.length > 0
    ? await db.select().from(formats).where(inArray(formats.categoryId, categoryIds))
    : [];

  const initialFormats: Record<string, SaveFormatInput> = {};
  for (const catId of categoryIds) {
    const f = formatsResult.find((x) => x.categoryId === catId);
    if (f) {
      initialFormats[catId] = {
        prelimType: f.prelimType as "round_robin" | "pools",
        guaranteedMatches: f.guaranteedMatches,
        prelimGameMinutes: f.prelimGameMinutes,
        prelimResurfaceMinutes: f.prelimResurfaceMinutes,
        prelimSlotMinutes: f.prelimSlotMinutes,
        playoffGameMinutes: f.playoffGameMinutes,
        playoffResurfaceMinutes: f.playoffResurfaceMinutes,
        playoffSlotMinutes: f.playoffSlotMinutes,
      };
    }
  }

  // 7. Récupérer les contraintes
  const constraintsResult = await db
    .select()
    .from(constraints)
    .where(eq(constraints.tournamentId, id));

  const initialConstraints: SaveConstraintInput[] = constraintsResult.map((c) => ({
    id: c.id,
    scope: c.scope as "tournament" | "category" | "team",
    scopeId: c.scopeId || undefined,
    type: c.type,
    params: c.params as Record<string, any>,
    isHard: c.isHard,
    weight: c.weight || undefined,
  }));

  // 8. Récupérer l'ordre des critères de départage
  const tiebreakRulesResult = await db
    .select()
    .from(tiebreakRules)
    .where(eq(tiebreakRules.tournamentId, id));

  const initialTiebreakers = tiebreakRulesResult.length > 0
    ? (tiebreakRulesResult[0].orderedCriteria as string[])
    : [];

  // 9. Récupérer les matchs déjà générés
  const matchesResult = categoryIds.length > 0
    ? await db.select().from(matches).where(inArray(matches.categoryId, categoryIds))
    : [];

  const initialMatches = matchesResult.map((m) => ({
    id: m.id,
    categoryId: m.categoryId,
    poolId: m.poolId || undefined,
    homeTeamId: m.homeTeamId || undefined,
    awayTeamId: m.awayTeamId || undefined,
    surfaceId: m.surfaceId || undefined,
    slotId: m.slotId || undefined,
    phase: m.phase as "preliminary" | "playoff",
  }));

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
            Configurez et préparez les paramètres de planification de votre tournoi de hockey.
          </p>
        </div>
      </div>

      {/* Step Wizard Client Component */}
      <WizardSteps
        tournament={{
          id: tournament.id,
          name: tournament.name,
          startDate: tournament.startDate,
          endDate: tournament.endDate,
          timezone: tournament.timezone,
          status: tournament.status as "planning" | "active" | "completed",
          restCalculationMode: tournament.restCalculationMode as "start_to_start" | "end_to_start",
        }}
        initialArenas={initialArenas}
        initialTimeSlots={initialTimeSlots}
        initialCategories={initialCategories}
        initialTeams={initialTeams}
        initialFormats={initialFormats}
        initialConstraints={initialConstraints}
        initialTiebreakers={initialTiebreakers}
        initialMatches={initialMatches}
      />
    </div>
  );
}
