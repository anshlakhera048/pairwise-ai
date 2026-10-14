"""Pairwise AI backend — FastAPI app. Base path /api, all JSON."""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager

from . import db, llm, seed as seed_mod
from .agents import DateOrchestrator, ProfileAgent, compute_rankings_for, enrich
from .models import DateCreate, ParticipantCreate

LINKEDIN_RE = re.compile(r"^https?://(www\.)?linkedin\.com/in/[^/]+/?$")
INSTAGRAM_RE = re.compile(r"^https?://(www\.)?instagram\.com/[A-Za-z0-9_.]+/?$")

@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="Pairwise AI", version="0.1.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _err(message: str, code: int = 400) -> JSONResponse:
    return JSONResponse(status_code=code, content={"error": message})


_PUB_FIELDS = (
    "id", "name", "age", "location", "headline", "linkedin_url",
    "instagram_url", "photo_url", "is_synthetic", "analysis_status", "created_at",
)


def _public_participant(p: dict) -> dict:
    return {k: p.get(k) for k in _PUB_FIELDS}


def _ensure_analysis(pid: str) -> dict:
    existing = db.get_analysis(pid)
    if existing:
        return existing
    p = db.get_participant(pid)
    analysis = ProfileAgent.analyze_scripted(
        p, p.get("linkedin_text", ""), p.get("instagram_text", "")
    )
    db.upsert_analysis(pid, analysis)
    db.update_analysis_status(pid, "ready")
    return analysis


# ---------------------------------------------------------------- health
@app.get("/api/health")
def health() -> dict:
    return {"status": "ok", "llm_configured": llm.configured(), "version": "0.1.0"}


# ---------------------------------------------------------------- participants
@app.get("/api/participants")
def list_participants(q: str | None = None, synthetic: str | None = None) -> dict:
    synth: bool | None = None
    if synthetic is not None:
        s = synthetic.lower()
        if s in ("true", "1", "yes"):
            synth = True
        elif s in ("false", "0", "no"):
            synth = False
    parts = db.list_participants(q=q, synthetic=synth)
    return {"participants": [_public_participant(p) for p in parts]}


@app.post("/api/participants", status_code=201)
def create_participant(body: ParticipantCreate):
    if not (18 <= body.age <= 100):
        return _err("age must be between 18 and 100")
    if not LINKEDIN_RE.match(body.linkedin_url):
        return _err("linkedin_url must look like https://linkedin.com/in/username")
    if not INSTAGRAM_RE.match(body.instagram_url):
        return _err("instagram_url must look like https://instagram.com/username")
    for url in (body.linkedin_url, body.instagram_url):
        if db.find_participant_by_url(url):
            return _err(f"URL already registered: {url}")
    p = {
        "id": uuid.uuid4().hex,
        "name": body.name,
        "age": body.age,
        "location": body.location,
        "headline": body.headline,
        "linkedin_url": body.linkedin_url,
        "instagram_url": body.instagram_url,
        "linkedin_text": body.linkedin_text,
        "instagram_text": body.instagram_text,
        "photo_url": None,
        "is_synthetic": False,
        "analysis_status": "pending",
        "created_at": _now(),
    }
    db.insert_participant(p)
    return _public_participant(p)


@app.get("/api/participants/{pid}")
def get_participant(pid: str) -> dict:
    p = db.get_participant(pid)
    if not p:
        raise HTTPException(404, "participant not found")
    return {
        "participant": _public_participant(p),
        "analysis": db.get_analysis(pid),
        "dates": db.dates_for_participant(pid),
        "ranking_count": db.count_rankings_for(pid),
    }


@app.delete("/api/participants/{pid}", status_code=204)
def delete_participant(pid: str):
    if not db.get_participant(pid):
        raise HTTPException(404, "participant not found")
    db.delete_participant(pid)
    return None


@app.post("/api/participants/{pid}/analyze")
def analyze_participant(pid: str) -> dict:
    p = db.get_participant(pid)
    if not p:
        raise HTTPException(404, "participant not found")
    # LLM when configured AND source text exists; otherwise deterministic
    # scripted extraction. Always succeeds — analyzer reflects the method.
    analysis = ProfileAgent.analyze(
        p, p.get("linkedin_text", ""), p.get("instagram_text", ""), prefer_llm=True
    )
    db.upsert_analysis(pid, analysis)
    db.update_analysis_status(pid, "ready")
    return {"analysis": analysis}


# ---------------------------------------------------------------- dates
@app.get("/api/dates")
def list_dates() -> dict:
    return {"dates": db.list_dates()}


@app.post("/api/dates", status_code=201)
def create_date(body: DateCreate):
    a = db.get_participant(body.participant_a_id)
    b = db.get_participant(body.participant_b_id)
    if not a or not b:
        raise HTTPException(404, "participant not found")
    if body.participant_a_id == body.participant_b_id:
        return _err("a date needs two different participants")
    aa = enrich(_ensure_analysis(a["id"]), a)
    ab = enrich(_ensure_analysis(b["id"]), b)
    mode = "live_llm" if llm.configured() else "scripted_demo"
    date = DateOrchestrator.run(a, b, aa, ab, mode=mode)
    return date


@app.get("/api/dates/{did}")
def get_date(did: str) -> dict:
    d = db.get_date(did)
    if not d:
        raise HTTPException(404, "date not found")
    return d


# ---------------------------------------------------------------- rankings
@app.get("/api/rankings/{pid}")
def get_rankings(pid: str) -> dict:
    if not db.get_participant(pid):
        raise HTTPException(404, "participant not found")
    entries = db.get_rankings(pid)
    if not entries:
        entries = compute_rankings_for(pid)
    return {"rankings": entries}


@app.post("/api/rankings/recompute")
def recompute_rankings() -> dict:
    n = 0
    for p in db.list_participants():
        compute_rankings_for(p["id"])
        n += 1
    return {"recomputed": n}


# ---------------------------------------------------------------- dashboard
@app.get("/api/dashboard")
def dashboard() -> dict:
    recent = []
    for d in db.list_dates()[:5]:
        a = db.get_participant(d["participant_a_id"])
        b = db.get_participant(d["participant_b_id"])
        recent.append(
            {
                "date_id": d["id"],
                "a_name": a["name"] if a else "?",
                "b_name": b["name"] if b else "?",
                "created_at": d.get("created_at", ""),
                "decision": d.get("decision", ""),
            }
        )
    return {
        "participant_count": db.count_participants(),
        "analyses_completed": db.count_analyses(),
        "dates_completed": db.count_dates(),
        "rankings_completed": db.count_participants_with_rankings(),
        "recent_interactions": recent,
    }


# ---------------------------------------------------------------- seed
@app.post("/api/seed")
def seed(force: bool = False) -> dict:
    if db.count_participants() > 0 and not force:
        return {"seeded": False, "reason": "already seeded"}
    return seed_mod.seed_all(force=force)
