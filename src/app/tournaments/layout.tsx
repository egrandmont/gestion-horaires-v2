import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { Trophy } from "lucide-react";

export default function TournamentsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* App Header */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/10">
                <Trophy className="h-4.5 w-4.5 text-white" />
              </div>
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white to-zinc-300 bg-clip-text text-transparent">
                PuckPlan
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-400">
              <Link
                href="/tournaments"
                className="px-3 py-1.5 rounded-lg text-white bg-zinc-900 transition-colors"
              >
                Mes tournois
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <UserButton />
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-7xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  );
}
