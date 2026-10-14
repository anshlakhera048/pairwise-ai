import type { ReactNode } from "react";
import type { DateMode } from "../types";

/* ---------- Spinner ---------- */
export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-stone-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-stone-300 border-t-rose" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/* ---------- Empty state ---------- */
export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-white/60 px-6 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-soft text-2xl text-rose">
        ♥
      </div>
      <p className="font-display text-xl text-ink">{title}</p>
      {hint && <p className="mt-2 max-w-sm text-sm text-stone-500">{hint}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------- Badge ---------- */
type Tone = "rose" | "stone" | "green" | "amber" | "blue" | "ink";

const toneStyles: Record<Tone, string> = {
  rose: "bg-rose-soft text-rose-deep border-rose/25",
  stone: "bg-stone-100 text-stone-600 border-stone-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  ink: "bg-ink text-cream border-ink",
};

export function Badge({
  children,
  tone = "stone",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* ---------- Score bar ---------- */
export function ScoreBar({ score, className = "" }: { score: number; className?: string }) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-stone-200">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose to-rose-deep transition-all duration-700"
          style={{ width: `${s}%` }}
        />
      </div>
      <span className="w-10 text-right text-sm font-semibold tabular-nums text-ink">{s}</span>
    </div>
  );
}

/* ---------- Confidence badge ---------- */
export function ConfidenceBadge({ value }: { value: number }) {
  const v = Math.round(value * 100);
  const tone: Tone = v >= 75 ? "green" : v >= 50 ? "amber" : "stone";
  return <Badge tone={tone}>{v}% sure</Badge>;
}

/* ---------- Modal ---------- */
export function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`animate-fade-in-up max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl ${
          wide ? "max-w-2xl" : "max-w-lg"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-stone-400 transition hover:bg-stone-100 hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ---------- Confirm dialog ---------- */
export function ConfirmDialog({
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm leading-relaxed text-stone-600">{message}</p>
      <div className="mt-6 flex justify-end gap-3">
        <button onClick={onCancel} className={btnSecondary} disabled={busy}>
          Cancel
        </button>
        <button onClick={onConfirm} className={btnDanger} disabled={busy}>
          {busy ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ---------- Stat card ---------- */
export function StatCard({
  label,
  value,
  sub,
  index = 0,
}: {
  label: string;
  value: number | string;
  sub?: string;
  index?: number;
}) {
  return (
    <div
      className={`animate-fade-in-up stagger-${Math.min(index + 1, 6)} rounded-2xl border border-stone-200 bg-white p-6 shadow-[0_2px_12px_rgba(28,25,23,0.05)]`}
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-stone-400">{label}</p>
      <p className="mt-2 font-display text-4xl text-ink">{value}</p>
      {sub && <p className="mt-1 text-sm text-stone-500">{sub}</p>}
    </div>
  );
}

/* ---------- Section title ---------- */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-display text-2xl text-ink">{children}</h2>
      {action}
    </div>
  );
}

/* ---------- Source badge ---------- */
export function SourceBadge({ source }: { source: string }) {
  const s = source.toLowerCase();
  const tone: Tone = s.includes("linkedin") ? "blue" : s.includes("instagram") ? "rose" : "stone";
  const label = s.includes("linkedin") ? "LinkedIn" : s.includes("instagram") ? "Instagram" : source;
  return <Badge tone={tone}>{label}</Badge>;
}

/* ---------- Mode badge ---------- */
export function ModeBadge({ mode }: { mode: DateMode }) {
  return mode === "live_llm" ? (
    <Badge tone="green">LIVE LLM</Badge>
  ) : (
    <Badge tone="amber">SCRIPTED DEMO — not LLM-generated</Badge>
  );
}

/* ---------- Analysis status badge ---------- */
export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const tone: Tone =
    s === "completed" ? "green" : s === "failed" ? "rose" : s === "running" ? "amber" : "stone";
  return <Badge tone={tone}>{status.replace(/_/g, " ")}</Badge>;
}

/* ---------- Buttons (shared classes via plain tailwind strings) ---------- */
// .btn-primary etc. are defined as utility classes below for reuse.
export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-full bg-rose px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-deep disabled:cursor-not-allowed disabled:opacity-50";
export const btnSecondary =
  "inline-flex items-center justify-center gap-2 rounded-full border border-stone-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink shadow-sm transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50";
export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50";
