"""SQLite persistence via stdlib sqlite3. JSON columns stored as TEXT."""
from __future__ import annotations

import json
import os
import sqlite3
import threading
from pathlib import Path

_lock = threading.Lock()
_conn: sqlite3.Connection | None = None
_conn_path: str | None = None


def db_path() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if url:
        if url.startswith("sqlite:///"):
            return url[len("sqlite:///"):]
        return url
    return str(Path(__file__).resolve().parent.parent / "pairwise.db")


def get_conn() -> sqlite3.Connection:
    global _conn, _conn_path
    p = db_path()
    with _lock:
        if _conn is None or _conn_path != p:
            if _conn is not None:
                _conn.close()
            Path(p).parent.mkdir(parents=True, exist_ok=True)
            _conn = sqlite3.connect(p, check_same_thread=False)
            _conn.row_factory = sqlite3.Row
            _conn.execute("PRAGMA journal_mode=WAL")
            _conn_path = p
        return _conn


def init_db() -> None:
    c = get_conn()
    c.executescript(
        """
        CREATE TABLE IF NOT EXISTS participants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            age INTEGER NOT NULL,
            location TEXT NOT NULL,
            headline TEXT NOT NULL DEFAULT '',
            linkedin_url TEXT NOT NULL,
            instagram_url TEXT NOT NULL,
            linkedin_text TEXT NOT NULL DEFAULT '',
            instagram_text TEXT NOT NULL DEFAULT '',
            photo_url TEXT,
            is_synthetic INTEGER NOT NULL DEFAULT 0,
            analysis_status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS analyses (
            participant_id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS dates (
            id TEXT PRIMARY KEY,
            data TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS rankings (
            participant_id TEXT NOT NULL,
            candidate_id TEXT NOT NULL,
            data TEXT NOT NULL,
            PRIMARY KEY (participant_id, candidate_id)
        );
        """
    )
    c.commit()


def clear_all() -> None:
    c = get_conn()
    c.execute("DELETE FROM rankings")
    c.execute("DELETE FROM dates")
    c.execute("DELETE FROM analyses")
    c.execute("DELETE FROM participants")
    c.commit()


# ---- participants ----
_PART_COLS = (
    "id,name,age,location,headline,linkedin_url,instagram_url,"
    "linkedin_text,instagram_text,photo_url,is_synthetic,analysis_status,created_at"
)


def _row_to_participant(r: sqlite3.Row) -> dict:
    d = dict(r)
    d["is_synthetic"] = bool(d["is_synthetic"])
    return d


def insert_participant(p: dict) -> None:
    c = get_conn()
    c.execute(
        "INSERT INTO participants (id,name,age,location,headline,linkedin_url,instagram_url,"
        "linkedin_text,instagram_text,photo_url,is_synthetic,analysis_status,created_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
        (
            p["id"], p["name"], p["age"], p["location"], p.get("headline", ""),
            p["linkedin_url"], p["instagram_url"],
            p.get("linkedin_text", ""), p.get("instagram_text", ""),
            p.get("photo_url"), 1 if p.get("is_synthetic") else 0,
            p.get("analysis_status", "pending"), p["created_at"],
        ),
    )
    c.commit()


def get_participant(pid: str) -> dict | None:
    r = get_conn().execute(
        f"SELECT {_PART_COLS} FROM participants WHERE id=?", (pid,)
    ).fetchone()
    return _row_to_participant(r) if r else None


