import Link from "next/link";
import { api } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let titles;
  try {
    titles = await api.listTitles();
  } catch (err) {
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-6">
        <p className="font-semibold text-red-300">Erro ao carregar títulos</p>
        <p className="mt-2 text-sm text-red-400/80">{String(err)}</p>
        <p className="mt-4 text-xs text-slate-400">
          NEXT_PUBLIC_API_BASE_URL: {process.env.NEXT_PUBLIC_API_BASE_URL ?? "(undefined)"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Minha watchlist</h1>
        <Link
          href="/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500"
        >
          + Adicionar título
        </Link>
      </div>

      {titles.length === 0 ? (
        <p className="text-slate-400">Nenhum título cadastrado ainda.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {titles.map((t) => (
            <li
              key={t.id}
              className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 transition hover:border-slate-700"
            >
              <Link href={`/titles/${t.id}`} className="block">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-semibold">{t.name}</h2>
                    <p className="mt-1 text-xs text-slate-400">
                      {t.kind === "movie" ? "🎬 Filme" : "📺 Série"}
                      {t.genre ? ` · ${t.genre}` : ""}
                      {t.year ? ` · ${t.year}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-xs ${
                      t.watched
                        ? "bg-green-500/20 text-green-300"
                        : "bg-amber-500/20 text-amber-300"
                    }`}
                  >
                    {t.watched ? "Assistido" : "Pendente"}
                  </span>
                </div>
                {t.rating != null && (
                  <p className="mt-2 text-sm text-slate-300">⭐ {t.rating}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
