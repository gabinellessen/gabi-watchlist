import type { Report, Title, TitleInput } from "./types";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listTitles: () => http<Title[]>("/titles/"),
  getTitle: (id: number) => http<Title>(`/titles/${id}`),
  createTitle: (data: TitleInput) =>
    http<Title>("/titles/", { method: "POST", body: JSON.stringify(data) }),
  updateTitle: (id: number, data: Partial<TitleInput>) =>
    http<Title>(`/titles/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTitle: (id: number) =>
    http<{ ok: boolean }>(`/titles/${id}`, { method: "DELETE" }),
  getReport: () => http<Report>("/report"),
};
