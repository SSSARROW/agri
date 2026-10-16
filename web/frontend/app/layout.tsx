import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

// Fraunces (display/headings) + Inter (body/UI) — a deliberate serif/sans
// pairing instead of one grotesque everywhere, so headings carry some of
// "Paramparā" (heritage/lineage) as a brand rather than reading as an
// unstyled default.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Paramparā — Agricultural Traceability",
    template: "%s · Paramparā",
  },
  description:
    "Connecting Sri Lankan farmers and exporters with verified quality standards and full crop provenance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${fraunces.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink-900">
        {children}
      </body>
    </html>
  );
}
