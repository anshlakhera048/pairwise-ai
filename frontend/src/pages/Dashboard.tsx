import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import type { DashboardData, Health } from "../types";
import { Badge, EmptyState, Spinner, StatCard, btnPrimary, btnSecondary } from "../components/ui";

export function Dashboard() {
  const [health, setHealth] = useState<Health | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setError(null);
    try {
      const [h, d] = await Promise.all([api.health(), api.dashboard()]);
      setHealth(h);
      setData(d);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load dashboard.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSeed = async () => {
    setSeeding(true);
    setSeedMsg(null);
    try {
      const r = await api.seed();
      if (r.seeded) {
        setSeedMsg(
          `Demo data loaded${r.participants ? ` — ${r.participants} participants` : ""}.`
        );
      } else {
        setSeedMsg(r.reason ?? "Seed request completed without changes.");
      }
      await load();
    } catch (e) {
      setSeedMsg(e instanceof ApiError ? `Seed failed: ${e.message}` : "Seed failed.");
    } finally {
      setSeeding(false);
    }
  };

  if (error && !data) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="font-display text-2xl text-ink">Couldn't reach the backend</p>
        <p className="mt-2 text-sm text-stone-500">{error}</p>
        <button onClick={() => void load()} className={`${btnSecondary} mt-5`}>
          Retry
        </button>
      </div>
    );
  }

  if (!data) return <Spinner label="Loading dashboard…" />;

  return (
    <div>
      <div className="animate-fade-in-up mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose">
          Agentic matchmaking
        </p>
        <h1 className="mt-2 font-display text-4xl text-ink sm:text-5xl">
          Every date, <span className="italic text-rose-deep">explained.</span>
        </h1>
        <p className="mt-3 max-w-2xl text-stone-600">
          AI agents read each participant's LinkedIn and Instagram, go on real multi-turn
          dates with each other, and produce personalized, explainable rankings.
        </p>
      </div>

      {health && !health.llm_configured && (
        <div className="animate-fade-in-up stagger-1 mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-800">
            <span className="font-semibold">Live AI not configured</span> — dates run in
            labeled scripted demo mode. Set <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">LLM_API_KEY</code> in
            the backend <code className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-xs">.env</code> for
            real LLM dates.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Participants" value={data.participant_count} index={0} />
        <StatCard label="Analyses completed" value={data.analyses_completed} index={1} />
        <StatCard label="Agent dates" value={data.dates_completed} index={2} />
        <StatCard label="Ranked participants" value={data.rankings_completed} index={3} />
      </div>

      <div className="animate-fade-in-up stagger-3 mt-8 flex flex-wrap gap-3">
        <button onClick={() => void handleSeed()} disabled={seeding} className={btnPrimary}>
          {seeding ? "Loading demo…" : "Load demo data"}
        </button>
        <button
          onClick={() => navigate("/participants", { state: { openAdd: true } })}
          className={btnSecondary}
        >
          Add participant
        </button>
      </div>
      {seedMsg && (
        <p className="animate-fade-in mt-3 text-sm text-stone-600">{seedMsg}</p>
      )}

      <div className="animate-fade-in-up stagger-4 mt-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Recent interactions</h2>
          <Link to="/arena" className="text-sm font-semibold text-rose-deep hover:underline">
            Open arena →
          </Link>
        </div>
        {data.recent_interactions.length === 0 ? (
          <EmptyState
            title="No dates yet"
            hint="Run the demo seed above, then send two agents on their first date in the arena."
            action={
              <Link to="/arena" className={btnSecondary}>
                Go to arena
              </Link>
            }
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
            {data.recent_interactions.map((ri) => (
              <Link
                key={ri.date_id}
                to={`/arena?date=${ri.date_id}`}
                className="flex items-center justify-between gap-4 border-b border-stone-100 px-5 py-4 transition last:border-0 hover:bg-cream"
              >
                <div>
                  <p className="font-medium text-ink">
                    {ri.a_name} <span className="text-rose">♥</span> {ri.b_name}
                  </p>
                  <p className="text-xs text-stone-400">
                    {new Date(ri.created_at).toLocaleString()}
                  </p>
                </div>
                <Badge tone={ri.decision.toLowerCase().includes("match") ? "rose" : "stone"}>
                  {ri.decision}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
