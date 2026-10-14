import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError, api } from "../api";
import type { Participant, RankingEntry } from "../types";
import {
  Badge,
  ConfidenceBadge,
  EmptyState,
  ScoreBar,
  Spinner,
  btnPrimary,
  btnSecondary,
} from "../components/ui";

const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/20";

export function Rankings() {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.participants();
        setParticipants(r.participants);
        if (r.participants.length > 0) setSelectedId(r.participants[0].id);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : "Failed to load participants.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadRankings = useCallback(async (pid: string) => {
    setListLoading(true);
    setError(null);
    try {
      const r = await api.rankings(pid);
      setRankings([...r.rankings].sort((a, b) => a.rank - b.rank));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load rankings.");
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) void loadRankings(selectedId);
  }, [selectedId, loadRankings]);

  const recompute = async () => {
    setRecomputing(true);
    setNotice(null);
    try {
      const r = await api.recomputeRankings();
      setNotice(`Rankings recomputed — ${r.recomputed} entries refreshed.`);
      if (selectedId) await loadRankings(selectedId);
    } catch (e) {
      setNotice(e instanceof ApiError ? `Recompute failed: ${e.message}` : "Recompute failed.");
    } finally {
      setRecomputing(false);
    }
  };

  const names = new Map(participants.map((p) => [p.id, p]));
  const selected = participants.find((p) => p.id === selectedId);

  if (loading) return <Spinner label="Loading rankings…" />;

  return (
    <div>
      <div className="animate-fade-in-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Rankings</h1>
          <p className="mt-1 max-w-xl text-stone-500">
            Personalized and directional — {selected?.name.split(" ")[0] ?? "your"} ranking of
            someone need not match theirs. Scores are estimates, not guarantees.
          </p>
        </div>
        <button onClick={() => void recompute()} disabled={recomputing} className={btnSecondary}>
          {recomputing ? "Recomputing…" : "Recompute all rankings"}
        </button>
      </div>
      {notice && <p className="animate-fade-in mb-4 text-sm text-stone-600">{notice}</p>}

      <div className="animate-fade-in-up stagger-1 mb-6 max-w-md">
        <label className="mb-1 block text-xs font-semibold text-stone-600">
          Rank matches for
        </label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className={inputCls}
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}, {p.age} — {p.location}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-sm text-stone-500">{error}</p>
          <button
            onClick={() => selectedId && void loadRankings(selectedId)}
            className={`${btnSecondary} mt-4`}
          >
            Retry
          </button>
        </div>
      ) : listLoading ? (
        <Spinner label="Loading rankings…" />
      ) : rankings.length === 0 ? (
        <EmptyState
          title="No rankings yet"
          hint="Run profile analyses and agent dates first — rankings combine both."
          action={
            <Link to="/arena" className={btnPrimary}>
              Open arena
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {rankings.map((r, i) => {
            const cand = names.get(r.candidate_id);
            return (
              <div
                key={r.candidate_id}
                className={`animate-fade-in-up stagger-${Math.min((i % 6) + 1, 6)} rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_rgba(28,25,23,0.05)]`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink font-display text-xl text-cream">
                      {r.rank}
                    </span>
                    <div>
                      <Link
                        to={`/participants/${r.candidate_id}`}
                        className="font-semibold text-ink hover:text-rose-deep hover:underline"
                      >
                        {cand ? `${cand.name}, ${cand.age}` : r.candidate_id}
                      </Link>
                      {cand && <p className="text-xs text-stone-400">{cand.location}</p>}
                      <div className="mt-1.5 flex flex-wrap gap-2">
                        {r.based_on_date_id && (
                          <Badge tone="green">based on actual date</Badge>
                        )}
                        <ConfidenceBadge value={r.confidence} />
                      </div>
                    </div>
                  </div>
                  <div className="w-52">
                    <ScoreBar score={r.score} />
                  </div>
                </div>
                {r.reasons.length > 0 && (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-emerald-600">
                        Why it could work
                      </p>
                      <ul className="space-y-1.5">
                        {r.reasons.map((reason, j) => (
                          <li key={j} className="flex items-start gap-2 text-sm text-stone-600">
                            <span className="text-emerald-600">✓</span> {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                    {r.conflicts.length > 0 && (
                      <div>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-amber-600">
                          Watch out for
                        </p>
                        <ul className="space-y-1.5">
                          {r.conflicts.map((c, j) => (
                            <li key={j} className="flex items-start gap-2 text-sm text-stone-600">
                              <span className="text-amber-500">⚠</span> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
