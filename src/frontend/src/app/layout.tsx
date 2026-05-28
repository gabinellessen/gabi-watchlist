import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Watchlist",
  description: "Minha watchlist de filmes e séries",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
          <nav className="mx-auto flex max-w-5xl items-center justify-between p-4">
            <Link href="/" className="text-xl font-bold">
              🎬 Watchlist
            </Link>
            <div className="flex gap-4 text-sm">
              <Link href="/" className="hover:text-blue-400">
                Lista
              </Link>
              <Link href="/new" className="hover:text-blue-400">
                Adicionar
              </Link>
              <Link href="/report" className="hover:text-blue-400">
                Relatório
              </Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl p-6">{children}</main>
      </body>
    </html>
  );
}
