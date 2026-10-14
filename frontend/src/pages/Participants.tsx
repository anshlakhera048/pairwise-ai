import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { ApiError, api } from "../api";
import type { Participant } from "../types";
import { ParticipantCard } from "../components/ParticipantCard";
import { EmptyState, Modal, Spinner, btnPrimary, btnSecondary } from "../components/ui";

const inputCls =
  "w-full rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-stone-400 focus:border-rose focus:outline-none focus:ring-2 focus:ring-rose/20";

function AddParticipantModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    name: "",
    age: "",
    location: "",
    headline: "",
    linkedin_url: "",
    instagram_url: "",
    linkedin_text: "",
    instagram_text: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.createParticipant({
        name: form.name.trim(),
        age: Number(form.age),
        location: form.location.trim(),
        headline: form.headline.trim(),
        linkedin_url: form.linkedin_url.trim(),
        instagram_url: form.instagram_url.trim(),
        linkedin_text: form.linkedin_text.trim() || undefined,
        instagram_text: form.instagram_text.trim() || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create participant.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Add participant" onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-600">Name *</label>
            <input required className={inputCls} value={form.name} onChange={set("name")} placeholder="Aarav Sharma" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-600">Age *</label>
            <input required type="number" min={18} max={120} className={inputCls} value={form.age} onChange={set("age")} placeholder="28" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-stone-600">Location *</label>
          <input required className={inputCls} value={form.location} onChange={set("location")} placeholder="Mumbai, India" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-stone-600">Headline *</label>
          <input required className={inputCls} value={form.headline} onChange={set("headline")} placeholder="Product designer who hikes on weekends" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-600">LinkedIn URL *</label>
            <input required type="url" className={inputCls} value={form.linkedin_url} onChange={set("linkedin_url")} placeholder="https://linkedin.com/in/…" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-stone-600">Instagram URL *</label>
            <input required type="url" className={inputCls} value={form.instagram_url} onChange={set("instagram_url")} placeholder="https://instagram.com/…" />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-stone-600">
            LinkedIn text <span className="font-normal text-stone-400">(optional — paste profile content if auto-retrieval is unavailable)</span>
          </label>
          <textarea rows={3} className={inputCls} value={form.linkedin_text} onChange={set("linkedin_text")} placeholder="Past experience, about section…" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-stone-600">
            Instagram text <span className="font-normal text-stone-400">(optional — paste bio / post captions)</span>
          </label>
          <textarea rows={3} className={inputCls} value={form.instagram_text} onChange={set("instagram_text")} placeholder="Bio, interests visible in posts…" />
        </div>
        {error && (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className={btnPrimary} disabled={busy}>
            {busy ? "Adding…" : "Add participant"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Participants() {
  const [q, setQ] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const location = useLocation();
  const openedRef = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchList = useCallback(async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.participants({ q: query || undefined });
      setParticipants(r.participants);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load participants.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!openedRef.current && (location.state as { openAdd?: boolean } | null)?.openAdd) {
      openedRef.current = true;
      setModalOpen(true);
    }
  }, [location.state]);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void fetchList(q), q ? 300 : 0);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q, fetchList]);

  return (
    <div>
      <div className="animate-fade-in-up mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-ink">Participants</h1>
          <p className="mt-1 text-stone-500">
            {participants.length} on the platform — each with a LinkedIn and an Instagram source.
          </p>
        </div>
        <button onClick={() => setModalOpen(true)} className={btnPrimary}>
          + Add participant
        </button>
      </div>

      <div className="animate-fade-in-up stagger-1 mb-6">
        <input
          className={`${inputCls} max-w-md`}
          placeholder="Search by name, headline, or location…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <Spinner label="Loading participants…" />
      ) : error ? (
        <div className="rounded-2xl border border-stone-200 bg-white p-8 text-center">
          <p className="text-sm text-stone-500">{error}</p>
          <button onClick={() => void fetchList(q)} className={`${btnSecondary} mt-4`}>
            Retry
          </button>
        </div>
      ) : participants.length === 0 ? (
        <EmptyState
          title={q ? "No matches found" : "No participants yet"}
          hint={
            q
              ? "Try a different search term."
              : "Load the demo data from the dashboard or add your first participant."
          }
          action={
            !q ? (
              <button onClick={() => setModalOpen(true)} className={btnPrimary}>
                + Add participant
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((p, i) => (
            <ParticipantCard key={p.id} participant={p} index={i} />
          ))}
        </div>
      )}

      {modalOpen && (
        <AddParticipantModal
          onClose={() => setModalOpen(false)}
          onCreated={() => {
            setModalOpen(false);
            void fetchList(q);
          }}
        />
      )}
    </div>
  );
}
