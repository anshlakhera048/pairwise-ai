# Pairwise AI — Agentic Dating Platform

An end-to-end demo of **AI agents that date each other**: each participant gets a
`ProfileAgent` (structured, evidence-grounded profile analysis), a `DatingAgent`
that holds real multi-turn dating conversations with other agents, a
`DateOrchestrator` that runs and persists those dates, and a `MatchRanker` that
produces **directional, explainable** match rankings for every participant.

> **Demo data honesty.** The one-click demo seeds **25 clearly-labeled synthetic
> participants** (all source URLs point at `example.com` placeholders — never
> real LinkedIn/Instagram profiles). They are not real people. The app fully
> supports adding real, consenting participants via the UI.

## Architecture

```
pairwise-ai/
├── backend/            # Python + FastAPI + Pydantic + SQLite (stdlib)
│   ├── app/main.py     # 14 REST endpoints, CORS, startup DB init
│   ├── app/models.py   # Pydantic v2 schemas (Participant, Analysis, Date, …)
│   ├── app/db.py       # sqlite3 persistence, JSON-as-TEXT columns
│   ├── app/llm.py      # OpenAI-compatible chat client (env-configured)
│   ├── app/agents.py   # ProfileAgent · DatingAgent · DateOrchestrator · MatchRanker
│   ├── app/seed.py     # 25 synthetic participants + 10 scripted dates + rankings
│   └── tests/          # pytest suite (11 tests)
└── frontend/           # React 19 + Vite + TypeScript + Tailwind + react-router-dom
    └── src/pages/      # Dashboard · Participants · ParticipantDetail · Arena · Rankings
```

**AI architecture.** `ProfileAgent` extracts structured profiles (traits, interests,
preferences, evidence-with-confidence, unknowns, priorities) from the two
authorized sources. `DatingAgent` holds a multi-turn conversation grounded in its
participant's analysis (system prompt built from it), asks compatibility
questions, and writes an **independent** post-date evaluation. `DateOrchestrator`
runs bounded (≤8 turn) dates and persists transcripts + evaluations. `MatchRanker`
combines shared interests, lifestyle fit, preference hits, evidence quality, and
real date outcomes into directional scores (A→B ≠ B→A), each with reasons,
conflicts, and a confidence label.

**Live vs demo mode.** Set `LLM_API_KEY` (OpenAI-compatible endpoint) and dates
run on the real LLM. Without a key the app stays fully usable: dates run in
explicitly labeled **scripted demo mode** (`mode: "scripted_demo"`, badged in the
UI) — never silently presented as AI output.

## Quickstart

**Backend**
```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python -m pytest -q            # 11 tests
.venv/bin/uvicorn app.main:app --reload  # API at http://127.0.0.1:8000
curl -X POST http://127.0.0.1:8000/api/seed   # one-click demo data
```

**Frontend**
```bash
cd frontend
npm install
npm run dev      # http://localhost:5173 (proxies VITE_API_URL, default http://localhost:8000)
npm run build    # production build
```

**Environment** (see `.env.example`)
| Variable | Purpose | Default |
|---|---|---|
| `LLM_API_KEY` | Enables live LLM dates/analysis | _(unset → scripted demo mode)_ |
| `LLM_API_BASE` | OpenAI-compatible base URL | `https://api.openai.com/v1` |
| `LLM_MODEL` | Model name | `gpt-4o-mini` |
| `DATABASE_URL` | SQLite path override | `backend/pairwise.db` |
| `VITE_API_URL` | Frontend → backend URL | `http://localhost:8000` |

## Scoring model (MatchRanker)

Scores are 0–100 **estimates**, labeled as such in the UI — not guarantees of
romantic compatibility.

```
score = 40 * jaccard(shared interests)
      + 15 * same_city
      + 10 * age_diff <= 5
      + 10 * preference keyword hits
      + 10 * evidence quality (high-confidence evidence, capped)
      + up to ±15 from completed date evaluations
      + priority weighting: candidate traits matching the *ranker's*
        stated priorities get a directional bonus (this is what makes
        A→B differ from B→A)
```
Every ranking ships with `reasons[]`, `conflicts[]`, a `confidence` label, and a
`based_on_date_id` when a real date informed it.

## Data access — what was actually implemented

LinkedIn and Instagram block unauthenticated automated scraping (login walls,
anti-bot challenges), so **no automatic retrieval is implemented and none is
claimed**. Adding a participant requires their LinkedIn/Instagram URLs (format-
validated, duplicate-checked) plus **user-pasted profile text** per source; each
source row records its `retrieval_method` (`user_pasted`, `manual`, `pending`),
and the UI states the method transparently. The demo's 25 participants use
`example.com` placeholder URLs and fixture text, badged synthetic throughout.

## Limitations (stated plainly)

- No real LinkedIn/Instagram scraping — platform restrictions; see above.
- No LLM API key was available during development: the LLM path is
  code-complete but untested against a live endpoint; scripted paths are tested.
- Demo participants are synthetic fixtures, clearly labeled — not real people.
- Not deployed (no deployment credentials available); local run only.
- `.env` secrets are never committed (see `.gitignore`).

## 3-minute demo script

- **0:00–0:25** — Dashboard: 25 participants, analyses/dates/rankings counts from
  persisted data; banner notes synthetic demo data.
- **0:25–0:55** — Open a participant: LinkedIn/Instagram links, evidence list
  with source + confidence, unknowns, agent priorities.
- **0:55–2:05** — Arena: pick a completed date; walk the 8-turn transcript
  (questions, trade-offs), both independent evaluations, final decision.
- **2:05–2:40** — Rankings: pick the participant, show directional scores with
  reasons/conflicts and "based on actual date" badges.
- **2:40–3:00** — Add-participant form (URL validation), "Load demo data",
  then show this repo + README.
