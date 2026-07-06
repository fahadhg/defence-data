import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Defence Procurement Intelligence for Canada's Advanced Manufacturing Sector",
  description:
    "A platform built for Canada's dual-use manufacturers, giving them the intelligence they need to find and pursue defence procurement opportunities across the Government of Canada's contracting system.",
};

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/tenders", label: "Tenders" },
  { href: "/awards", label: "Awards (2022–present)" },
  { href: "/contract-history", label: "Deep History (2011–present)" },
  { href: "/expiring", label: "Expiry Radar" },
  { href: "/standing-offers", label: "Standing Offers" },
  { href: "/buyers", label: "Buyer Intelligence" },
  { href: "/investment-plan", label: "Investment Plan" },
  { href: "/industrial-benefits", label: "Industrial Benefits" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <header className="border-b border-line sticky top-0 z-20 backdrop-blur bg-background/80">
          <div className="mx-auto max-w-7xl px-5 h-14 flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2.5 shrink-0">
              <span className="grid place-items-center w-6 h-6 rounded-sm bg-accent text-accent-ink font-bold text-xs mono">CA</span>
              <span className="font-semibold tracking-tight">Defence Procurement <span className="text-muted font-normal">Intelligence</span></span>
            </Link>
            <nav className="flex items-center gap-1 text-sm ml-2">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="px-3 py-1.5 rounded-md text-muted hover:text-foreground hover:bg-panel transition-colors">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto text-xs text-muted-2 mono hidden sm:block">source: CanadaBuys open data</div>
          </div>
        </header>
        <main className="flex-1 mx-auto max-w-7xl w-full px-5 py-7">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-2 flex flex-wrap gap-x-4 gap-y-1">
            <span>Data: Government of Canada open data (CanadaBuys).</span>
            <span>Not affiliated with the Government of Canada.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
