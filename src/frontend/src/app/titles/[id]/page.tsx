"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { Title } from "@/lib/types";

export default function TitlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const titleId = Number(id);
  const router = useRouter();
  const [title, setTitle] = useState<Title | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getTitle(titleId)
      .then(setTitle)
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false));
  }, [titleId]);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!title) return;
    setSaving(true);
    setError(null);
    try {
      const update = {
        name: title.name,
        kind: title.kind,
        genre: title.genre,
        year: title.year,
        duration_minutes: title.duration_minutes,
        rating: title.rating,
        watched: title.watched,
        notes: title.notes,
      };
      await api.updateTitle(titleId, update);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  async function onDelete() {
    if (!confirm("Excluir este título?")) return;
    setSaving(true);
    try {
      await api.deleteTitle(titleId);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(String(err));
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-400">Carregando...</p>;
  if (error && !title)
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-6">
        <p className="font-semibold text-red-300">Erro</p>
        <p className="mt-2 text-sm text-red-400/80">{error}</p>
      </div>
    );
  if (!title) return null;

  return (
    <form onSubmit={onSave} className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Editar: {title.name}</h1>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Nome</span>
        <input
          required
          value={title.name}
          onChange={(e) => setTitle({ ...title, name: e.target.value })}
          className="input"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Tipo</span>
        <select
          value={title.kind}
          onChange={(e) =>
            setTitle({ ...title, kind: e.target.value as "movie" | "series" })
          }
          className="input"
        >
          <option value="movie">Filme</option>
          <option value="series">Série</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Gênero</span>
        <input
          value={title.genre ?? ""}
          onChange={(e) => setTitle({ ...title, genre: e.target.value || null })}
          className="input"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">Ano</span>
          <input
            type="number"
            value={title.year ?? ""}
            onChange={(e) =>
              setTitle({
                ...title,
                year: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="input"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-slate-300">
            Duração (min)
          </span>
          <input
            type="number"
            value={title.duration_minutes ?? ""}
            onChange={(e) =>
              setTitle({
                ...title,
                duration_minutes: e.target.value ? Number(e.target.value) : null,
              })
            }
            className="input"
          />
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Nota</span>
        <input
          type="number"
          step="0.1"
          min={0}
          max={10}
          value={title.rating ?? ""}
          onChange={(e) =>
            setTitle({
              ...title,
              rating: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="input"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={title.watched}
          onChange={(e) => setTitle({ ...title, watched: e.target.checked })}
          className="h-4 w-4"
        />
        Assistido
      </label>

      <label className="block">
        <span className="mb-1 block text-sm font-medium text-slate-300">Notas</span>
        <textarea
          value={title.notes ?? ""}
          onChange={(e) => setTitle({ ...title, notes: e.target.value || null })}
          rows={3}
          className="input"
        />
      </label>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
        >
          Salvar
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={saving}
          className="rounded-md bg-red-600/80 px-4 py-2 font-medium hover:bg-red-500 disabled:opacity-50"
        >
          Excluir
        </button>
      </div>
    </form>
  );
}
