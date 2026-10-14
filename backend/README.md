# Pairwise AI — Backend

FastAPI backend for the Pairwise AI agentic dating platform.

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional; add LLM_API_KEY for live AI mode
uvicorn app.main:app --reload
```

API base: `http://127.0.0.1:8000/api` (docs at `/docs`).

## Quick demo

```bash
curl -X POST http://127.0.0.1:8000/api/seed
```

Seeds 25 synthetic participants, scripted analyses, 10 scripted agent dates,
and rankings for all 25.

## Environment

| Var | Default | Purpose |
|---|---|---|
| `LLM_API_BASE` | `https://api.openai.com/v1` | OpenAI-compatible chat completions endpoint |
| `LLM_API_KEY` | (empty) | Empty = unconfigured; app runs in labeled scripted-demo mode |
| `LLM_MODEL` | `gpt-4o-mini` | Model for analysis + agent turns/evals |
| `DATABASE_URL` | `backend/pairwise.db` | SQLite file (`sqlite:///...` or plain path) |

## Tests

```bash
pytest -q
```

## Architecture

- `app/main.py` — FastAPI routes (`/api/*`), CORS `*`, startup DB init
- `app/models.py` — Pydantic v2 schemas (Participant, Analysis, Date, RankingEntry, Dashboard)
- `app/db.py` — SQLite via stdlib `sqlite3`; JSON columns as TEXT
- `app/llm.py` — OpenAI-compatible client (`LLMNotConfigured` / `LLMError`, 60s timeout)
- `app/agents.py` — `ProfileAgent`, `DatingAgent`, `DateOrchestrator`, `MatchRanker`
- `app/seed.py` — 25 synthetic demo participants (example.com URLs only)

## MatchRanker scoring (directional, 0–100)

From A's perspective over candidate B:

- shared-interest Jaccard × 40
- +15 same location
- +10 age difference ≤ 5
- +up to 10 preference keyword hits (A's `looking_for` words found in B's profile)
- +up to 10 evidence quality (`min(#high-confidence evidence in B, 5) × 2`)
- +up to 10 directional priority bonus (+5 per A-priority keyword found in B)
- date boost in [−15, +15]: `(A's eval score − 50) / 50 × 15` when a date exists

Scores are estimates, not guarantees. `score(A,B)` ≠ `score(B,A)` in general
because each direction uses that side's priorities, preferences, and date evaluation.

## Modes & honesty rules

- Without `LLM_API_KEY`: profile analysis uses deterministic scripted extraction
  (`analyzer="scripted"`) and dates run template-based multi-turn conversations
  (`mode="scripted_demo"`). Both are real persisted artifacts, explicitly labeled.
- With a key: LLM generates analyses, date turns, and evaluations; any LLM
  failure degrades gracefully to scripted mode rather than failing the request.
- Scripted output is never presented as live AI output.
- Seed data uses `https://example.com/...` URLs and `is_synthetic=true` —
  never presented as real people.
