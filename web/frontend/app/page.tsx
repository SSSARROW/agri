import { AuthPanel } from "@/components/AuthPanel";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-gradient-to-br from-emerald-950 via-zinc-900 to-black flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Dynamic Background Glow Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-teal-600/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Hero Header */}
      <div className="text-center max-w-xl mb-8 z-10">
        <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight leading-tight">
          Paramparā <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Agri Platform</span>
        </h1>
        <p className="text-zinc-400 text-sm sm:text-base mt-2 font-medium">
          Empowering Farmers & Exporters with Secure Direct-Market Connections
        </p>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full z-10">
        <AuthPanel />
      </div>

      {/* Footer */}
      <footer className="mt-12 text-center text-xs text-zinc-500 font-medium z-10">
        © {new Date().getFullYear()} Paramparā Agri Tech. Secured with JWT & Google OAuth 2.0
      </footer>
    </main>
  );
}
