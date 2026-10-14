"""API contract tests. No LLM key -> everything runs in scripted mode."""
import os

import pytest


@pytest.fixture()
def client(tmp_path):
    os.environ["DATABASE_URL"] = str(tmp_path / "t.db")
    os.environ.pop("LLM_API_KEY", None)
    from fastapi.testclient import TestClient
    import app.main as main

    with TestClient(main.app) as c:
        yield c
    os.environ.pop("DATABASE_URL", None)


def _payload(n=1, **over):
    d = {
        "name": f"Test Person {n}",
        "age": 27,
        "location": "Mumbai",
        "headline": "Engineer who loves hiking",
        "linkedin_url": f"https://linkedin.com/in/test-person-{n}",
        "instagram_url": f"https://instagram.com/test.person.{n}",
        "linkedin_text": "I love hiking and photography on weekends.",
        "instagram_text": "Weekend cooking experiments and travel photos.",
    }
    d.update(over)
    return d


def test_health_and_llm_flag(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["llm_configured"] is False
    assert body["version"] == "0.1.0"


def test_participant_url_validation(client):
    bad = _payload(1, linkedin_url="https://example.com/x")
    r = client.post("/api/participants", json=bad)
    assert r.status_code == 400 and "error" in r.json()

    bad = _payload(1, instagram_url="not-a-url")
    r = client.post("/api/participants", json=bad)
    assert r.status_code == 400 and "error" in r.json()

    bad = _payload(1, age=17)
    r = client.post("/api/participants", json=bad)
    assert r.status_code == 400 and "error" in r.json()

    ok = _payload(2)
    r = client.post("/api/participants", json=ok)
    assert r.status_code == 201
    assert r.json()["analysis_status"] == "pending"

    # duplicate linkedin_url
    dup = _payload(3, linkedin_url=ok["linkedin_url"])
    r = client.post("/api/participants", json=dup)
    assert r.status_code == 400 and "error" in r.json()

    # cross-column duplicate: new instagram_url == existing linkedin_url
    dup2 = _payload(4, instagram_url=ok["linkedin_url"])
    r = client.post("/api/participants", json=dup2)
    assert r.status_code == 400 and "error" in r.json()

    # duplicate instagram_url
    dup3 = _payload(5, instagram_url=ok["instagram_url"])
    r = client.post("/api/participants", json=dup3)
    assert r.status_code == 400 and "error" in r.json()


def test_search_and_synthetic_filter(client):
    client.post("/api/seed")
    r = client.get("/api/participants", params={"q": "Mumbai"}).json()["participants"]
    assert r and all("mumbai" in p["location"].lower() for p in r)
    r = client.get("/api/participants", params={"q": "zzz-no-match"}).json()["participants"]
    assert r == []
    r = client.get("/api/participants", params={"synthetic": "true"}).json()["participants"]
    assert len(r) == 25
    r = client.get("/api/participants", params={"synthetic": "false"}).json()["participants"]
    assert r == []


def test_seed_idempotent(client):
    b1 = client.post("/api/seed").json()
    assert b1["seeded"] is True and b1["participants"] == 25
    b2 = client.post("/api/seed").json()
    assert b2["seeded"] is False and b2["reason"] == "already seeded"
    assert client.get("/api/participants").json()["participants"].__len__() == 25
    b3 = client.post("/api/seed", params={"force": "true"}).json()
    assert b3["seeded"] is True and b3["participants"] == 25


def test_analyze_endpoint(client):
    pid = client.post("/api/participants", json=_payload(11)).json()["id"]
    r = client.post(f"/api/participants/{pid}/analyze")
    assert r.status_code == 200
    a = r.json()["analysis"]
    assert a["analyzer"] == "scripted"
    assert a["participant_id"] == pid
    assert "hiking" in a["interests"]  # extracted from linkedin_text
    g = client.get(f"/api/participants/{pid}").json()
    assert g["participant"]["analysis_status"] == "ready"
    assert g["analysis"]["participant_id"] == pid
    assert g["ranking_count"] == 0


def test_date_flow_scripted(client):
    client.post("/api/seed")
    ps = client.get("/api/participants").json()["participants"]
    a, b = ps[0]["id"], ps[1]["id"]

    r = client.post("/api/dates", json={"participant_a_id": a, "participant_b_id": b})
    assert r.status_code == 201
    d = r.json()
    assert d["mode"] == "scripted_demo"
    assert d["status"] == "completed"
    assert 6 <= len(d["transcript"]) <= 8
    speakers = [m["speaker"] for m in d["transcript"]]
    assert speakers == ["a", "b"] * (len(speakers) // 2)
    assert d["eval_a"]["score"] > 0 and d["eval_b"]["score"] > 0
    assert d["decision"] and d["decision_explanation"]

    # transcript persists
    r2 = client.get(f"/api/dates/{d['id']}")
    assert r2.status_code == 200
    assert r2.json()["transcript"] == d["transcript"]

    # participant detail includes the date
    g = client.get(f"/api/participants/{a}").json()
    assert any(x["id"] == d["id"] for x in g["dates"])

    # same-participant date rejected
    r3 = client.post("/api/dates", json={"participant_a_id": a, "participant_b_id": a})
    assert r3.status_code == 400


def test_date_auto_analysis(client):
    # fresh participants with no analysis -> date creation auto-runs scripted analysis
    p1 = client.post("/api/participants", json=_payload(21)).json()
    p2 = client.post("/api/participants", json=_payload(22)).json()
    r = client.post(
        "/api/dates",
        json={"participant_a_id": p1["id"], "participant_b_id": p2["id"]},
    )
    assert r.status_code == 201
    assert r.json()["mode"] == "scripted_demo"
    assert client.get(f"/api/participants/{p1['id']}").json()["analysis"] is not None


def test_rankings_directional(client):
    from app.agents import MatchRanker

    client.post("/api/seed")
    ps = client.get("/api/participants").json()["participants"]
    a, b = ps[0]["id"], ps[1]["id"]

    ra = client.get(f"/api/rankings/{a}").json()["rankings"]
    rb = client.get(f"/api/rankings/{b}").json()["rankings"]
    assert len(ra) == 24 and len(rb) == 24
    assert [e["rank"] for e in ra] == list(range(1, 25))
    ea = next(e for e in ra if e["candidate_id"] == b)
    eb = next(e for e in rb if e["candidate_id"] == a)
    assert 0 <= ea["score"] <= 100 and 0 <= eb["score"] <= 100
    assert ea["reasons"] and ea["confidence"] in ("high", "medium", "low")

    # unit-level: asymmetric priorities/evidence => different directional scores
    ana_a = {
        "participant_id": a, "interests": ["reading"], "traits": [],
        "preferences": {"looking_for": "", "dealbreakers": []},
        "evidence": [], "priorities": ["hiking"],
        "location": "Mumbai", "age": 27,
    }
    ana_b = {
        "participant_id": b, "interests": ["hiking", "cooking"], "traits": [],
        "preferences": {"looking_for": "", "dealbreakers": []},
        "evidence": [
            {"claim": "x", "source": "linkedin", "quote": "hiking", "confidence": "high"}
        ] * 3,
        "priorities": ["gaming"], "location": "Delhi", "age": 30,
    }
    sa, _, _, _ = MatchRanker.score(ana_a, ana_b)
    sb, _, _, _ = MatchRanker.score(ana_b, ana_a)
    assert sa != sb  # 21.0 vs 10.0 by construction


def test_delete_cascades(client):
    p1 = client.post("/api/participants", json=_payload(31)).json()
    p2 = client.post("/api/participants", json=_payload(32)).json()
    client.post(f"/api/participants/{p1['id']}/analyze")
    d = client.post(
        "/api/dates",
        json={"participant_a_id": p1["id"], "participant_b_id": p2["id"]},
    ).json()
    rk = client.get(f"/api/rankings/{p1['id']}").json()["rankings"]
    assert len(rk) == 1

    assert client.delete(f"/api/participants/{p1['id']}").status_code == 204
    assert client.get(f"/api/participants/{p1['id']}").status_code == 404
    assert client.get(f"/api/dates/{d['id']}").status_code == 404
    assert client.get(f"/api/rankings/{p1['id']}").status_code == 404
    # p2's rankings no longer reference p1
    r2 = client.get(f"/api/rankings/{p2['id']}").json()["rankings"]
    assert all(e["candidate_id"] != p1["id"] for e in r2)


def test_dashboard(client):
    client.post("/api/seed")
    d = client.get("/api/dashboard").json()
    assert d["participant_count"] == 25
    assert d["analyses_completed"] == 25
    assert d["dates_completed"] == 10
    assert d["rankings_completed"] == 25
    assert len(d["recent_interactions"]) == 5
    ri = d["recent_interactions"][0]
    assert {"date_id", "a_name", "b_name", "created_at", "decision"} <= set(ri.keys())


def test_recompute_rankings(client):
    client.post("/api/seed")
    r = client.post("/api/rankings/recompute").json()
    assert r["recomputed"] == 25
