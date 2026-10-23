import Link from "next/link";
import { Logo } from "@/components/shell/Logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative hidden overflow-hidden bg-leaf-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/"><Logo light /></Link>
        <div className="relative z-10 max-w-md">
          <p className="font-display text-4xl leading-tight font-semibold">Evidence you can taste the difference in.</p>
          <p className="mt-4 text-leaf-100">From the first corner of a walked plot to the QR on the finished pack.</p>
        </div>
        <svg className="absolute -right-20 -bottom-20 h-96 w-96 text-leaf-700/40" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true">
          <path d="M10 90C10 40 40 8 92 8c0 52-28 80-70 80Z" />
        </svg>
        <p className="relative z-10 text-xs text-leaf-200">Sri Lankan tea &amp; cinnamon traceability</p>
      </aside>
      <main className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-lg">
          <Link href="/" className="mb-8 block lg:hidden"><Logo /></Link>
          {children}
        </div>
      </main>
    </div>
  );
}
