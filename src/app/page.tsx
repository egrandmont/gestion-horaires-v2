import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { ArrowRight, Calendar, Cpu, Trophy, Zap } from "lucide-react";

export default async function Home() {
  const { userId } = await auth();
  const isAuthenticated = !!userId;

  return (
    <div className="relative min-h-screen bg-zinc-950 text-white overflow-hidden flex flex-col justify-between">
      {/* Background Gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-cyan-900/20 blur-[120px]" />
        <div className="absolute top-[30%] right-[10%] w-[40%] h-[40%] rounded-full bg-indigo-900/10 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Trophy className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
            PuckPlan
          </span>
        </div>
        <nav className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link
              href="/tournaments"
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
            >
              Mes tournois
            </Link>
          ) : (
            <>
              <Link
                href="/tournaments"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                Connexion
              </Link>
              <Link
                href="/tournaments"
                className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white transition-all shadow-md shadow-blue-600/10"
              >
                Créer un compte
              </Link>
            </>
          )}
        </nav>
      </header>

      {/* Hero Section */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 max-w-5xl mx-auto py-12 md:py-24">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900 border border-zinc-800/80 text-zinc-300 text-xs font-medium mb-8 backdrop-blur-md animate-fade-in">
          <Zap className="h-3.5 w-3.5 text-cyan-400" />
          <span>Nouvelle version v2 — Neon + Clerk + OR-Tools</span>
        </div>

        {/* Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] bg-gradient-to-b from-white via-zinc-100 to-zinc-400 bg-clip-text text-transparent">
          Planifiez votre tournoi <br className="hidden sm:inline" />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            en quelques minutes
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Générateur d'horaires intelligent propulsé par l'optimisation sous contraintes pour vos tournois de hockey mineur. Entièrement conforme aux règles Hockey Québec.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-4 mb-20 justify-center w-full max-w-md">
          <Link
            href="/tournaments"
            className="inline-flex h-12 w-full sm:w-auto px-8 items-center justify-center rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 font-semibold text-white shadow-lg shadow-blue-500/20 transition-all gap-2 group"
          >
            {isAuthenticated ? "Accéder au tableau de bord" : "Commencer maintenant"}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
          <a
            href="#features"
            className="inline-flex h-12 w-full sm:w-auto px-8 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 font-semibold text-zinc-300 transition-colors"
          >
            Découvrir les fonctionnalités
          </a>
        </div>

        {/* Features Section */}
        <div id="features" className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full mt-12 scroll-mt-24">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm relative group hover:border-zinc-700/80 transition-all">
            <div className="h-12 w-12 rounded-xl bg-blue-900/30 flex items-center justify-center mb-5 text-blue-400 border border-blue-800/30 group-hover:scale-110 transition-transform">
              <Cpu className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Optimisation sous contraintes</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Le solveur CP-SAT d'OR-Tools place automatiquement les matchs sur vos créneaux en respectant les couvre-feux, repos et temps de Zamboni.
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm relative group hover:border-zinc-700/80 transition-all">
            <div className="h-12 w-12 rounded-xl bg-cyan-900/30 flex items-center justify-center mb-5 text-cyan-400 border border-cyan-800/30 group-hover:scale-110 transition-transform">
              <Zap className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Saisie mobile en direct</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Vos marqueurs entrent les scores en direct sur le bord de la patinoire grâce à une interface mobile-first sécurisée par jeton éphémère.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 backdrop-blur-sm relative group hover:border-zinc-700/80 transition-all">
            <div className="h-12 w-12 rounded-xl bg-indigo-900/30 flex items-center justify-center mb-5 text-indigo-400 border border-indigo-800/30 group-hover:scale-110 transition-transform">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="font-bold text-lg text-white mb-2">Brackets & Départage</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Algorithme de départage officiel Hockey Québec à 3+ équipes et résolution automatique des rondes éliminatoires à trous.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 border-t border-zinc-900 flex flex-col sm:flex-row items-center justify-between text-zinc-500 text-sm gap-4">
        <span>© {new Date().getFullYear()} PuckPlan. Tous droits réservés.</span>
        <div className="flex gap-6">
          <a href="#" className="hover:text-zinc-300 transition-colors">Politique de confidentialité</a>
          <a href="#" className="hover:text-zinc-300 transition-colors">Conditions d'utilisation</a>
        </div>
      </footer>
    </div>
  );
}
