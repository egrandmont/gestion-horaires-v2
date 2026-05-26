"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTournamentAction } from "@/app/tournaments/actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trophy, Loader2 } from "lucide-react";

export function CreateTournamentDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    restCalculationMode: "end_to_start" as "start_to_start" | "end_to_start",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await createTournamentAction({
      name: formData.name,
      startDate: formData.startDate,
      endDate: formData.endDate,
      restCalculationMode: formData.restCalculationMode,
      timezone: "America/Montreal",
    });

    if (result.success && result.id) {
      setOpen(false);
      router.push(`/tournaments/${result.id}/setup`);
    } else {
      setError(result.error || "Une erreur inattendue est survenue.");
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-medium shadow-md shadow-blue-500/10 cursor-pointer">
            <Trophy className="mr-2 h-4 w-4" />
            Nouveau tournoi
          </Button>
        }
      />
      <DialogContent className="sm:max-w-[425px] bg-zinc-900 border-zinc-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white">Créer un tournoi</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Configurez les informations de base de votre tournoi de hockey.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-950/50 border border-red-900 text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="name" className="text-zinc-300">Nom du tournoi</Label>
            <Input
              id="name"
              required
              placeholder="ex: Tournoi Novice-Atome de Rosemère"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500 text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDate" className="text-zinc-300">Date de début</Label>
              <Input
                id="startDate"
                type="date"
                required
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate" className="text-zinc-300">Date de fin</Label>
              <Input
                id="endDate"
                type="date"
                required
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="bg-zinc-950 border-zinc-800 focus-visible:ring-blue-500 text-white"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="restMode" className="text-zinc-300">Mode de calcul du repos</Label>
            <Select
              value={formData.restCalculationMode}
              onValueChange={(val) => {
                if (val) {
                  setFormData({ ...formData, restCalculationMode: val });
                }
              }}
            >
              <SelectTrigger id="restMode" className="bg-zinc-950 border-zinc-800 text-white">
                <SelectValue placeholder="Choisir le mode" />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="end_to_start">Fin à début (Recommandé)</SelectItem>
                <SelectItem value="start_to_start">Début à début</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11px] text-zinc-500">
              Détermine comment le solveur calcule l'écart minimal requis entre deux matchs d'une équipe.
            </p>
          </div>

          <DialogFooter className="pt-4 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              className="text-zinc-400 hover:text-white hover:bg-zinc-800 cursor-pointer"
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer le tournoi"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
