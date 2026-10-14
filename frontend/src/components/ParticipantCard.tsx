import { useState } from "react";
import { Link } from "react-router-dom";
import type { Participant } from "../types";
import { StatusBadge } from "./ui";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LinkedinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-label="LinkedIn">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.12 20.45H3.56V9h3.56v11.45z" />
    </svg>
  );
}

export function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4" aria-label="Instagram">
      <path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.72 3.72 0 0 1-1.38-.9 3.72 3.72 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41 1.27-.06 1.65-.07 4.85-.07M12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.13 1.38A5.88 5.88 0 0 0 .63 4.14C.33 4.9.13 5.78.07 7.05.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.13.67.66 1.34 1.08 2.13 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.88 5.88 0 0 0 2.13-1.38 5.88 5.88 0 0 0 1.38-2.13c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.88 5.88 0 0 0-1.38-2.13A5.88 5.88 0 0 0 19.86.63C19.1.33 18.22.13 16.95.07 15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.15A4 4 0 1 1 16 12a4 4 0 0 1-4 3.99zm7.85-10.4a1.44 1.44 0 1 1-2.88 0 1.44 1.44 0 0 1 2.88 0z" />
    </svg>
  );
}

export function ParticipantCard({
  participant,
  index = 0,
}: {
  participant: Participant;
  index?: number;
}) {
  const [imgOk, setImgOk] = useState(true);
  const p = participant;
  return (
    <Link
      to={`/participants/${p.id}`}
      className={`animate-fade-in-up stagger-${Math.min((index % 6) + 1, 6)} group block rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_2px_12px_rgba(28,25,23,0.05)] transition hover:-translate-y-1 hover:shadow-[0_10px_28px_rgba(190,74,107,0.12)]`}
    >
      <div className="flex items-start gap-4">
        {p.photo_url && imgOk ? (
          <img
            src={p.photo_url}
            alt={p.name}
            className="h-14 w-14 shrink-0 rounded-full border border-stone-200 object-cover"
            onError={() => setImgOk(false)}
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-soft font-display text-lg text-rose-deep">
            {initials(p.name)}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-display text-lg text-ink group-hover:text-rose-deep">
              {p.name}, {p.age}
            </h3>
            {p.is_synthetic && (
              <span className="shrink-0 rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-stone-500">
                demo
              </span>
            )}
          </div>
          <p className="truncate text-sm text-stone-500">{p.location}</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-stone-600">
        {p.headline}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href={p.linkedin_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-stone-200 p-2 text-stone-500 transition hover:border-sky-300 hover:text-sky-600"
            aria-label={`${p.name} on LinkedIn`}
          >
            <LinkedinIcon />
          </a>
          <a
            href={p.instagram_url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="rounded-full border border-stone-200 p-2 text-stone-500 transition hover:border-rose hover:text-rose"
            aria-label={`${p.name} on Instagram`}
          >
            <InstagramIcon />
          </a>
        </div>
        <StatusBadge status={p.analysis_status} />
      </div>
    </Link>
  );
}