def list_participants(q: str | None = None, synthetic: bool | None = None) -> list[dict]:
    sql = f"SELECT {_PART_COLS} FROM participants"
    clauses, params = [], []
    if q:
        clauses.append("(name LIKE ? OR location LIKE ? OR headline LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]
    if synthetic is not None:
        clauses.append("is_synthetic=?")
        params.append(1 if synthetic else 0)
    if clauses:
        sql += " WHERE " + " AND ".join(clauses)
    sql += " ORDER BY created_at DESC"
    rows = get_conn().execute(sql, params).fetchall()
    return [_row_to_participant(r) for r in rows]


def find_participant_by_url(url: str) -> dict | None:
    r = get_conn().execute(
        f"SELECT {_PART_COLS} FROM participants WHERE linkedin_url=? OR instagram_url=?",
        (url, url),
    ).fetchone()
    return _row_to_participant(r) if r else None


def update_analysis_status(pid: str, status: str) -> None:
    c = get_conn()
    c.execute("UPDATE participants SET analysis_status=? WHERE id=?", (status, pid))
    c.commit()


def delete_participant(pid: str) -> None:
    c = get_conn()
    c.execute("DELETE FROM rankings WHERE participant_id=? OR candidate_id=?", (pid, pid))
    for row in c.execute(
        "SELECT id, data FROM dates"
    ).fetchall():
        d = json.loads(row["data"])
        if d.get("participant_a_id") == pid or d.get("participant_b_id") == pid:
            c.execute("DELETE FROM dates WHERE id=?", (row["id"],))
    c.execute("DELETE FROM analyses WHERE participant_id=?", (pid,))
    c.execute("DELETE FROM participants WHERE id=?", (pid,))
    c.commit()


def count_participants() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM participants").fetchone()[0]


# ---- analyses ----
def upsert_analysis(pid: str, data: dict) -> None:
    c = get_conn()
    c.execute(
        "INSERT INTO analyses (participant_id, data) VALUES (?, ?)"
        " ON CONFLICT(participant_id) DO UPDATE SET data=excluded.data",
        (pid, json.dumps(data)),
    )
    c.commit()


def get_analysis(pid: str) -> dict | None:
    r = get_conn().execute(
        "SELECT data FROM analyses WHERE participant_id=?", (pid,)
    ).fetchone()
    return json.loads(r["data"]) if r else None


def count_analyses() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM analyses").fetchone()[0]


# ---- dates ----
def insert_date(d: dict) -> None:
    c = get_conn()
    c.execute("INSERT INTO dates (id, data) VALUES (?, ?)", (d["id"], json.dumps(d)))
    c.commit()


def get_date(did: str) -> dict | None:
    r = get_conn().execute("SELECT data FROM dates WHERE id=?", (did,)).fetchone()
    return json.loads(r["data"]) if r else None


def list_dates() -> list[dict]:
    rows = get_conn().execute("SELECT data FROM dates").fetchall()
    dates = [json.loads(r["data"]) for r in rows]
    dates.sort(key=lambda d: d.get("created_at", ""), reverse=True)
    return dates


def dates_for_participant(pid: str) -> list[dict]:
    out = []
    for d in list_dates():
        if d.get("participant_a_id") == pid or d.get("participant_b_id") == pid:
            out.append(d)
    return out


def find_date_between(a: str, b: str) -> dict | None:
    for d in list_dates():
        pair = {d.get("participant_a_id"), d.get("participant_b_id")}
        if pair == {a, b}:
            return d
    return None


def count_dates() -> int:
    return get_conn().execute("SELECT COUNT(*) FROM dates").fetchone()[0]


# ---- rankings ----
def upsert_ranking(entry: dict) -> None:
    c = get_conn()
    c.execute(
        "INSERT INTO rankings (participant_id, candidate_id, data) VALUES (?, ?, ?)"
        " ON CONFLICT(participant_id, candidate_id) DO UPDATE SET data=excluded.data",
        (entry["participant_id"], entry["candidate_id"], json.dumps(entry)),
    )
    c.commit()


def get_rankings(pid: str) -> list[dict]:
    rows = get_conn().execute(
        "SELECT data FROM rankings WHERE participant_id=?", (pid,)
    ).fetchall()
    entries = [json.loads(r["data"]) for r in rows]
    entries.sort(key=lambda e: e.get("rank", 0))
    return entries


def count_rankings_for(pid: str) -> int:
    return get_conn().execute(
        "SELECT COUNT(*) FROM rankings WHERE participant_id=?", (pid,)
    ).fetchone()[0]


def count_participants_with_rankings() -> int:
    return get_conn().execute(
        "SELECT COUNT(DISTINCT participant_id) FROM rankings"
    ).fetchone()[0]
