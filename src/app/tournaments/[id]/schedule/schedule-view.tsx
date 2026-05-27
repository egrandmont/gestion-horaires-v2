"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Clock, MapPin, Trophy, Shield, Calendar, Filter, RefreshCw, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchView {
  id: string;
  categoryId: string;
  poolId?: string;
  phase: "preliminary" | "playoff";
  surfaceId?: string;
  slotId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
}

interface SlotView {
  id: string;
  surfaceId: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}

interface SurfaceView {
  id: string;
  arenaId: string;
  name: string;
  arenaName: string;
}

interface CategoryView {
  id: string;
  displayLabel: string;
}

interface TeamView {
  id: string;
  categoryId: string;
  name: string;
  club: string | null;
}

interface ScheduleViewProps {
  tournament: { id: string; name: string };
  matches: MatchView[];
  slots: SlotView[];
  surfaces: SurfaceView[];
  categories: CategoryView[];
  teams: TeamView[];
}

export function ScheduleView({
  tournament,
  matches,
  slots,
  surfaces,
  categories,
  teams,
}: ScheduleViewProps) {
  // 1. Détecter les jours de match uniques configurés dans les créneaux horaires
  const uniqueDates = Array.from(new Set(slots.map((s) => s.date))).sort();

  // 2. États des filtres
  const [selectedDate, setSelectedDate] = useState<string>(uniqueDates[0] || "");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string>("all");

  // Helper pour formater les heures
  const formatTimeRange = (startTime: string, durationMins: number) => {
    const [h, m] = startTime.split(":").map(Number);
    const startDate = new Date();
    startDate.setHours(h, m, 0, 0);
    const endDate = new Date(startDate.getTime() + durationMins * 60 * 1000);
    
    const pad = (num: number) => String(num).padStart(2, "0");
    return `${pad(startDate.getHours())}:${pad(startDate.getMinutes())} - ${pad(endDate.getHours())}:${pad(endDate.getMinutes())}`;
  };

  // Helper pour formater les dates lisibles en français
  const formatDateFrench = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("fr-CA", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  };

  // Trouver le nom d'une équipe
  const getTeamName = (teamId?: string) => {
    if (!teamId) return "À déterminer";
    return teams.find((t) => t.id === teamId)?.name || "Équipe inconnue";
  };

  // Trouver le label de catégorie
  const getCategoryLabel = (catId: string) => {
    return categories.find((c) => c.id === catId)?.displayLabel || "Inconnue";
  };

  // Vérifier si des matchs sont planifiés au total
  const hasScheduledMatches = matches.some((m) => m.slotId !== undefined);

  if (!hasScheduledMatches) {
    return (
      <Card className="bg-zinc-900/30 border-zinc-800 backdrop-blur-sm p-8 text-center max-w-xl mx-auto space-y-6 mt-12">
        <CardContent className="pt-6 space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-zinc-950 flex items-center justify-center border border-zinc-850">
            <AlertTriangle className="h-8 w-8 text-amber-500" />
          </div>
          <h2 className="text-xl font-bold text-white">Aucun horaire généré</h2>
          <p className="text-zinc-400 text-sm leading-relaxed">
            Les confrontations de ce tournoi n'ont pas encore été planifiées. 
            Veuillez vous rendre dans l'assistant de configuration pour générer les affrontements et lancer l'optimiseur.
          </p>
          <div className="pt-4">
            <Link
              href={`/tournaments/${tournament.id}/setup`}
              className={cn(
                buttonVariants({ variant: "default" }),
                "bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold cursor-pointer py-2 px-4 h-auto"
              )}
            >
              Configurer et générer
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filtrer les créneaux et leurs matchs associés pour la journée sélectionnée
  const daySlots = slots.filter((s) => s.date === selectedDate);
  const daySlotIds = daySlots.map((s) => s.id);

  // Filtrer les matchs selon les critères choisis
  const filteredMatches = matches.filter((m) => {
    if (!m.slotId || !daySlotIds.includes(m.slotId)) return false;
    if (selectedCategoryId !== "all" && m.categoryId !== selectedCategoryId) return false;
    if (selectedSurfaceId !== "all" && m.surfaceId !== selectedSurfaceId) return false;
    return true;
  });

  // Associer chaque match filtré à son créneau horaire complet et sa glace
  const scheduledMatchList = filteredMatches
    .map((m) => {
      const slot = slots.find((s) => s.id === m.slotId);
      const surface = surfaces.find((s) => s.id === m.surfaceId);
      return {
        match: m,
        slot,
        surface,
        absTime: slot ? slot.startTime : "00:00",
      };
    })
    // Trier chronologiquement par heure de début
    .sort((a, b) => a.absTime.localeCompare(b.absTime));

  // Regrouper les matchs par glace/surface pour l'affichage en colonnes ou timelines
  const matchesBySurface: Record<string, typeof scheduledMatchList> = {};
  scheduledMatchList.forEach((item) => {
    if (item.surface) {
      const sKey = item.surface.id;
      matchesBySurface[sKey] = matchesBySurface[sKey] || [];
      matchesBySurface[sKey].push(item);
    }
  });

  // Glaces uniques présentes dans la sélection filtrée
  const activeSurfaces = surfaces.filter((s) => {
    if (selectedSurfaceId !== "all" && s.id !== selectedSurfaceId) return false;
    // N'afficher la glace que s'il y a des créneaux ou des matchs sur cette glace
    return slots.some((slot) => slot.surfaceId === s.id && slot.date === selectedDate);
  });

  return (
    <div className="space-y-6">
      {/* 1. Sélecteur de jour horizontal (Tabs-like) */}
      {uniqueDates.length > 1 && (
        <div className="flex flex-wrap gap-2 pb-2 border-b border-zinc-900">
          {uniqueDates.map((dateStr) => (
            <button
              key={dateStr}
              onClick={() => setSelectedDate(dateStr)}
              className={cn(
                "px-5 py-2.5 rounded-xl font-bold text-sm border transition-all cursor-pointer",
                selectedDate === dateStr
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-850"
              )}
            >
              <span className="capitalize">{formatDateFrench(dateStr)}</span>
            </button>
          ))}
        </div>
      )}

      {/* 2. Barre de filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 backdrop-blur-md">
        {/* Catégorie */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5 text-blue-400" />
            Catégorie
          </Label>
          <Select value={selectedCategoryId} onValueChange={(val) => setSelectedCategoryId(val || "all")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Patinoire / Glace */}
        <div className="space-y-1.5">
          <Label className="text-zinc-500 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-cyan-400" />
            Aréna & Glace
          </Label>
          <Select value={selectedSurfaceId} onValueChange={(val) => setSelectedSurfaceId(val || "all")}>
            <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
              <SelectItem value="all">Toutes les glaces</SelectItem>
              {surfaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.arenaName} — {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Actions rapides */}
        <div className="flex items-end justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setSelectedCategoryId("all");
              setSelectedSurfaceId("all");
              if (uniqueDates[0]) setSelectedDate(uniqueDates[0]);
            }}
            className="border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-850 h-10 w-full sm:w-auto font-semibold cursor-pointer"
          >
            Réinitialiser les filtres
          </Button>
        </div>
      </div>

      {/* 3. Affichage du planning */}
      <div className="space-y-8">
        {activeSurfaces.map((surf) => {
          const surfMatches = matchesBySurface[surf.id] || [];

          return (
            <div key={surf.id} className="space-y-4">
              {/* En-tête de la surface */}
              <div className="flex items-center gap-2 border-l-4 border-blue-500 pl-3 py-1">
                <div>
                  <h3 className="font-extrabold text-white text-lg tracking-tight">
                    {surf.arenaName} — {surf.name}
                  </h3>
                  <p className="text-zinc-500 text-xs uppercase font-bold tracking-wider">
                    {surfMatches.length} match{surfMatches.length > 1 ? "s" : ""} programmé{surfMatches.length > 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              {surfMatches.length === 0 ? (
                <div className="p-6 rounded-2xl bg-zinc-950/40 border border-zinc-900 text-zinc-500 text-center text-sm">
                  Aucun match programmé pour les critères sélectionnés sur cette glace.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {surfMatches.map(({ match: m, slot }) => {
                    const hName = getTeamName(m.homeTeamId);
                    const aName = getTeamName(m.awayTeamId);
                    const timeRange = slot ? formatTimeRange(slot.startTime, slot.durationMinutes) : "";

                    return (
                      <Card
                        key={m.id}
                        className={cn(
                          "bg-zinc-950/60 border border-zinc-850 hover:border-zinc-800 transition-all backdrop-blur-sm shadow-md flex flex-col justify-between overflow-hidden",
                          m.status === "final" && "border-zinc-900 bg-zinc-950/20"
                        )}
                      >
                        {/* Barre supérieure */}
                        <div className="p-3 bg-zinc-900/50 border-b border-zinc-900/80 flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400 bg-cyan-950/30 px-2 py-0.5 rounded-full border border-cyan-900/30">
                            {getCategoryLabel(m.categoryId)}
                          </span>
                          <span className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                            <Clock className="h-3 w-3 text-zinc-500" />
                            {timeRange}
                          </span>
                        </div>

                        {/* Corps du Match */}
                        <CardContent className="p-4 space-y-4 flex-1 flex flex-col justify-center">
                          <div className="space-y-3">
                            {/* Receveur (Home) */}
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                                {hName}
                              </span>
                              {m.status === "final" ? (
                                <span className={cn(
                                  "text-sm font-extrabold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-white",
                                  m.homeScore !== null && m.awayScore !== null && m.homeScore > m.awayScore && "text-green-400 bg-green-950/20 border-green-900/30"
                                )}>
                                  {m.homeScore}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs font-bold uppercase">Rec</span>
                              )}
                            </div>

                            {/* Séparateur */}
                            <div className="border-t border-zinc-900/80 my-1 relative">
                              <span className="absolute left-1/2 -top-2 px-1.5 bg-zinc-950 text-[9px] font-bold text-zinc-600 transform -translate-x-1/2 select-none uppercase tracking-wider">VS</span>
                            </div>

                            {/* Visiteur (Away) */}
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-semibold text-white truncate max-w-[200px]">
                                {aName}
                              </span>
                              {m.status === "final" ? (
                                <span className={cn(
                                  "text-sm font-extrabold px-2 py-0.5 rounded bg-zinc-900 border border-zinc-850 text-white",
                                  m.homeScore !== null && m.awayScore !== null && m.awayScore > m.homeScore && "text-green-400 bg-green-950/20 border-green-900/30"
                                )}>
                                  {m.awayScore}
                                </span>
                              ) : (
                                <span className="text-zinc-600 text-xs font-bold uppercase">Vis</span>
                              )}
                            </div>
                          </div>
                        </CardContent>

                        {/* Pied du Match */}
                        <div className="px-4 py-2 border-t border-zinc-900 bg-zinc-900/10 flex items-center justify-between text-[10px] font-semibold text-zinc-500">
                          <span className="capitalize">{m.phase === "preliminary" ? "Ronde préliminaire" : "Éliminatoire"}</span>
                          <span className={cn(
                            "uppercase text-[9px] font-bold px-1.5 py-0.5 rounded",
                            m.status === "scheduled" && "text-zinc-400 bg-zinc-900 border border-zinc-800",
                            m.status === "final" && "text-green-400 bg-green-950/20 border-green-900/30",
                            m.status === "in_progress" && "text-yellow-400 bg-yellow-950/20 border-yellow-900/30 animate-pulse"
                          )}>
                            {m.status === "scheduled" ? "Prévu" : m.status === "in_progress" ? "En cours" : "Terminé"}
                          </span>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
