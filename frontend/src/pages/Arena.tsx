import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ApiError, api } from "../api";
import type { AgentDate, DateEval, Participant } from "../types";
import {
  Badge,
  EmptyState,
  ModeBadge,
  ScoreBar,
  SectionTitle,
  Spinner,
  btnPrimary,
  btnSecondary,
} from "../components/ui";

const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/20";

function EvalCard({ title, ev }: { title: string; ev: DateEval }) {
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-ink">{title}</h3>
        <span className="font-display text-2xl text-rose-deep">{Math.round(ev.score)}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-stone-600">{ev.summary}</p>
      {ev.pros.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">What worked</p>
          <ul className="mt-1 space-y-1">
            {ev.pros.map((pr, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                <span className="text-emerald-600">+</span> {pr}
              </li>
            ))}
          </ul>
        </div>
      )}
      {ev.cons.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Friction</p>
          <ul className="mt-1 space-y-1">
            {ev.cons.map((c, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                <span className="text-amber-500">−</span> {c}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function Arena() {
  const [dates, setDates] = useState<AgentDate[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [aId, setAId] = useState("");
  const [bId, setBId] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [d, p] = await Promise.all([api.dates(), api.participants()]);
      setDates(d.dates);
      setParticipants(p.participants);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load arena.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const names = useMemo(() => new Map(participants.map((p) => [p.id, p.name])), [participants]);

  const selectedId = searchParams.get("date");
  const selected = dates.find((d) => d.id === selectedId) ?? dates[0] ?? null;

  useEffect(() => {
    if (!selectedId && dates.length > 0) {
      setSearchParams({ date: dates[0].id }, { replace: true });
    }
  }, [selectedId, dates, setSearchParams]);

  const createDate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!aId || !bId) {
      setFormError("Pick two participants.");
      return;
    }
    if (aId === bId) {
      setFormError("Pick two different participants.");
      return;
    }
    setCreating(true);
    try {
      const d = await api.createDate(aId, bId);
      setDates((prev) => [d, ...prev]);
      setSearchParams({ date: d.id });
      setAId("");
      setBId("");
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Could not start the date.");
    } finally {
      setCreating(false);
    }
  };

  const nameOf = (pid: string) => names.get(pid) ?? "…";

  if (loading) return <Spinner label="Loading arena…" />;
  if (error) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="text-sm text-stone-500">{error}</p>
        <button onClick={() => void load()} className={`${btnSecondary} mt-4`}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="animate-fade-in-up mb-6">
        <h1 className="font-display text-4xl text-ink">Dating Arena</h1>
        <p className="mt-1 text-stone-500">
          Two agents, one conversation — genuine multi-turn dates, independently evaluated.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: date list + new date */}
        <div className="space-y-6">
          <div className="animate-fade-in-up stagger-1 rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
            <h2 className="mb-3 font-display text-xl text-ink">New date</h2>
            <form onSubmit={createDate} className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Agent A</label>
                <select value={aId} onChange={(e) => setAId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {p.age}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-stone-600">Agent B</label>
                <select value={bId} onChange={(e) => setBId(e.target.value)} className={inputCls}>
                  <option value="">Select…</option>
                  {participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}, {p.age}
                    </option>
                  ))}
                </select>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <button type="submit" disabled={creating} className={`${btnPrimary} w-full`}>
                {creating ? "Starting date…" : "Start agent date ♥"}
              </button>
            </form>
          </div>

          <div className="animate-fade-in-up stagger-2">
            <SectionTitle>Completed dates</SectionTitle>
            {dates.length === 0 ? (
              <EmptyState title="No dates yet" hint="Start one above." />
            ) : (
              <div className="space-y-2.5">
                {dates.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setSearchParams({ date: d.id })}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected?.id === d.id
                        ? "border-rose bg-rose-soft/40 shadow-[0_2px_12px_rgba(190,74,107,0.15)]"
                        : "border-stone-200 bg-white hover:border-stone-300 hover:shadow-[0_2px_12px_rgba(28,25,23,0.06)]"
                    }`}
                  >
                    <p className="font-medium text-ink">
                      {nameOf(d.participant_a_id)} <span className="text-rose">♥</span>{" "}
                      {nameOf(d.participant_b_id)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <ModeBadge mode={d.mode} />
                      <Badge tone="stone">{d.status}</Badge>
                    </div>
                    <p className="mt-1.5 truncate text-xs text-stone-400">{d.decision}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: transcript */}
        <div className="lg:col-span-2">
          {!selected ? (
            <EmptyState
              title="No dates yet — start one above"
              hint="Pick two participants and their agents will hold a real multi-turn dating conversation."
            />
          ) : (
            <div className="animate-fade-in space-y-6">
              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-display text-2xl text-ink">
                    {nameOf(selected.participant_a_id)}{" "}
                    <span className="text-rose">♥</span> {nameOf(selected.participant_b_id)}
                  </h2>
                  <ModeBadge mode={selected.mode} />
                </div>
                <p className="mt-1 text-xs text-stone-400">
                  {new Date(selected.created_at).toLocaleString()} · {selected.transcript.length}{" "}
                  turns · status: {selected.status}
                </p>
              </div>

              <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
                <h3 className="mb-4 font-display text-xl text-ink">The conversation</h3>
                <div className="space-y-4">
                  {selected.transcript.map((t) => {
                    const isA = t.speaker === "a";
                    const speakerName = isA
                      ? nameOf(selected.participant_a_id)
                      : nameOf(selected.participant_b_id);
                    return (
                      <div key={t.turn} className={`flex ${isA ? "justify-start" : "justify-end"}`}>
                        <div
                          className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${
                            isA
                              ? "rounded-bl-md border border-rose/20 bg-rose-soft/60"
                              : "rounded-br-md border border-stone-200 bg-stone-100"
                          }`}
                        >
                          <p className="mb-1 flex items-center gap-2 text-xs font-semibold">
                            <span className={isA ? "text-rose-deep" : "text-ink"}>{speakerName}</span>
                            <span className="font-normal text-stone-400">turn {t.turn}</span>
                          </p>
                          <p className="text-sm leading-relaxed text-ink">{t.text}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <EvalCard title={`${nameOf(selected.participant_a_id)}'s take`} ev={selected.eval_a} />
                <EvalCard title={`${nameOf(selected.participant_b_id)}'s take`} ev={selected.eval_b} />
              </div>

              <div className="rounded-2xl border border-rose/25 bg-gradient-to-br from-rose-soft/70 to-white p-6">
                <h3 className="font-display text-xl text-ink">Final decision</h3>
                <p className="mt-1 font-semibold text-rose-deep">{selected.decision}</p>
                <p className="mt-2 text-sm leading-relaxed text-stone-600">
                  {selected.decision_explanation}
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {nameOf(selected.participant_a_id)} — compatibility
                    </p>
                    <ScoreBar score={selected.eval_a.score} />
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-stone-400">
                      {nameOf(selected.participant_b_id)} — compatibility
                    </p>
                    <ScoreBar score={selected.eval_b.score} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
