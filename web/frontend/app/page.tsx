import { AuthPanel } from "@/components/AuthPanel";

export default function Home() {
  return (
    <main className="min-h-screen w-full bg-paper flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="text-center max-w-xl mb-8">
        <p className="text-xs font-bold text-brand-700 uppercase tracking-widest mb-3">
          Paramparā
        </p>
        <h1 className="font-display text-4xl sm:text-5xl font-semibold text-ink-900 tracking-tight leading-tight">
          The agricultural traceability platform
        </h1>
        <p className="text-ink-500 text-sm sm:text-base mt-3 font-medium max-w-md mx-auto">
          Connecting Sri Lankan farmers and exporters with verified quality
          standards and full crop provenance.
        </p>
      </div>

      <AuthPanel />

      <footer className="mt-12 text-center text-xs text-ink-400 font-medium">
        © {new Date().getFullYear()} Paramparā Agri Tech
      </footer>
    </main>
  );
}
