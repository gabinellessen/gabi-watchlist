"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Report } from "@/lib/types";

export default function ReportPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getReport()
      .then(setReport)
      .catch((err) => setError(String(err)));
  }, []);

  if (error)
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-950/30 p-6">
        <p className="font-semibold text-red-300">Erro ao gerar relatório</p>
        <p className="mt-2 text-sm text-red-400/80">{error}</p>
      </div>
    );
  if (!report) return <p className="text-slate-400">Gerando relatório...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Relatório</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card label="Total" value={report.total_titulos} />
        <Card
          label="Assistidos"
          value={`${report.assistidos} (${report.percentual_assistido}%)`}
        />
        <Card
          label="Duração média"
          value={`${report.duracao_media_minutos} min`}
        />
        <Card label="Nota média" value={report.nota_media.toFixed(1)} />
      </div>

      <Section title="Por tipo">
        <Bars data={report.por_tipo} />
      </Section>

      <Section title="Por gênero">
        <Bars data={report.por_genero} />
      </Section>

      {report.top_genero_assistido && (
        <p className="text-sm text-slate-400">
          Gênero mais assistido:{" "}
          <strong className="text-slate-200">{report.top_genero_assistido}</strong>
        </p>
      )}
    </div>
  );
}

function Card({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </div>
  );
}

function Bars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div className="space-y-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex items-center gap-3">
          <span className="w-32 truncate text-sm text-slate-300">{label}</span>
          <div className="relative flex-1 overflow-hidden rounded bg-slate-800">
            <div
              className="h-6 bg-blue-500/70"
              style={{ width: `${(value / max) * 100}%` }}
            />
          </div>
          <span className="w-8 text-right text-sm text-slate-400">{value}</span>
        </div>
      ))}
    </div>
  );
}
