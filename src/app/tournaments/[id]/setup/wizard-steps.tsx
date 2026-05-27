"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  updateTournamentAction,
  saveArenasAndSurfacesAction,
  saveTimeSlotsAction,
  saveCategoriesAction,
  saveTeamsAction,
  saveFormatAction,
  saveRulesAndTiebreakersAction,
  generatePreliminaryMatchupsAction,
  runPreliminarySolverAction,
  ArenaInput,
  TimeSlotInput,
  CategoryInput,
  TeamInput,
  SaveFormatInput,
  SaveConstraintInput,
} from "../../actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Trophy,
  Calendar,
  Shield,
  Sliders,
  Clock,
  Settings,
  Plus,
  Trash2,
  Users,
  Grid,
  Check,
  ChevronLeft,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  Upload,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- INTERFACES ---

export interface MatchInput {
  id: string;
  categoryId: string;
  poolId?: string;
  homeTeamId?: string;
  awayTeamId?: string;
  surfaceId?: string;
  slotId?: string;
  phase: "preliminary" | "playoff";
}

interface WizardStepsProps {
  tournament: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
    timezone: string;
    status: "planning" | "active" | "completed";
    restCalculationMode: "start_to_start" | "end_to_start";
  };
  initialArenas: ArenaInput[];
  initialTimeSlots: TimeSlotInput[];
  initialCategories: CategoryInput[];
  initialTeams: Record<string, TeamInput[]>; // categoryId -> teams
  initialFormats: Record<string, SaveFormatInput>; // categoryId -> format
  initialConstraints: SaveConstraintInput[];
  initialTiebreakers: string[];
  initialMatches: MatchInput[];
}

