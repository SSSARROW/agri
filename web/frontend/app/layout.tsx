import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// One typeface everywhere (Inter, variable weight) instead of the earlier
// serif-display/sans-body pairing — simpler and more neutral for a
// dashboard-heavy product.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Origo — Agricultural Traceability",
    template: "%s · Origo",
  },
  description:
    "Connecting Sri Lankan farmers and exporters with verified quality standards and full crop provenance.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-paper text-ink-900">
        {children}
      </body>
    </html>
  );
}
