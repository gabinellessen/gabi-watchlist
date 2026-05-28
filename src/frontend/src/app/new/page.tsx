"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { TitleInput } from "@/lib/types";

const empty: TitleInput = {
  name: "",
  kind: "movie",
  genre: null,
  year: null,
  duration_minutes: null,
  rating: null,
  watched: false,
  notes: null,
};

export default function NewPage() {
  const router = useRouter();
  const [data, setData] = useState<TitleInput>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.createTitle(data);
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(String(err));
      setSubmitting(false);
    }
  }

  function update<K extends keyof TitleInput>(key: K, value: TitleInput[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Adicionar título</h1>

      <Field label="Nome">
        <input
          required
          value={data.name}
          onChange={(e) => update("name", e.target.value)}
          className="input"
          autoFocus
        />
      </Field>

      <Field label="Tipo">
        <select
          value={data.kind}
          onChange={(e) => update("kind", e.target.value as "movie" | "series")}
          className="input"
        >
          <option value="movie">Filme</option>
          <option value="series">Série</option>
        </select>
      </Field>

      <Field label="Gênero">
        <input
          value={data.genre ?? ""}
          onChange={(e) => update("genre", e.target.value || null)}
          className="input"
          placeholder="ex: drama, comédia, ficção científica"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Ano">
          <input
            type="number"
            value={data.year ?? ""}
            onChange={(e) =>
              update("year", e.target.value ? Number(e.target.value) : null)
            }
            className="input"
          />
        </Field>
        <Field label="Duração (min)">
          <input
            type="number"
            value={data.duration_minutes ?? ""}
            onChange={(e) =>
              update(
                "duration_minutes",
                e.target.value ? Number(e.target.value) : null,
              )
            }
            className="input"
          />
        </Field>
      </div>

      <Field label="Nota (0-10)">
        <input
          type="number"
          step="0.1"
          min={0}
          max={10}
          value={data.rating ?? ""}
          onChange={(e) =>
            update("rating", e.target.value ? Number(e.target.value) : null)
          }
          className="input"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={data.watched}
          onChange={(e) => update("watched", e.target.checked)}
          className="h-4 w-4"
        />
        Já assisti
      </label>

      <Field label="Notas">
        <textarea
          value={data.notes ?? ""}
          onChange={(e) => update("notes", e.target.value || null)}
          rows={3}
          className="input"
        />
      </Field>

      {error && (
        <p className="rounded border border-red-500/40 bg-red-950/30 p-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-blue-600 px-4 py-2 font-medium hover:bg-blue-500 disabled:opacity-50"
      >
        {submitting ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-300">{label}</span>
      {children}
    </label>
  );
}