export function WizardSteps({
  tournament,
  initialArenas,
  initialTimeSlots,
  initialCategories,
  initialTeams,
  initialFormats,
  initialConstraints,
  initialTiebreakers,
  initialMatches,
}: WizardStepsProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // --- STATE FOR EACH STEP ---

  // Étape 1 : Tournoi
  const [tournamentData, setTournamentData] = useState({
    name: tournament.name,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    restCalculationMode: tournament.restCalculationMode,
    status: tournament.status,
    timezone: tournament.timezone,
  });

  // Étape 2 : Arénas & Surfaces
  const [arenasData, setArenasData] = useState<ArenaInput[]>(initialArenas);
  const [timeSlotsData, setTimeSlotsData] = useState<TimeSlotInput[]>(initialTimeSlots);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Étape 3 : Catégories
  const [categoriesData, setCategoriesData] = useState<CategoryInput[]>(initialCategories);
  const [newCat, setNewCat] = useState({
    ageValue: "",
    ageConvention: "tier" as "year" | "tier",
    level: "",
    gender: "" as "M" | "F" | "",
  });

  // Étape 4 : Équipes
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [teamsData, setTeamsData] = useState<Record<string, TeamInput[]>>(initialTeams);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamClub, setNewTeamClub] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [showBulkArea, setShowBulkArea] = useState(false);

  // Étape 5 : Format
  const [selectedFormatCategoryId, setSelectedFormatCategoryId] = useState<string>("");
  const [formatsData, setFormatsData] = useState<Record<string, SaveFormatInput>>(initialFormats);

  // Étape 6 : Règles & Départage
  const [constraintsData, setConstraintsData] = useState<SaveConstraintInput[]>(initialConstraints);
  const [tiebreakersData, setTiebreakersData] = useState<string[]>(
    initialTiebreakers.length > 0
      ? initialTiebreakers
      : [
          "points",
          "wins",
          "goals_against",
          "goal_differential",
          "goals_for",
          "head_to_head",
          "fastest_goal",
          "fair_play",
          "random",
        ]
  );

  // Étape 7 : Planification & Génération
  const [matchesData, setMatchesData] = useState<MatchInput[]>(initialMatches);

  useEffect(() => {
    setMatchesData(initialMatches);
  }, [initialMatches]);

  const criteriaLabels: Record<string, string> = {
    points: "Plus grand nombre de points",
    wins: "Plus grand nombre de victoires",
    goals_against: "Moins de buts contre (défensif)",
    goal_differential: "Meilleur différentiel (buts pour − buts contre)",
    goals_for: "Plus grand nombre de buts pour",
    head_to_head: "Confrontation directe",
    fastest_goal: "But le plus rapide marqué",
    fair_play: "Points Franc-Jeu accumulés",
    random: "Tirage au sort (critère ultime)",
  };

  // --- HELPERS ---

  // Dates du tournoi pour le sélecteur de créneaux
  const getTournamentDays = () => {
    const start = new Date(tournamentData.startDate);
    const end = new Date(tournamentData.endDate);
    const days: string[] = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      days.push(d.toISOString().split("T")[0]);
    }
    return days;
  };

  // Définir la première patinoire et date sélectionnée par défaut à l'étape 2
  useEffect(() => {
    if (arenasData.length > 0 && arenasData[0].surfaces.length > 0 && !selectedSurfaceId) {
      setSelectedSurfaceId(arenasData[0].surfaces[0].id || "");
    }
    const days = getTournamentDays();
    if (days.length > 0 && !selectedDate) {
      setSelectedDate(days[0]);
    }
  }, [arenasData, tournamentData]);

  // Définir la première catégorie par défaut à l'étape 4 et 5
  useEffect(() => {
    if (categoriesData.length > 0) {
      if (!selectedCategoryId) setSelectedCategoryId(categoriesData[0].id || "");
      if (!selectedFormatCategoryId) setSelectedFormatCategoryId(categoriesData[0].id || "");
    }
  }, [categoriesData]);

  // Initialise le format par défaut pour une catégorie si inexistant
  const getFormatForCategory = (catId: string): SaveFormatInput => {
    if (formatsData[catId]) return formatsData[catId];
    return {
      prelimType: "round_robin",
      guaranteedMatches: 3,
      prelimGameMinutes: 60,
      prelimResurfaceMinutes: 10,
      prelimSlotMinutes: 70,
      playoffGameMinutes: 60,
      playoffResurfaceMinutes: 10,
      playoffSlotMinutes: 70,
    };
  };

  // --- ACTIONS HANDLERS ---

  const handleSaveStep = async (targetStep: number) => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    let res: { success: boolean; error?: string } = { success: true };

    try {
      if (step === 1) {
        res = await updateTournamentAction({
          id: tournament.id,
          ...tournamentData,
        });
      } else if (step === 2) {
        res = await saveArenasAndSurfacesAction(tournament.id, arenasData);
        if (res.success) {
          res = await saveTimeSlotsAction(tournament.id, timeSlotsData);
        }
      } else if (step === 3) {
        res = await saveCategoriesAction(tournament.id, categoriesData);
      } else if (step === 4) {
        // Enregistrer les équipes pour toutes les catégories éditées
        for (const catId of Object.keys(teamsData)) {
          res = await saveTeamsAction(tournament.id, catId, teamsData[catId]);
          if (!res.success) break;
        }
      } else if (step === 5) {
        for (const catId of Object.keys(formatsData)) {
          res = await saveFormatAction(tournament.id, catId, formatsData[catId]);
          if (!res.success) break;
        }
      } else if (step === 6) {
        res = await saveRulesAndTiebreakersAction(
          tournament.id,
          constraintsData,
          tiebreakersData
        );
      }

      if (res.success) {
        setSuccess("Données sauvegardées avec succès.");
        setTimeout(() => setSuccess(null), 3000);
        if (targetStep !== step) {
          setStep(targetStep);
          window.scrollTo(0, 0);
        }
      } else {
        setError(res.error || "Une erreur est survenue lors de la sauvegarde.");
      }
    } catch (e: any) {
      setError(e.message || "Erreur de connexion serveur.");
    } finally {
      setLoading(false);
    }
  };

  // --- INTERFACE STEP RENDERERS ---

  return (
    <div className="space-y-8">
      {/* Step Indicators */}
      <div className="bg-zinc-900/50 border border-zinc-800/80 rounded-2xl p-4 backdrop-blur-md">
        <div className="flex justify-between items-center max-w-4xl mx-auto">
          {[
            { n: 1, label: "Tournoi", icon: Trophy },
            { n: 2, label: "Glaces & Plages", icon: Calendar },
            { n: 3, label: "Catégories", icon: Settings },
            { n: 4, label: "Équipes", icon: Users },
            { n: 5, label: "Formats", icon: Grid },
            { n: 6, label: "Règles", icon: Sliders },
            { n: 7, label: "Planification", icon: Sparkles },
          ].map((s) => {
            const Icon = s.icon;
            const active = step === s.n;
            const completed = step > s.n;

            return (
              <button
                key={s.n}
                onClick={() => handleSaveStep(s.n)}
                disabled={loading}
                className="flex flex-col items-center gap-2 group cursor-pointer focus:outline-none"
              >
                <div
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center border transition-all duration-300",
                    active && "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-105",
                    completed && "bg-zinc-800 border-zinc-700 text-zinc-300",
                    !active && !completed && "bg-zinc-950 border-zinc-900 text-zinc-600 group-hover:border-zinc-800 group-hover:text-zinc-400"
                  )}
                >
                  {completed ? <Check className="h-5 w-5 text-cyan-400" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={cn(
                    "text-xs font-semibold hidden sm:inline transition-colors duration-300",
                    active && "text-white",
                    !active && "text-zinc-500 group-hover:text-zinc-300"
                  )}
                >
                  {s.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-900/60 text-red-200 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-4 rounded-xl bg-green-950/40 border border-green-900/60 text-green-200 text-sm">
          {success}
        </div>
      )}

      {/* Form Content */}
      <div className="min-h-[400px]">
        {/* STEP 1: TOURNOI */}
        {step === 1 && (
          <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Trophy className="h-5 w-5 text-blue-400" />
                Informations fondamentales
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Configurez l'identité et les dates du tournoi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="t-name">Nom du tournoi</Label>
                <Input
                  id="t-name"
                  value={tournamentData.name}
                  onChange={(e) => setTournamentData({ ...tournamentData, name: e.target.value })}
                  className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500 text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="t-start">Date de début</Label>
                  <Input
                    id="t-start"
                    type="date"
                    value={tournamentData.startDate}
                    onChange={(e) => setTournamentData({ ...tournamentData, startDate: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-end">Date de fin</Label>
                  <Input
                    id="t-end"
                    type="date"
                    value={tournamentData.endDate}
                    onChange={(e) => setTournamentData({ ...tournamentData, endDate: e.target.value })}
                    className="bg-zinc-950 border-zinc-800 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="t-timezone">Fuseau horaire</Label>
                  <Select
                    value={tournamentData.timezone}
                    onValueChange={(val) => setTournamentData({ ...tournamentData, timezone: val || "" })}
                  >
                    <SelectTrigger id="t-timezone" className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="America/Montreal">America/Montreal (Est)</SelectItem>
                      <SelectItem value="America/Vancouver">America/Vancouver (Pacifique)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="t-status">Statut</Label>
                  <Select
                    value={tournamentData.status}
                    onValueChange={(val) => {
                      if (val === "planning" || val === "active" || val === "completed") {
                        setTournamentData({ ...tournamentData, status: val });
                      }
                    }}
                  >
                    <SelectTrigger id="t-status" className="bg-zinc-950 border-zinc-800 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                      <SelectItem value="planning">Planification</SelectItem>
                      <SelectItem value="active">En cours (Actif)</SelectItem>
                      <SelectItem value="completed">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: ARENAS & GLACES */}
        {step === 2 && (
          <div className="space-y-6">
            {/* Arénas et patinoires */}
            <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-blue-400" />
                    Arénas & Glaces
                  </CardTitle>
                  <CardDescription className="text-zinc-400">
                    Déclarez les lieux physiques du tournoi.
                  </CardDescription>
                </div>
                <Button
                  onClick={() =>
                    setArenasData([...arenasData, { name: "Nouvel aréna", surfaces: [{ name: "Glace 1" }] }])
                  }
                  className="bg-blue-600 hover:bg-blue-500 cursor-pointer"
                  size="sm"
                >
                  <Plus className="h-4 w-4 mr-1" /> Ajouter un aréna
                </Button>
              </CardHeader>
              <CardContent className="space-y-6">
                {arenasData.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6">Aucun aréna configuré pour l'instant.</p>
                ) : (
                  <div className="space-y-6">
                    {arenasData.map((arena, aIdx) => (
                      <div
                        key={aIdx}
                        className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-4"
                      >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                            <div className="space-y-1">
                              <Label className="text-zinc-400 text-xs">Nom de l'aréna</Label>
                              <Input
                                value={arena.name}
                                onChange={(e) => {
                                  const updated = [...arenasData];
                                  updated[aIdx].name = e.target.value;
                                  setArenasData(updated);
                                }}
                                className="bg-zinc-900 border-zinc-800 text-white"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-zinc-400 text-xs">Adresse</Label>
                              <Input
                                value={arena.address || ""}
                                placeholder="ex: 123 rue de la Patinoire"
                                onChange={(e) => {
                                  const updated = [...arenasData];
                                  updated[aIdx].address = e.target.value;
                                  setArenasData(updated);
                                }}
                                className="bg-zinc-900 border-zinc-800 text-white"
                              />
                            </div>
                          </div>
                          <Button
                            variant="destructive"
                            onClick={() => {
                              const updated = arenasData.filter((_, idx) => idx !== aIdx);
                              setArenasData(updated);
                            }}
                            className="bg-red-950/50 text-red-200 border border-red-900 hover:bg-red-900 hover:text-white cursor-pointer mt-5 sm:mt-0"
                            size="icon-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>

                        {/* Surfaces */}
                        <div className="border-t border-zinc-900 pt-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-semibold text-zinc-300">Surfaces / Rinks</span>
                            <Button
                              onClick={() => {
                                const updated = [...arenasData];
                                updated[aIdx].surfaces.push({ name: `Glace ${arena.surfaces.length + 1}` });
                                setArenasData(updated);
                              }}
                              variant="ghost"
                              className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/10 cursor-pointer"
                              size="sm"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Ajouter une glace
                            </Button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {arena.surfaces.map((surface, sIdx) => (
                              <div
                                key={sIdx}
                                className="flex items-center gap-2 bg-zinc-900 p-2 rounded-lg border border-zinc-850"
                              >
                                <Input
                                  value={surface.name}
                                  onChange={(e) => {
                                    const updated = [...arenasData];
                                    updated[aIdx].surfaces[sIdx].name = e.target.value;
                                    setArenasData(updated);
                                  }}
                                  className="bg-zinc-950 border-zinc-800 h-8 text-sm text-white flex-1"
                                />
                                <Button
                                  variant="ghost"
                                  onClick={() => {
                                    const updated = [...arenasData];
                                    updated[aIdx].surfaces = updated[aIdx].surfaces.filter((_, idx) => idx !== sIdx);
                                    setArenasData(updated);
                                  }}
                                  className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer"
                                  size="icon-xs"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Plages d'ouverture */}
            <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-cyan-400" />
                  Plages horaires
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Déterminez les créneaux disponibles pour chaque glace.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Choisir une glace</Label>
                    <Select value={selectedSurfaceId} onValueChange={(val) => setSelectedSurfaceId(val || "")}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Sélectionner une glace" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {arenasData.map((arena) =>
                          arena.surfaces.map((s) => {
                            // En v1, pour les nouvelles surfaces sans id, on peut utiliser leur nom combiné comme clé
                            const key = s.id || `${arena.name}-${s.name}`;
                            return (
                              <SelectItem key={key} value={key}>
                                {arena.name} — {s.name}
                              </SelectItem>
                            );
                          })
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Choisir un jour de match</Label>
                    <Select value={selectedDate} onValueChange={(val) => setSelectedDate(val || "")}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Sélectionner un jour" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {getTournamentDays().map((day) => (
                          <SelectItem key={day} value={day}>
                            {new Date(day).toLocaleDateString("fr-CA", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              timeZone: "UTC",
                            })}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedSurfaceId && selectedDate && (
                  <div className="space-y-4 border-t border-zinc-800/80 pt-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-zinc-300">
                        Créneaux configurés pour ce jour
                      </h4>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => {
                            // Générer une journée standard automatique (ex 8h à 21h, toutes les 70 minutes)
                            const generated: TimeSlotInput[] = [];
                            let hour = 8;
                            let minute = 0;
                            for (let i = 0; i < 12; i++) {
                              const timeStr = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
                              generated.push({
                                surfaceId: selectedSurfaceId,
                                date: selectedDate,
                                startTime: timeStr,
                                durationMinutes: 70,
                                status: "open",
                              });
                              minute += 70;
                              hour += Math.floor(minute / 60);
                              minute = minute % 60;
                              if (hour >= 23) break;
                            }
                            // Filtrer les créneaux existants pour d'autres surfaces/dates et rajouter
                            const filtered = timeSlotsData.filter(
                              (s) => s.surfaceId !== selectedSurfaceId || s.date !== selectedDate
                            );
                            setTimeSlotsData([...filtered, ...generated]);
                          }}
                          variant="outline"
                          className="border-blue-900/60 bg-blue-950/20 text-blue-400 hover:bg-blue-950 hover:text-white cursor-pointer"
                          size="sm"
                        >
                          <Sparkles className="h-4 w-4 mr-1" /> Remplir automatique (8h-22h)
                        </Button>
                        <Button
                          onClick={() => {
                            setTimeSlotsData([
                              ...timeSlotsData,
                              {
                                surfaceId: selectedSurfaceId,
                                date: selectedDate,
                                startTime: "08:00",
                                durationMinutes: 70,
                                status: "open",
                              },
                            ]);
                          }}
                          className="bg-blue-600 hover:bg-blue-500 cursor-pointer"
                          size="sm"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Ajouter un créneau
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {timeSlotsData.filter(
                        (s) => s.surfaceId === selectedSurfaceId && s.date === selectedDate
                      ).length === 0 ? (
                        <p className="text-zinc-500 text-sm text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                          Aucun créneau configuré pour cette journée. Utilisez le remplissage automatique ou ajoutez des créneaux manuellement.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {timeSlotsData
                            .filter((s) => s.surfaceId === selectedSurfaceId && s.date === selectedDate)
                            // Trier par heure de début
                            .sort((a, b) => a.startTime.localeCompare(b.startTime))
                            .map((slot, sIdx) => {
                              // Trouver l'index global pour la mise à jour
                              const globalIdx = timeSlotsData.findIndex((x) => x === slot);
                              return (
                                <div
                                  key={sIdx}
                                  className="flex flex-col sm:flex-row items-center gap-3 bg-zinc-950/40 border border-zinc-850 p-3 rounded-lg"
                                >
                                  <div className="grid grid-cols-3 gap-2 flex-1 w-full">
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-zinc-500 font-bold uppercase">Début</Label>
                                      <Input
                                        type="time"
                                        value={slot.startTime}
                                        onChange={(e) => {
                                          const updated = [...timeSlotsData];
                                          updated[globalIdx].startTime = e.target.value;
                                          setTimeSlotsData(updated);
                                        }}
                                        className="bg-zinc-900 border-zinc-800 h-8 text-sm text-white"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-zinc-500 font-bold uppercase">Durée (min)</Label>
                                      <Input
                                        type="number"
                                        value={slot.durationMinutes}
                                        onChange={(e) => {
                                          const updated = [...timeSlotsData];
                                          updated[globalIdx].durationMinutes = parseInt(e.target.value) || 0;
                                          setTimeSlotsData(updated);
                                        }}
                                        className="bg-zinc-900 border-zinc-800 h-8 text-sm text-white"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label className="text-[10px] text-zinc-500 font-bold uppercase">Statut</Label>
                                      <Select
                                        value={slot.status}
                                        onValueChange={(val) => {
                                          if (val === "open" || val === "blocked") {
                                            const updated = [...timeSlotsData];
                                            updated[globalIdx].status = val;
                                            setTimeSlotsData(updated);
                                          }
                                        }}
                                      >
                                        <SelectTrigger className="bg-zinc-900 border-zinc-800 h-8 text-xs text-white">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                          <SelectItem value="open">Ouvert</SelectItem>
                                          <SelectItem value="blocked">Bloqué</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-4">
                                    <Input
                                      placeholder="Note (ex: Zamboni, location...)"
                                      value={slot.note || ""}
                                      onChange={(e) => {
                                        const updated = [...timeSlotsData];
                                        updated[globalIdx].note = e.target.value;
                                        setTimeSlotsData(updated);
                                      }}
                                      className="bg-zinc-900 border-zinc-800 h-8 text-xs text-white flex-1 sm:w-44"
                                    />
                                    <Button
                                      variant="ghost"
                                      onClick={() => {
                                        const updated = timeSlotsData.filter((_, idx) => idx !== globalIdx);
                                        setTimeSlotsData(updated);
                                      }}
                                      className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer"
                                      size="icon-xs"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 3: CATEGORIES */}
        {step === 3 && (
          <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Settings className="h-5 w-5 text-blue-400" />
                Catégories de jeu
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Configurez les catégories en composant avec les 3 axes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Formulaire d'ajout */}
              <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-800/80 space-y-4">
                <h4 className="text-sm font-semibold text-white">Ajouter une catégorie</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">1. Âge (obligatoire)</Label>
                    <Input
                      placeholder="ex: M13 ou 2012"
                      value={newCat.ageValue}
                      onChange={(e) => setNewCat({ ...newCat, ageValue: e.target.value })}
                      className="bg-zinc-900 border-zinc-800 h-9 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">Convention d'âge</Label>
                    <Select
                      value={newCat.ageConvention}
                      onValueChange={(val) => {
                        if (val === "year" || val === "tier") {
                          setNewCat({ ...newCat, ageConvention: val });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-xs text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="tier">Palier (M7-M18)</SelectItem>
                        <SelectItem value="year">Année de naissance</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">2. Niveau</Label>
                    <Input
                      placeholder="ex: AA, BB, A, D1 (saisie libre)"
                      value={newCat.level}
                      onChange={(e) => setNewCat({ ...newCat, level: e.target.value })}
                      className="bg-zinc-900 border-zinc-800 h-9 text-sm text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-zinc-400">3. Sexe</Label>
                    <Select
                      value={newCat.gender}
                      onValueChange={(val) => {
                        if (val === "M" || val === "F" || val === "") {
                          setNewCat({ ...newCat, gender: val });
                        }
                      }}
                    >
                      <SelectTrigger className="bg-zinc-900 border-zinc-800 h-9 text-xs text-white">
                        <SelectValue placeholder="Non spécifié" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        <SelectItem value="M">Masculin</SelectItem>
                        <SelectItem value="F">Féminin</SelectItem>
                        <SelectItem value="">Non spécifié / Mixte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button
                    onClick={() => {
                      if (!newCat.ageValue) return;
                      // Construire l'étiquette
                      const displayLabel = `${newCat.ageValue}${newCat.level ? " " + newCat.level : ""}${
                        newCat.gender ? " (" + (newCat.gender === "M" ? "Masculin" : "Féminin") + ")" : ""
                      }`;
                      setCategoriesData([
                        ...categoriesData,
                        {
                          ageValue: newCat.ageValue,
                          ageConvention: newCat.ageConvention,
                          level: newCat.level || undefined,
                          gender: newCat.gender || null,
                          displayLabel,
                        },
                      ]);
                      setNewCat({ ageValue: "", ageConvention: "tier", level: "", gender: "" });
                    }}
                    disabled={!newCat.ageValue}
                    className="bg-blue-600 hover:bg-blue-500 cursor-pointer"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Ajouter
                  </Button>
                </div>
              </div>

              {/* Liste des catégories */}
              <div className="space-y-2">
                <span className="text-sm font-semibold text-zinc-300">Catégories ajoutées</span>
                {categoriesData.length === 0 ? (
                  <p className="text-zinc-500 text-sm text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                    Aucune catégorie déclarée pour le moment.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {categoriesData.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/40 border border-zinc-850"
                      >
                        <div className="space-y-0.5">
                          <span className="font-bold text-sm text-white">{cat.displayLabel}</span>
                          <div className="flex gap-2 text-[10px] text-zinc-500">
                            <span>{cat.ageConvention === "year" ? "Année" : "Palier"}</span>
                            {cat.gender && <span>• {cat.gender === "M" ? "M" : "F"}</span>}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          onClick={() => {
                            const updated = categoriesData.filter((_, i) => i !== idx);
                            setCategoriesData(updated);
                          }}
                          className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer"
                          size="icon-xs"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: EQUIPES */}
        {step === 4 && (
          <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-400" />
                  Équipes du tournoi
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Déclarez les équipes inscrites pour chaque catégorie de jeu.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {categoriesData.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">
                  Veuillez d'abord ajouter des catégories à l'étape 3 avant de pouvoir gérer les équipes.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Selecteur de catégorie */}
                  <div className="space-y-2 max-w-sm">
                    <Label>Sélectionner la catégorie</Label>
                    <Select value={selectedCategoryId} onValueChange={(val) => setSelectedCategoryId(val || "")}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Choisir une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {categoriesData.map((cat, idx) => {
                          const key = cat.id || `temp-cat-${idx}`;
                          return (
                            <SelectItem key={key} value={key}>
                              {cat.displayLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCategoryId && (
                    <div className="space-y-6 border-t border-zinc-800/80 pt-6">
                      {/* Formulaire ajout & Import en bloc */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-semibold text-zinc-300">
                            Ajouter des équipes à {categoriesData.find(c => c.id === selectedCategoryId)?.displayLabel}
                          </h4>
                          <Button
                            variant="ghost"
                            onClick={() => setShowBulkArea(!showBulkArea)}
                            className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-900/10 cursor-pointer"
                            size="sm"
                          >
                            <Upload className="h-4 w-4 mr-1" />
                            {showBulkArea ? "Saisie manuelle" : "Importation en lot"}
                          </Button>
                        </div>

                        {showBulkArea ? (
                          /* Zone d'importation en bloc */
                          <div className="p-4 rounded-xl bg-zinc-950/60 border border-zinc-850 space-y-3">
                            <Label className="text-xs text-zinc-400">Collez votre liste d'équipes (un nom par ligne)</Label>
                            <textarea
                              rows={5}
                              value={bulkText}
                              onChange={(e) => setBulkText(e.target.value)}
                              placeholder="ex:&#10;Dragons de Lachute&#10;Express de Saint-Jérôme&#10;Laser de Boisbriand"
                              className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                            <div className="flex justify-end">
                              <Button
                                onClick={() => {
                                  const names = bulkText
                                    .split("\n")
                                    .map((n) => n.trim())
                                    .filter((n) => n.length > 0);
                                  if (names.length === 0) return;

                                  const currentCatTeams = teamsData[selectedCategoryId] || [];
                                  const newTeams: TeamInput[] = names.map((name) => ({ name }));
                                  setTeamsData({
                                    ...teamsData,
                                    [selectedCategoryId]: [...currentCatTeams, ...newTeams],
                                  });
                                  setBulkText("");
                                  setShowBulkArea(false);
                                }}
                                className="bg-blue-600 hover:bg-blue-500 cursor-pointer"
                                size="sm"
                              >
                                Importer les équipes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          /* Formulaire manuel */
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-zinc-950/40 p-3 rounded-lg border border-zinc-850">
                            <div className="space-y-1 sm:col-span-2">
                              <Label className="text-xs text-zinc-400">Nom de l'équipe</Label>
                              <Input
                                placeholder="ex: Concordes de Mirabel"
                                value={newTeamName}
                                onChange={(e) => setNewTeamName(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 h-9 text-sm text-white"
                              />
                            </div>
                            <Button
                              onClick={() => {
                                if (!newTeamName) return;
                                const currentCatTeams = teamsData[selectedCategoryId] || [];
                                setTeamsData({
                                  ...teamsData,
                                  [selectedCategoryId]: [
                                    ...currentCatTeams,
                                    { name: newTeamName, club: newTeamClub || undefined },
                                  ],
                                });
                                setNewTeamName("");
                                setNewTeamClub("");
                              }}
                              disabled={!newTeamName}
                              className="bg-blue-600 hover:bg-blue-500 cursor-pointer w-full"
                            >
                              <Plus className="h-4 w-4 mr-1" /> Ajouter l'équipe
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Liste des équipes de la catégorie */}
                      <div className="space-y-2">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                          Équipes inscrites ({ (teamsData[selectedCategoryId] || []).length })
                        </span>
                        {(!teamsData[selectedCategoryId] || teamsData[selectedCategoryId].length === 0) ? (
                          <p className="text-zinc-500 text-sm text-center py-6 border border-dashed border-zinc-800 rounded-xl">
                            Aucune équipe inscrite dans cette catégorie.
                          </p>
                        ) : (
                          <div className="max-w-2xl bg-zinc-950/30 border border-zinc-850/80 rounded-xl overflow-hidden">
                            <table className="w-full text-sm text-left">
                              <thead className="bg-zinc-900/60 text-zinc-400 text-xs border-b border-zinc-850">
                                <tr>
                                  <th className="px-4 py-2">Index</th>
                                  <th className="px-4 py-2">Nom de l'équipe</th>
                                  <th className="px-4 py-2 text-right">Action</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-zinc-900">
                                {teamsData[selectedCategoryId].map((team, idx) => (
                                  <tr key={idx} className="hover:bg-zinc-900/40">
                                    <td className="px-4 py-3 text-zinc-500 font-medium">{idx + 1}</td>
                                    <td className="px-4 py-3 text-white font-semibold">{team.name}</td>
                                    <td className="px-4 py-3 text-right">
                                      <Button
                                        variant="ghost"
                                        onClick={() => {
                                          const updated = teamsData[selectedCategoryId].filter(
                                            (_, i) => i !== idx
                                          );
                                          setTeamsData({ ...teamsData, [selectedCategoryId]: updated });
                                        }}
                                        className="text-red-400 hover:text-red-300 hover:bg-red-950/20 cursor-pointer"
                                        size="icon-xs"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: FORMATS */}
        {step === 5 && (
          <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                <Grid className="h-5 w-5 text-blue-400" />
                Formats de jeu & Durées
              </CardTitle>
              <CardDescription className="text-zinc-400">
                Déterminez la structure des rondes et la durée des matchs par catégorie.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {categoriesData.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">
                  Veuillez ajouter des catégories à l'étape 3 avant de configurer leurs formats.
                </p>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2 max-w-sm">
                    <Label>Sélectionner la catégorie</Label>
                    <Select value={selectedFormatCategoryId} onValueChange={(val) => setSelectedFormatCategoryId(val || "")}>
                      <SelectTrigger className="bg-zinc-950 border-zinc-800 text-white">
                        <SelectValue placeholder="Choisir une catégorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                        {categoriesData.map((cat, idx) => {
                          const key = cat.id || `temp-cat-${idx}`;
                          return (
                            <SelectItem key={key} value={key}>
                              {cat.displayLabel}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedFormatCategoryId && (
                    <div className="space-y-6 border-t border-zinc-800/80 pt-6">
                      {(() => {
                        const fmt = getFormatForCategory(selectedFormatCategoryId);
                        const updateFormat = (field: keyof SaveFormatInput, value: any) => {
                          const updatedFmt = { ...fmt, [field]: value };
                          // Auto-calculer les durées de créneau (slot_minutes = game_minutes + resurface_minutes)
                          if (field === "prelimGameMinutes" || field === "prelimResurfaceMinutes") {
                            updatedFmt.prelimSlotMinutes = updatedFmt.prelimGameMinutes + updatedFmt.prelimResurfaceMinutes;
                          }
                          if (field === "playoffGameMinutes" || field === "playoffResurfaceMinutes") {
                            updatedFmt.playoffSlotMinutes = updatedFmt.playoffGameMinutes + updatedFmt.playoffResurfaceMinutes;
                          }
                          setFormatsData({ ...formatsData, [selectedFormatCategoryId]: updatedFmt });
                        };

                        return (
                          <div className="space-y-6">
                            {/* Format des rondes */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
                              <div className="space-y-2">
                                <Label>Format préliminaire</Label>
                                <Select
                                  value={fmt.prelimType}
                                  onValueChange={(val) => {
                                    if (val === "round_robin" || val === "pools") {
                                      updateFormat("prelimType", val);
                                    }
                                  }}
                                >
                                  <SelectTrigger className="bg-zinc-900 border-zinc-800 text-white">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                                    <SelectItem value="round_robin">Round-robin simple (Tous contre tous)</SelectItem>
                                    <SelectItem value="pools">Poules (Division en blocs de poules)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Matchs garantis par équipe</Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={10}
                                  value={fmt.guaranteedMatches}
                                  onChange={(e) => updateFormat("guaranteedMatches", parseInt(e.target.value) || 3)}
                                  className="bg-zinc-900 border-zinc-800 text-white"
                                />
                              </div>
                            </div>

                            {/* Durées préliminaires */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-zinc-300">Durée des matchs — Ronde préliminaire</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/20 p-4 rounded-xl border border-zinc-850/60">
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">1. Temps de jeu réel (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.prelimGameMinutes}
                                    onChange={(e) => updateFormat("prelimGameMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">2. Buffer Zamboni / Resurfaçage (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.prelimResurfaceMinutes}
                                    onChange={(e) => updateFormat("prelimResurfaceMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">3. Durée totale de créneau (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.prelimSlotMinutes}
                                    onChange={(e) => updateFormat("prelimSlotMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                              </div>
                            </div>

                            {/* Durées éliminatoires */}
                            <div className="space-y-3">
                              <h4 className="text-sm font-semibold text-zinc-300">Durée des matchs — Ronde éliminatoire</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-zinc-950/20 p-4 rounded-xl border border-zinc-850/60">
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">1. Temps de jeu réel (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.playoffGameMinutes}
                                    onChange={(e) => updateFormat("playoffGameMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">2. Buffer Zamboni / Resurfaçage (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.playoffResurfaceMinutes}
                                    onChange={(e) => updateFormat("playoffResurfaceMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-zinc-400">3. Durée totale de créneau (min)</Label>
                                  <Input
                                    type="number"
                                    value={fmt.playoffSlotMinutes}
                                    onChange={(e) => updateFormat("playoffSlotMinutes", parseInt(e.target.value) || 0)}
                                    className="bg-zinc-900 border-zinc-800 text-white"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* STEP 6: REGLES & DEPARTAGE */}
        {step === 6 && (
          <div className="space-y-6">
            {/* Contraintes de règles */}
            <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Sliders className="h-5 w-5 text-blue-400" />
                  Règles & Contraintes
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Activez et configurez les contraintes pour le solveur d'optimisation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Repos minimal */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-850">
                  <div className="space-y-1">
                    <span className="font-bold text-white text-sm">Repos minimal obligatoire</span>
                    <p className="text-zinc-500 text-xs">
                      Contrainte stricte interdisant de programmer un match si l'équipe n'a pas eu son temps de repos minimal.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      className="w-20 bg-zinc-900 border-zinc-800 text-center text-white h-8"
                      value={(() => {
                        const rule = constraintsData.find((r) => r.type === "min_rest");
                        return rule?.params?.min_minutes || 180;
                      })()}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 180;
                        const filtered = constraintsData.filter((r) => r.type !== "min_rest");
                        setConstraintsData([
                          ...filtered,
                          {
                            scope: "tournament",
                            type: "min_rest",
                            isHard: true,
                            params: { min_minutes: val },
                          },
                        ]);
                      }}
                    />
                    <span className="text-zinc-400 text-xs">minutes (3h)</span>
                  </div>
                </div>

                {/* Chevauchements et Capacité */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-1">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                      <Check className="h-4 w-4" />
                      <span>Pas de chevauchement d'équipe</span>
                    </div>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Une équipe ne peut jamais jouer deux matchs en même temps (Toujours activé).
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-950/40 border border-zinc-850 space-y-1">
                    <div className="flex items-center gap-2 text-green-400 font-bold text-sm">
                      <Check className="h-4 w-4" />
                      <span>Capacité maximale des glaces</span>
                    </div>
                    <p className="text-zinc-500 text-xs leading-relaxed">
                      Une patinoire ne peut accueillir qu'un seul match par créneau (Toujours activé).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Départage */}
            <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-cyan-400" />
                  Critères de départage
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Déterminez l'ordre de priorité des critères de départage (glisser-déposer / réordonner).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-zinc-400 text-xs">
                  Réordonnez les critères ci-dessous. Le premier critère est le plus prioritaire pour départager des équipes à égalité.
                </p>

                <div className="space-y-2 max-w-xl">
                  {tiebreakersData.map((crit, idx) => (
                    <div
                      key={crit}
                      className="flex items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-800"
                    >
                      <div className="flex items-center gap-3">
                        <span className="h-6 w-6 rounded-md bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs text-zinc-500 font-bold">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-semibold text-white">{criteriaLabels[crit]}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          disabled={idx === 0}
                          onClick={() => {
                            const updated = [...tiebreakersData];
                            const temp = updated[idx];
                            updated[idx] = updated[idx - 1];
                            updated[idx - 1] = temp;
                            setTiebreakersData(updated);
                          }}
                          className="text-zinc-400 hover:text-white cursor-pointer"
                          size="icon-xs"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          disabled={idx === tiebreakersData.length - 1}
                          onClick={() => {
                            const updated = [...tiebreakersData];
                            const temp = updated[idx];
                            updated[idx] = updated[idx + 1];
                            updated[idx + 1] = temp;
                            setTiebreakersData(updated);
                          }}
                          className="text-zinc-400 hover:text-white cursor-pointer"
                          size="icon-xs"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* STEP 7: PLANIFICATION & GENERATION */}
        {step === 7 && (
          <div className="space-y-6">
            <Card className="bg-zinc-900/40 border-zinc-800 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
                  Génération des confrontations & Planification
                </CardTitle>
                <CardDescription className="text-zinc-400">
                  Générez les affrontements préliminaires puis lancez l'optimiseur d'horaires.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 1. Résumé de la configuration */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-zinc-950/40 border border-zinc-850">
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-xs uppercase font-bold">Arénas / Glaces</span>
                    <p className="text-xl font-extrabold text-white">
                      {arenasData.length} / {arenasData.reduce((acc, a) => acc + a.surfaces.length, 0)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-xs uppercase font-bold">Créneaux ouverts</span>
                    <p className="text-xl font-extrabold text-white">{timeSlotsData.filter(s => s.status === "open").length}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-xs uppercase font-bold">Catégories</span>
                    <p className="text-xl font-extrabold text-white">{categoriesData.length}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-xs uppercase font-bold">Équipes inscrites</span>
                    <p className="text-xl font-extrabold text-white">
                      {Object.values(teamsData).reduce((acc, list) => acc + list.length, 0)}
                    </p>
                  </div>
                </div>

                {/* 2. Actions */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center py-4 border-t border-zinc-900">
                  <Button
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        const res = await generatePreliminaryMatchupsAction(tournament.id);
                        if (res.success && res.matches) {
                          setMatchesData(res.matches);
                          setSuccess("Toutes les confrontations préliminaires ont été générées avec succès !");
                        } else {
                          setError(res.error || "Une erreur est survenue lors de la génération.");
                        }
                      } catch (e: any) {
                        setError(e.message || "Erreur de connexion.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || categoriesData.length === 0}
                    className="bg-zinc-800 text-white border border-zinc-700 hover:bg-zinc-700 font-semibold cursor-pointer py-6 px-8 h-auto"
                  >
                    Générer les confrontations ({matchesData.length} existantes)
                  </Button>

                  <Button
                    onClick={async () => {
                      setLoading(true);
                      setError(null);
                      setSuccess(null);
                      try {
                        const res = await runPreliminarySolverAction(tournament.id);
                        if (res.success) {
                          setSuccess("Planning préliminaire généré et enregistré avec succès ! Redirection...");
                          setTimeout(() => {
                            router.push(`/tournaments/${tournament.id}/schedule`);
                          }, 2000);
                        } else {
                          setError(res.error || "La planification a échoué. Vérifiez vos contraintes ou vos créneaux.");
                        }
                      } catch (e: any) {
                        setError(e.message || "Erreur lors de la planification.");
                      } finally {
                        setLoading(false);
                      }
                    }}
                    disabled={loading || matchesData.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold cursor-pointer py-6 px-8 h-auto"
                  >
                    Lancer le moteur d'optimisation
                  </Button>
                </div>

                {/* 3. Aperçu des matchs par catégorie */}
                {matchesData.length > 0 && (
                  <div className="space-y-4 pt-4 border-t border-zinc-900">
                    <h3 className="text-lg font-bold text-white">Aperçu des confrontations générées</h3>
                    <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
                      {categoriesData.map((cat) => {
                        const catMatches = matchesData.filter(m => m.categoryId === cat.id);
                        if (catMatches.length === 0) return null;

                        const poolIds = Array.from(new Set(catMatches.map(m => m.poolId).filter((id): id is string => !!id)));

                        return (
                          <div key={cat.id} className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850">
                            <h4 className="font-bold text-cyan-400 text-sm">{cat.displayLabel}</h4>
                            
                            {poolIds.length > 0 ? (
                              <div className="space-y-4">
                                {poolIds.map((pId) => {
                                  const poolMatches = catMatches.filter(m => m.poolId === pId);
                                  const teamsList = teamsData[cat.id || ""] || [];
                                  
                                  return (
                                    <div key={pId} className="space-y-2 pl-2 border-l border-zinc-800">
                                      <span className="text-xs font-bold text-zinc-400 uppercase">Poule</span>
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {poolMatches.map((m, idx) => {
                                          const hName = teamsList.find(t => t.id === m.homeTeamId)?.name || "À déterminer";
                                          const aName = teamsList.find(t => t.id === m.awayTeamId)?.name || "À déterminer";
                                          return (
                                            <div key={m.id || idx} className="text-xs bg-zinc-900 p-2 rounded border border-zinc-850 text-zinc-300 flex items-center justify-between">
                                              <span>{hName} <span className="text-zinc-500 font-normal">vs</span> {aName}</span>
                                              {m.slotId && <span className="text-[10px] text-green-400 font-bold bg-green-950/40 px-1.5 py-0.5 rounded border border-green-900/30">Planifié</span>}
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {catMatches.map((m, idx) => {
                                  const teamsList = teamsData[cat.id || ""] || [];
                                  const hName = teamsList.find(t => t.id === m.homeTeamId)?.name || "À déterminer";
                                  const aName = teamsList.find(t => t.id === m.awayTeamId)?.name || "À déterminer";
                                  return (
                                    <div key={m.id || idx} className="text-xs bg-zinc-900 p-2 rounded border border-zinc-850 text-zinc-300 flex items-center justify-between">
                                      <span>{hName} <span className="text-zinc-500 font-normal">vs</span> {aName}</span>
                                      {m.slotId && <span className="text-[10px] text-green-400 font-bold bg-green-950/40 px-1.5 py-0.5 rounded border border-green-900/30">Planifié</span>}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between border-t border-zinc-900 pt-6">
        <Button
          onClick={() => handleSaveStep(step - 1)}
          disabled={step === 1 || loading}
          variant="outline"
          className="border-zinc-800 text-zinc-300 hover:bg-zinc-850 hover:text-white cursor-pointer"
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Précédent
        </Button>

        {step < 7 ? (
          <Button
            onClick={() => handleSaveStep(step + 1)}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold cursor-pointer"
          >
            Suivant
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        ) : (
          <Button
            onClick={() => router.push(`/tournaments/${tournament.id}/schedule`)}
            disabled={loading}
            className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-semibold cursor-pointer"
          >
            Aller à l'horaire
            <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
