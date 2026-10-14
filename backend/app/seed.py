"""Demo seeding: 25 synthetic participants + scripted analyses + 10 dates + rankings.

All URLs use https://example.com/... — obviously synthetic. Never fabricate
real LinkedIn/Instagram profile URLs.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from . import db
from .agents import DateOrchestrator, ProfileAgent, compute_rankings_for


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# (name, age, location, profession, interests[3-5])
PEOPLE: list[tuple[str, int, str, str, list[str]]] = [
    ("Aarav Mehta", 27, "Mumbai", "Product designer", ["hiking", "photography", "travel"]),
    ("Priya Sharma", 25, "Bengaluru", "Data scientist", ["reading", "yoga", "cooking"]),
    ("Rohan Iyer", 29, "Delhi", "Chef", ["cooking", "travel", "music"]),
    ("Ananya Rao", 26, "Pune", "Architect", ["art", "hiking", "photography"]),
    ("Vikram Singh", 31, "Hyderabad", "Product manager", ["cricket", "technology", "travel"]),
    ("Sneha Kulkarni", 24, "Mumbai", "UX researcher", ["dancing", "movies", "reading"]),
    ("Arjun Nair", 28, "Bengaluru", "Backend engineer", ["gaming", "technology", "fitness"]),
    ("Ishita Verma", 30, "Jaipur", "Doctor", ["yoga", "reading", "volunteering"]),
    ("Kabir Malhotra", 26, "Delhi", "Startup founder", ["entrepreneurship", "technology", "football"]),
    ("Meera Krishnan", 29, "Chennai", "Data analyst", ["cooking", "gardening", "music"]),
    ("Aditya Patel", 34, "Ahmedabad", "Chartered accountant", ["cricket", "movies", "travel"]),
    ("Divya Reddy", 25, "Hyderabad", "Content writer", ["writing", "photography", "travel"]),
    ("Nikhil Bose", 27, "Kolkata", "Musician", ["music", "art", "movies"]),
    ("Sara Thomas", 28, "Kochi", "Marine biologist", ["travel", "fitness", "reading"]),
    ("Rahul Gupta", 30, "Pune", "DevOps engineer", ["gaming", "technology", "hiking"]),
    ("Emily Carter", 26, "New York", "Marketing manager", ["fashion", "travel", "photography"]),
    ("James Whitfield", 33, "London", "Architect", ["art", "football", "cooking"]),
    ("Sofia Rossi", 25, "London", "Fashion buyer", ["fashion", "travel", "art"]),
    ("Liam O'Connor", 29, "New York", "Chef", ["cooking", "music", "fitness"]),
    ("Aisha Khan", 27, "Delhi", "Lawyer", ["reading", "yoga", "movies"]),
    ("Karan Ahuja", 34, "Mumbai", "Investment banker", ["football", "travel", "cooking"]),
    ("Tanvi Desai", 24, "Pune", "Graphic designer", ["art", "dancing", "photography"]),
    ("Sanjay Menon", 36, "Bengaluru", "Engineering manager", ["cricket", "reading", "technology"]),
    ("Olivia Bennett", 28, "London", "Doctor", ["yoga", "hiking", "volunteering"]),
    ("Daniel Kim", 32, "New York", "Data scientist", ["gaming", "technology", "cooking"]),
]

# 10 varied pairs (indices into PEOPLE)
DATE_PAIRS = [(0, 5), (1, 8), (2, 11), (3, 14), (4, 17), (6, 20), (7, 23), (9, 12), (10, 19), (13, 22)]


def _linkedin_text(name: str, age: int, location: str, profession: str, interests: list[str]) -> str:
    years = max(1, age - 22)
    return (
        f"{name} — {profession} based in {location} with {years} years of experience. "
        f"Passionate about {', '.join(interests)}. "
        f"Weekend {interests[0]} enthusiast; also enjoys {interests[1]} with friends. "
        f"Recently completed a certification related to {interests[-1]}."
    )


def _instagram_text(name: str, location: str, profession: str, interests: list[str]) -> str:
    first = name.split()[0]
    return (
        f"Public Instagram of {first}: mostly {interests[0]} and {interests[1]} content. "
        f"Recent posts about {interests[-1]} adventures and {interests[1]} experiments. "
        f"Bio: '{location} | {interests[0]} lover | {profession}'."
    )


def seed_all(force: bool = False) -> dict:
    db.init_db()
    if force:
        db.clear_all()
    participants: list[dict] = []
    for i, (name, age, location, profession, interests) in enumerate(PEOPLE, start=1):
        p = {
            "id": uuid.uuid4().hex,
            "name": name,
            "age": age,
            "location": location,
            "headline": f"{profession.title()} | {interests[0].title()} enthusiast",
            "linkedin_url": f"https://example.com/linkedin/demo-{i}",
            "instagram_url": f"https://example.com/instagram/demo-{i}",
            "linkedin_text": _linkedin_text(name, age, location, profession, interests),
            "instagram_text": _instagram_text(name, location, profession, interests),
            "photo_url": None,
            "is_synthetic": True,
            "analysis_status": "pending",
            "created_at": _now(),
        }
        db.insert_participant(p)
        analysis = ProfileAgent.analyze_scripted(p, p["linkedin_text"], p["instagram_text"])
        db.upsert_analysis(p["id"], analysis)
        db.update_analysis_status(p["id"], "ready")
        participants.append(p)

    n_dates = 0
    for ia, ib in DATE_PAIRS:
        a, b = participants[ia], participants[ib]
        aa = db.get_analysis(a["id"])
        ab = db.get_analysis(b["id"])
        DateOrchestrator.run(a, b, aa, ab, mode="scripted_demo")
        n_dates += 1

    for p in participants:
        compute_rankings_for(p["id"])

    return {"seeded": True, "participants": len(participants), "dates": n_dates}
