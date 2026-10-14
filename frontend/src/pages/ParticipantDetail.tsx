import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ApiError, api } from "../api";
import type { Participant, ParticipantDetail, RankingEntry } from "../types";
import { InstagramIcon, LinkedinIcon } from "../components/ParticipantCard";
import {
  Badge,
  ConfidenceBadge,
  ConfirmDialog,
  EmptyState,
  ScoreBar,
  SectionTitle,
  SourceBadge,
  Spinner,
  btnDanger,
  btnPrimary,
  btnSecondary,
} from "../components/ui";

const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/20";

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_rgba(28,25,23,0.05)] ${className}`}
    >
      {children}
    </div>
  );
}

export function ParticipantDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<ParticipantDetail | null>(null);
  const [all, setAll] = useState<Participant[]>([]);
  const [rankings, setRankings] = useState<RankingEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [datePartner, setDatePartner] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [d, r, list] = await Promise.all([
        api.participant(id),
        api.rankings(id).catch(() => ({ rankings: [] as RankingEntry[] })),
        api.participants().catch(() => ({ participants: [] as Participant[] })),
      ]);
      setDetail(d);
      setRankings(r.rankings);
      setAll(list.participants);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load profile.");
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const names = new Map(all.map((p) => [p.id, p.name]));

  const runAnalysis = async () => {
    if (!id) return;
    setBusy(true);
    setActionMsg(null);
    try {
      await api.analyzeParticipant(id);
      await load();
      setActionMsg("Analysis complete.");
    } catch (e) {
      setActionMsg(e instanceof ApiError ? `Analysis failed: ${e.message}` : "Analysis failed.");
    } finally {
      setBusy(false);
    }
  };

  const startDate = async () => {
    if (!id || !datePartner) return;
    setBusy(true);
    setActionMsg(null);
    try {
      const d = await api.createDate(id, datePartner);
      navigate(`/arena?date=${d.id}`);
    } catch (e) {
      setActionMsg(e instanceof ApiError ? `Could not start date: ${e.message}` : "Could not start date.");
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await api.deleteParticipant(id);
      navigate("/participants");
    } catch (e) {
      setActionMsg(e instanceof ApiError ? `Delete failed: ${e.message}` : "Delete failed.");
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  if (error) {
    return (
      <div className="animate-fade-in-up rounded-2xl border border-stone-200 bg-white p-8 text-center">
        <p className="font-display text-2xl text-ink">Profile not found</p>
        <p className="mt-2 text-sm text-stone-500">{error}</p>
        <Link to="/participants" className={`${btnSecondary} mt-5`}>
          Back to participants
        </Link>
      </div>
    );
  }
  if (!detail) return <Spinner label="Loading profile…" />;

  const { participant: p, analysis } = detail;
  const others = all.filter((x) => x.id !== p.id);
  const topRankings = [...rankings].sort((a, b) => a.rank - b.rank).slice(0, 8);

  return (
    <div>
      <Link to="/participants" className="text-sm font-medium text-stone-500 hover:text-rose-deep">
        ← All participants
      </Link>

      {/* Header */}
      <div className="animate-fade-in-up mt-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_rgba(28,25,23,0.05)] sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-rose-soft font-display text-2xl text-rose-deep">
              {p.name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
            </div>
            <div>
              <h1 className="font-display text-3xl text-ink sm:text-4xl">
                {p.name}, {p.age}
              </h1>
              <p className="mt-1 text-stone-500">{p.location}</p>
              <p className="mt-2 max-w-xl text-stone-600">{p.headline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <a href={p.linkedin_url} target="_blank" rel="noreferrer" className={`${btnSecondary} !px-3.5 !py-1.5 !text-xs`}>
                  <LinkedinIcon /> LinkedIn
                </a>
                <a href={p.instagram_url} target="_blank" rel="noreferrer" className={`${btnSecondary} !px-3.5 !py-1.5 !text-xs`}>
                  <InstagramIcon /> Instagram
                </a>
                {p.is_synthetic && <Badge tone="stone">demo profile</Badge>}
                {analysis && <Badge tone="blue">analyzed by {analysis.analyzer}</Badge>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <button onClick={() => void runAnalysis()} disabled={busy} className={btnPrimary}>
              {busy ? "Working…" : analysis ? "Re-run analysis" : "Run analysis"}
            </button>
            <button onClick={() => setConfirmDelete(true)} disabled={busy} className={btnDanger}>
              Delete
            </button>
          </div>
        </div>
        {actionMsg && <p className="animate-fade-in mt-4 text-sm text-stone-600">{actionMsg}</p>}
      </div>

      {!analysis ? (
        <div className="mt-6">
          <EmptyState
            title="No analysis yet"
            hint="Run the profile analysis to extract traits, interests, evidence, and the agent's dating priorities from this participant's LinkedIn and Instagram."
            action={
              <button onClick={() => void runAnalysis()} disabled={busy} className={btnPrimary}>
                {busy ? "Analyzing…" : "Run analysis"}
              </button>
            }
          />
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <SectionTitle>Profile summary</SectionTitle>
              <p className="leading-relaxed text-stone-700">{analysis.summary}</p>
            </Card>

            <Card>
              <SectionTitle>Traits</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {analysis.traits.map((t) => (
                  <span key={t.trait} className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-cream px-3.5 py-1.5 text-sm">
                    {t.trait} <ConfidenceBadge value={t.confidence} />
                  </span>
                ))}
              </div>
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-stone-400">Interests</h3>
                <div className="flex flex-wrap gap-2">
                  {analysis.interests.map((i) => (
                    <Badge key={i} tone="rose">{i}</Badge>
                  ))}
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle>Evidence</SectionTitle>
              <p className="mb-4 text-xs text-stone-500">
                Every observation is tied to its source. Facts are separated from inferences.
              </p>
              <div className="space-y-4">
                {analysis.evidence.map((e, i) => (
                  <div key={i} className="rounded-xl border border-stone-100 bg-cream/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-ink">{e.claim}</p>
                      <div className="flex items-center gap-2">
                        <SourceBadge source={e.source} />
                        <ConfidenceBadge value={e.confidence} />
                      </div>
                    </div>
                    <blockquote className="mt-2 border-l-2 border-rose/40 pl-3 text-sm italic text-stone-600">
                      “{e.quote}”
                    </blockquote>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <SectionTitle>Unknowns</SectionTitle>
              {analysis.unknowns.length === 0 ? (
                <p className="text-sm text-stone-500">Nothing flagged as unknown.</p>
              ) : (
                <ul className="list-disc space-y-1.5 pl-5 text-sm text-stone-600">
                  {analysis.unknowns.map((u, i) => (
                    <li key={i}>{u}</li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <SectionTitle>Preferences</SectionTitle>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-stone-400">Looking for</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{analysis.preferences.looking_for}</p>
              <h3 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-widest text-stone-400">Dealbreakers</h3>
              {analysis.preferences.dealbreakers.length === 0 ? (
                <p className="text-sm text-stone-500">None stated.</p>
              ) : (
                <ul className="space-y-1.5">
                  {analysis.preferences.dealbreakers.map((d, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-stone-700">
                      <span className="text-rose">✕</span> {d}
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <SectionTitle>Agent priorities</SectionTitle>
              <ol className="space-y-2.5">
                {analysis.priorities.map((pr, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-stone-700">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-soft text-xs font-bold text-rose-deep">
                      {i + 1}
                    </span>
                    {pr}
                  </li>
                ))}
              </ol>
            </Card>

            <Card>
              <SectionTitle>Start a date</SectionTitle>
              <label className="mb-1 block text-xs font-semibold text-stone-600">Choose a partner</label>
              <select value={datePartner} onChange={(e) => setDatePartner(e.target.value)} className={inputCls}>
                <option value="">Select participant…</option>
                {others.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}, {o.age} — {o.location}
                  </option>
                ))}
              </select>
              <button onClick={() => void startDate()} disabled={busy || !datePartner} className={`${btnPrimary} mt-3 w-full`}>
                {busy ? "Starting…" : "Start agent date ♥"}
              </button>
            </Card>
          </div>
        </div>
      )}

      {/* Rankings */}
      <div className="mt-10">
        <SectionTitle
          action={
            <Link to="/rankings" className="text-sm font-semibold text-rose-deep hover:underline">
              Full rankings →
            </Link>
          }
        >
          Personalized matches for {p.name.split(" ")[0]}
        </SectionTitle>
        {topRankings.length === 0 ? (
          <EmptyState
            title="No rankings yet"
            hint="Rankings are computed from profile compatibility and completed agent dates."
          />
        ) : (
          <div className="space-y-3">
            {topRankings.map((r) => (
              <div key={r.candidate_id} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_rgba(28,25,23,0.05)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-ink font-display text-lg text-cream">
                      {r.rank}
                    </span>
                    <div>
                      <p className="font-semibold text-ink">{names.get(r.candidate_id) ?? r.candidate_id}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {r.based_on_date_id && <Badge tone="green">based on actual date</Badge>}
                        <ConfidenceBadge value={r.confidence} />
                      </div>
                    </div>
                  </div>
                  <div className="w-48"><ScoreBar score={r.score} /></div>
                </div>
                {r.reasons.length > 0 && (
                  <ul className="mt-3 space-y-1">
                    {r.reasons.slice(0, 3).map((reason, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-600">
                        <span className="text-emerald-600">✓</span> {reason}
                      </li>
                    ))}
                  </ul>
                )}
                {r.conflicts.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {r.conflicts.slice(0, 2).map((c, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-stone-500">
                        <span className="text-amber-500">⚠</span> {c}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${p.name}?`}
          message="This permanently removes the participant, their analysis, dates, and rankings. This cannot be undone."
          onConfirm={() => void doDelete()}
          onCancel={() => setConfirmDelete(false)}
          busy={busy}
        />
      )}
    </div>
  );
}
