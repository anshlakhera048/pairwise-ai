import type {
  AgentDate,
  Analysis,
  CreateParticipantInput,
  DashboardData,
  Health,
  Participant,
  ParticipantDetail,
  RankingEntry,
  SeedResult,
} from "./types";

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) || "http://localhost:8000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    });
  } catch {
    throw new ApiError(0, `Cannot reach API at ${API_BASE} — is the backend running?`);
  }
  if (res.status === 204) return undefined as T;
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const msg =
      (body as { error?: string } | null)?.error ??
      `Request failed with status ${res.status}`;
    throw new ApiError(res.status, msg);
  }
  return body as T;
}

const q = (params: Record<string, string | number | boolean | undefined>) => {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
};

export const api = {
  health: () => request<Health>("/api/health"),

  participants: (opts?: { q?: string; synthetic?: boolean }) =>
    request<{ participants: Participant[] }>(
      `/api/participants${q({ q: opts?.q, synthetic: opts?.synthetic })}`
    ),

  createParticipant: (input: CreateParticipantInput) =>
    request<Participant>("/api/participants", {
      method: "POST",
      body: JSON.stringify(input),
    }),

  participant: (id: string) =>
    request<ParticipantDetail>(`/api/participants/${encodeURIComponent(id)}`),

  deleteParticipant: (id: string) =>
    request<void>(`/api/participants/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),

  analyzeParticipant: (id: string) =>
    request<{ analysis: Analysis }>(
      `/api/participants/${encodeURIComponent(id)}/analyze`,
      { method: "POST" }
    ),

  dates: () => request<{ dates: AgentDate[] }>("/api/dates"),

  createDate: (participant_a_id: string, participant_b_id: string) =>
    request<AgentDate>("/api/dates", {
      method: "POST",
      body: JSON.stringify({ participant_a_id, participant_b_id }),
    }),

  date: (id: string) =>
    request<AgentDate>(`/api/dates/${encodeURIComponent(id)}`),

  rankings: (participantId: string) =>
    request<{ rankings: RankingEntry[] }>(
      `/api/rankings/${encodeURIComponent(participantId)}`
    ),

  recomputeRankings: () =>
    request<{ recomputed: number }>("/api/rankings/recompute", {
      method: "POST",
    }),

  dashboard: () => request<DashboardData>("/api/dashboard"),

  seed: () => request<SeedResult>("/api/seed", { method: "POST" }),
};

export { API_BASE };
