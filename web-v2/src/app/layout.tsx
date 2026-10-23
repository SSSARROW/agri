import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-poppins", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Origo — traceable Sri Lankan tea & cinnamon", template: "%s · Origo" },
  description: "Sourcing and traceability for Sri Lankan export crops, from the plot to the pack.",
};

export const viewport: Viewport = { themeColor: "#0f2a21", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={poppins.variable}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
