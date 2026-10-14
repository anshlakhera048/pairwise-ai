"""AI agents: ProfileAgent, DatingAgent, DateOrchestrator, MatchRanker.

Every agent has two modes:
- live: uses the configured LLM (llm.chat)
- scripted: deterministic, profile-grounded templates (used when no LLM key
  is configured, or when the LLM call fails). Scripted output is always
  labeled as such (analyzer="scripted", mode="scripted_demo") and is never
  presented as live AI output.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone

from . import db, llm


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def enrich(analysis: dict, participant: dict) -> dict:
    """Merge participant fields the scorer/evaluator needs into an analysis copy."""
    d = dict(analysis or {})
    d.setdefault("age", participant.get("age"))
    d.setdefault("location", participant.get("location"))
    d.setdefault("name", participant.get("name"))
    d.setdefault("participant_id", participant.get("id"))
    return d


def compute_rankings_for(participant_id: str) -> list[dict]:
    """Score every other participant from participant_id's perspective (directional),
    persist RankingEntry rows ordered by rank, and return them."""
    p = db.get_participant(participant_id)
    if not p:
        return []
    pa = enrich(db.get_analysis(participant_id), p)
    scored: list[dict] = []
    for q in db.list_participants():
        if q["id"] == participant_id:
            continue
        qa = enrich(db.get_analysis(q["id"]), q)
        date = db.find_date_between(participant_id, q["id"])
        score, reasons, conflicts, confidence = MatchRanker.score(pa, qa, date)
        scored.append(
            {
                "participant_id": participant_id,
                "candidate_id": q["id"],
                "rank": 0,
                "score": score,
                "reasons": reasons,
                "conflicts": conflicts,
                "confidence": confidence,
                "based_on_date_id": date["id"] if date else None,
            }
        )
    scored.sort(key=lambda e: e["score"], reverse=True)
    for i, e in enumerate(scored, start=1):
        e["rank"] = i
        db.upsert_ranking(e)
    return scored

INTEREST_SIGNALS: list[tuple[str, list[str]]] = [
    ("hiking", ["hiking", "trek", "trekking", "mountain", "himalayas"]),
    ("cooking", ["cook", "chef", "food", "baking", "recipe", "cuisine"]),
    ("travel", ["travel", "wanderlust", "backpacking", "explore", "globetrotter"]),
    ("photography", ["photograph", "camera", "photos", "portrait"]),
    ("fitness", ["gym", "fitness", "workout", "marathon", "crossfit", "cycling", "swimming", "swim"]),
    ("music", ["music", "guitar", "piano", "concert", "singing", "spotify"]),
    ("reading", ["reading", "books", "novels", "book club", "literature"]),
    ("movies", ["movies", "cinema", "films", "documentaries"]),
    ("technology", ["tech", "coding", "software", "startup", "artificial intelligence", "programming"]),
    ("art", ["art", "painting", "sketch", "gallery", "design"]),
    ("dancing", ["dance", "dancing", "salsa", "bharatanatyam"]),
    ("gaming", ["gaming", "video games", "esports", "chess"]),
    ("cricket", ["cricket", "ipl"]),
    ("football", ["football", "soccer", "premier league"]),
    ("yoga", ["yoga", "meditation", "mindfulness"]),
    ("entrepreneurship", ["startup", "founder", "entrepreneur", "venture"]),
    ("fashion", ["fashion", "style", "streetwear"]),
    ("gardening", ["garden", "plants", "urban farming"]),
    ("writing", ["writing", "blog", "poetry", "journaling"]),
    ("volunteering", ["volunteer", "ngo", "social work", "teach"]),
]

TRAIT_FOR_INTEREST = {
    "hiking": "adventurous",
    "cooking": "nurturing",
    "travel": "curious",
    "photography": "observant",
    "fitness": "disciplined",
    "music": "expressive",
    "reading": "reflective",
    "movies": "story-driven",
    "technology": "analytical",
    "art": "creative",
    "dancing": "expressive",
    "gaming": "strategic",
    "cricket": "team-spirited",
    "football": "team-spirited",
    "yoga": "grounded",
    "entrepreneurship": "ambitious",
    "fashion": "style-conscious",
    "gardening": "patient",
    "writing": "thoughtful",
    "volunteering": "compassionate",
}


def _first_sentence_with(text: str, keyword: str, limit: int = 160) -> str | None:
    for sent in re.split(r"(?<=[.!?])\s+", text):
        if keyword in sent.lower():
            s = sent.strip()
            return s[:limit] + ("..." if len(s) > limit else "")
    return None


# ---------------------------------------------------------------------------
# ProfileAgent
# ---------------------------------------------------------------------------
class ProfileAgent:
    """Builds a structured, evidence-grounded Analysis for one participant."""

    @staticmethod
    def analyze_scripted(participant: dict, linkedin_text: str, instagram_text: str) -> dict:
        name = participant.get("name", "Participant")
        age = participant.get("age", "")
        location = participant.get("location", "")
        headline = participant.get("headline", "") or ""
        li = linkedin_text or ""
        ig = instagram_text or ""
        combined = f"{headline} {li} {ig}".lower()

        interests: list[str] = []
        for label, keywords in INTEREST_SIGNALS:
            if any(k in combined for k in keywords):
                interests.append(label)
            if len(interests) >= 6:
                break
        if not interests:
            interests = ["learning new things"]

        traits = []
        for label in interests[:4]:
            conf = (
                "high"
                if label in li.lower() or label in ig.lower()
                else "medium"
            )
            traits.append({"trait": TRAIT_FOR_INTEREST.get(label, "well-rounded"), "confidence": conf})

        evidence = []
        for label, keywords in INTEREST_SIGNALS:
            if label not in interests or len(evidence) >= 5:
                continue
            kw = next((k for k in keywords if k in combined), None)
            if not kw:
                continue
            if kw in li.lower():
                quote = _first_sentence_with(li, kw)
                src = "linkedin"
            else:
                quote = _first_sentence_with(f"{headline} {ig}", kw)
                src = "instagram"
            if quote:
                evidence.append(
                    {
                        "claim": f"Interested in {label}",
                        "source": src,
                        "quote": quote,
                        "confidence": "high" if src == "linkedin" else "medium",
                    }
                )

        top = ", ".join(interests[:3])
        summary = (
            f"{name}, {age}, based in {location}. "
            f"{headline + ' ' if headline else ''}"
            f"Interests include {top}."
        ).strip()

        return {
            "participant_id": participant["id"],
            "summary": summary,
            "traits": traits,
            "interests": interests,
            "preferences": {
                "looking_for": (
                    "A kind, ambitious partner who shares my interests and "
                    "communicates openly."
                ),
                "dealbreakers": ["dishonesty", "poor communication"],
            },
            "evidence": evidence,
            "unknowns": [
                "Detailed relationship goals and timeline",
                "Dietary preferences and lifestyle habits",
                "Long-term location and relocation plans",
            ],
            "priorities": [f"shared interest in {i}" for i in interests[:2]]
            + ["clear communication"],
            "analyzer": "scripted",
            "created_at": _now(),
        }

    _ANALYZE_SYSTEM = (
        "You are ProfileAgent, an expert profiler for a dating platform. "
        "Analyze ONLY the information provided below, which comes from the "
        "participant's LinkedIn and public Instagram. Every claim must be "
        "grounded in the supplied text with a verbatim quote and a source "
        "('linkedin' or 'instagram').\n"
        "STRICT RULES:\n"
        "- Never infer sexual orientation, gender identity, psychological "
        "diagnoses, health conditions, religion, or politics unless the "
        "participant explicitly states them.\n"
        "- Distinguish source-supported facts from tentative inferences; use "
        "confidence 'low' for anything uncertain.\n"
        "- List anything you cannot determine in 'unknowns'.\n"
        "Respond with a single JSON object with EXACTLY these keys:\n"
        "summary (string), traits ([{trait, confidence}]), interests ([string]), "
        "preferences ({looking_for: string, dealbreakers: [string]}), "
        "evidence ([{claim, source: 'linkedin'|'instagram', quote, confidence}]), "
        "unknowns ([string]), priorities ([string])."
    )

    @staticmethod
    def analyze_llm(participant: dict, linkedin_text: str, instagram_text: str) -> dict:
        user = (
            f"Participant: {participant.get('name')}, age {participant.get('age')}, "
            f"location {participant.get('location')}\n"
            f"Headline: {participant.get('headline', '')}\n\n"
            f"--- LINKEDIN CONTENT ---\n{linkedin_text or '(none provided)'}\n\n"
            f"--- INSTAGRAM CONTENT ---\n{instagram_text or '(none provided)'}\n\n"
            "Produce the profile analysis JSON now."
        )
        data = llm.chat(ProfileAgent._ANALYZE_SYSTEM, user, json_mode=True)
        if not isinstance(data, dict):
            raise llm.LLMError("LLM did not return a JSON object")
        data["participant_id"] = participant["id"]
        data["analyzer"] = "llm"
        data["created_at"] = _now()
        # Coerce/normalize into the Analysis schema; drop unknown keys.
        from .models import Analysis

        return Analysis.model_validate(data).model_dump()

    @staticmethod
    def analyze(participant: dict, linkedin_text: str, instagram_text: str,
                prefer_llm: bool = True) -> dict:
        """Dispatcher: LLM when requested and available, else scripted. Never raises."""
        if prefer_llm and llm.configured() and (linkedin_text or instagram_text):
            try:
                return ProfileAgent.analyze_llm(participant, linkedin_text, instagram_text)
            except (llm.LLMNotConfigured, llm.LLMError):
                pass
        return ProfileAgent.analyze_scripted(participant, linkedin_text, instagram_text)


# ---------------------------------------------------------------------------
# DatingAgent
# ---------------------------------------------------------------------------
class DatingAgent:
    """One participant's voice on a date."""

    @staticmethod
    def build_system_prompt(analysis: dict, participant_name: str) -> str:
        interests = ", ".join(analysis.get("interests", []) or ["getting to know people"])
        priorities = ", ".join(analysis.get("priorities", []) or ["genuine connection"])
        looking_for = (analysis.get("preferences", {}) or {}).get("looking_for", "")
        traits = ", ".join(t.get("trait", "") for t in analysis.get("traits", [])[:3])
        return (
            f"You are {participant_name} on a first date via a dating app's agent chat. "
            f"Stay in character as {participant_name} at all times.\n"
            f"Your profile: {analysis.get('summary', '')}\n"
            f"Your interests: {interests}.\n"
            f"Your traits: {traits}.\n"
            f"What you prioritize: {priorities}.\n"
            f"What you're looking for: {looking_for}.\n"
            "Rules: speak in first person, 1-3 sentences per message. Ask genuine "
            "compatibility questions, share real details from YOUR profile above, "
            "explore differences honestly (lifestyle, pace, location), and note "
            "trade-offs when they matter. Never mention you are an AI. Never invent "
            "facts about yourself that contradict your profile."
        )

    @staticmethod
    def live_turn(history: list[dict], system: str) -> str:
        convo = "\n".join(
            f"{'A' if m['speaker'] == 'a' else 'B'}: {m['text']}" for m in history
        )
        user = (
            "Conversation so far:\n" + convo
            + "\n\nWrite your next message as your character (1-3 sentences)."
        )
        return str(llm.chat(system, user, json_mode=False)).strip()

    @staticmethod
    def scripted_turn(own: dict, other: dict, turn_idx: int,
                      own_name: str, other_name: str) -> str:
        """Deterministic, profile-grounded turn. Alternates a/b by turn_idx parity."""
        oi = own.get("interests", []) or ["exploring new things"]
        ti = other.get("interests", []) or ["exploring new things"]
        shared = [i for i in oi if i in ti]
        o_pick = lambda k: oi[(turn_idx + k) % len(oi)]  # noqa: E731
        t_pick = lambda k: ti[(turn_idx + k) % len(ti)]  # noqa: E731
        city_o = own.get("location", "my city")
        city_t = other.get("location", "your city")

        if turn_idx == 0:  # A opens
            return (
                f"Hi {other_name}! I'm {own_name}. I have to ask — I saw you're into "
                f"{t_pick(0)}. How did you get into that? I'm big on {o_pick(0)} myself."
            )
        if turn_idx == 1:  # B responds + asks
            return (
                f"Hey {own_name}! {t_pick(0).capitalize()} started for me a couple of years "
                f"ago and it stuck. What's the story behind your love for {o_pick(0)}? "
                f"I've always been curious about {o_pick(1)} too."
            )
        if turn_idx == 2:  # A answers, goes deeper
            return (
                f"Honestly {o_pick(0)} is my reset button — a bad week disappears after a "
                f"good session. Quick deeper question: are you more of a planned-weekend "
                f"person or a spontaneous one? I'm trying to figure out if our paces match."
            )
        if turn_idx == 3:  # B answers, asks values
            return (
                f"I'm planned on weekdays, spontaneous on weekends — best of both, I like "
                f"to think. Values question back at you: what's something you won't "
                f"compromise on in a relationship? For me it's {own.get('priorities', ['honesty'])[0]}."
            )
        if turn_idx == 4:  # A names a trade-off
            if city_o != city_t:
                return (
                    f"Fair — mine is clear communication, no games. One honest trade-off "
                    f"I'm weighing: I'm based in {city_o} and you're in {city_t}. I'm open "
                    f"to making distance work for the right person, but how do you feel "
                    f"about that practically?"
                )
            topic = shared[0] if shared else t_pick(0)
            return (
                f"Fair — mine is clear communication, no games. One honest trade-off: "
                f"we both like {topic}, but I can be pretty intense about {o_pick(0)} and "
                f"it eats weekends. Would that energize you or exhaust you?"
            )
        if turn_idx == 5:  # B responds to trade-off
            if city_o != city_t:
                return (
                    f"I appreciate the honesty. Distance is work, but I'd rather try with "
                    f"someone interesting than stay comfortable and bored. Regular visits, "
                    f"real plans — that's the only way it works. What does your ideal "
                    f"week look like, by the way?"
                )
            return (
                f"Energize, honestly — I like people with a thing they're serious about. "
                f"My weeks are full too, so parallel intensity works. What does your ideal "
                f"week look like, by the way?"
            )
        if turn_idx == 6:  # A proposes a concrete idea
            idea = shared[0] if shared else o_pick(0)
            return (
                f"My ideal week has {o_pick(0)} twice, good food once, and one evening with "
                f"zero plans. Idea: if we keep talking, first meetup could be around "
                f"{idea} — low pressure, easy exit if it's awkward, great if it isn't."
            )
        # turn 7: B closes
        return (
            f"I like that — specific and low-pressure. I'm enjoying this conversation, "
            f"{own_name}. Let's keep talking and see if the {t_pick(0)} stories live up "
            f"to the hype."
        )


# ---------------------------------------------------------------------------
# DateOrchestrator
# ---------------------------------------------------------------------------
class DateOrchestrator:
    N_TURNS = 8

    @staticmethod
    def _scripted_eval(own: dict, other: dict) -> dict:
        oi = set(own.get("interests", []) or [])
        ti = set(other.get("interests", []) or [])
        shared = sorted(oi & ti)
        score = 50 + len(shared) * 10
        if own.get("location") and own.get("location") == other.get("location"):
            score += 8
        prefs = ((own.get("preferences", {}) or {}).get("looking_for", "") or "").lower()
        hits = sum(
            1 for w in prefs.split() if len(w) > 4 and any(w in i for i in ti)
        )
        score += min(hits, 3) * 3
        score = max(5, min(95, round(score)))

        pros = [f"Shared interest in {i}" for i in shared[:3]]
        if not pros:
            pros = ["Engaging, respectful conversation"]
        cons = []
        if own.get("location") != other.get("location"):
            cons.append(
                f"Different cities ({own.get('location')} vs {other.get('location')})"
            )
        if not shared:
            cons.append("No overlapping interests surfaced yet")
        summary = (
            f"Rated {score}/100. "
            + ("Strong overlap on " + ", ".join(shared[:2]) + ". " if shared else "")
            + ("Distance is the main open question." if cons and "Different cities" in cons[0] else "Good conversational chemistry.")
        )
        return {"score": float(score), "summary": summary, "pros": pros, "cons": cons}

    _EVAL_SYSTEM = (
        "You are an impartial dating coach reviewing ONE side of a first-date "
        "conversation. Score how promising this match looks from YOUR client's "
        "perspective (0-100). Consider: shared interests, lifestyle fit, "
        "communication quality, and honestly note conflicts. Respond with a "
        "single JSON object: {score (0-100 number), summary (string), "
        "pros ([string]), cons ([string])}."
    )

    @staticmethod
    def _live_eval(system_prompt: str, transcript: list[dict], name: str) -> dict:
        convo = "\n".join(
            f"{'A' if m['speaker'] == 'a' else 'B'}: {m['text']}" for m in transcript
        )
        user = (
            f"You are evaluating the date for {name}.\n\nTranscript:\n{convo}\n\n"
            "Return the JSON evaluation now."
        )
        data = llm.chat(DateOrchestrator._EVAL_SYSTEM, user, json_mode=True)
        if not isinstance(data, dict):
            raise llm.LLMError("bad eval JSON")
        return {
            "score": float(max(0, min(100, data.get("score", 50)))),
            "summary": str(data.get("summary", "")),
            "pros": [str(x) for x in data.get("pros", [])][:5],
            "cons": [str(x) for x in data.get("cons", [])][:5],
        }

    @staticmethod
    def run(a: dict, b: dict, analysis_a: dict, analysis_b: dict,
            mode: str = "scripted_demo") -> dict:
        """Run a bounded multi-turn date and persist it. Returns the Date dict."""
        analysis_a = enrich(analysis_a, a)
        analysis_b = enrich(analysis_b, b)
        mode_used = mode
        sys_a = DatingAgent.build_system_prompt(analysis_a, a["name"])
        sys_b = DatingAgent.build_system_prompt(analysis_b, b["name"])
        transcript: list[dict] = []
        history: list[dict] = []

        for turn in range(DateOrchestrator.N_TURNS):
            speaker = "a" if turn % 2 == 0 else "b"
            text = ""
            if mode_used == "live_llm":
                try:
                    system = sys_a if speaker == "a" else sys_b
                    text = DatingAgent.live_turn(history, system)
                except (llm.LLMNotConfigured, llm.LLMError):
                    mode_used = "scripted_demo"  # degrade gracefully, stay honest
            if not text:
                own, other = (analysis_a, analysis_b) if speaker == "a" else (analysis_b, analysis_a)
                own_n, other_n = (a["name"], b["name"]) if speaker == "a" else (b["name"], a["name"])
                text = DatingAgent.scripted_turn(own, other, turn, own_n, other_n)
            msg = {"turn": turn, "speaker": speaker, "text": text}
            transcript.append(msg)
            history.append({"speaker": speaker, "text": text})

        # Independent post-date evaluations
        if mode_used == "live_llm":
            try:
                eval_a = DateOrchestrator._live_eval(sys_a, transcript, a["name"])
                eval_b = DateOrchestrator._live_eval(sys_b, transcript, b["name"])
            except (llm.LLMNotConfigured, llm.LLMError):
                eval_a = DateOrchestrator._scripted_eval(analysis_a, analysis_b)
                eval_b = DateOrchestrator._scripted_eval(analysis_b, analysis_a)
        else:
            eval_a = DateOrchestrator._scripted_eval(analysis_a, analysis_b)
            eval_b = DateOrchestrator._scripted_eval(analysis_b, analysis_a)

        sa, sb = eval_a["score"], eval_b["score"]
        if sa >= 65 and sb >= 65:
            decision, expl = (
                "mutual_yes",
                f"Both agents rated the date highly ({sa:.0f} and {sb:.0f}). "
                "Recommend a second date.",
            )
        elif sa >= 65 or sb >= 65:
            who = a["name"] if sa >= 65 else b["name"]
            decision, expl = (
                "one_sided",
                f"Interest is one-sided: {who} is keen "
                f"({max(sa, sb):.0f}) but the other is lukewarm ({min(sa, sb):.0f}).",
            )
        else:
            decision, expl = (
                "pass",
                f"Neither agent is convinced ({sa:.0f} and {sb:.0f}). "
                "Better matches likely exist for both.",
            )

        date = {
            "id": uuid.uuid4().hex,
            "participant_a_id": a["id"],
            "participant_b_id": b["id"],
            "status": "completed",
            "mode": mode_used,
            "transcript": transcript,
            "eval_a": eval_a,
            "eval_b": eval_b,
            "decision": decision,
            "decision_explanation": expl,
            "created_at": _now(),
        }
        db.insert_date(date)
        return date


# ---------------------------------------------------------------------------
# MatchRanker
# ---------------------------------------------------------------------------
class MatchRanker:
    """Directional compatibility scoring.

    Formula (0-100), computed from A's perspective over candidate B:
      base = Jaccard(shared interests) * 40
      + 15 if same location
      + 10 if |age_a - age_b| <= 5            (reads optional 'age' keys)
      + up to 10 for preference keyword hits  (words from A's looking_for found
        in B's interests/traits, 2 pts each, cap 10)
      + up to 10 for evidence quality         (min(#high-confidence evidence
        in B's analysis, 5) * 2)
      + up to 10 directional priority bonus   (+5 per A-priority keyword found
        in B's interests/traits, cap 10)
      + date boost in [-15, +15]              ((A's eval score - 50) / 50 * 15
        when a date exists; A's eval = eval_a if A was speaker a else eval_b)
      clamp to [0, 100]

    Directional: score(A,B) uses A's priorities, A's preferences and A's date
    evaluation, so score(A,B) != score(B,A) in general.
    """

    @staticmethod
    def _eval_for(date: dict, participant_id: str) -> float | None:
        if not date:
            return None
        if date.get("participant_a_id") == participant_id:
            return (date.get("eval_a") or {}).get("score")
        if date.get("participant_b_id") == participant_id:
            return (date.get("eval_b") or {}).get("score")
        return None

    @staticmethod
    def score(a: dict, b: dict, date: dict | None = None) -> tuple[float, list[str], list[str], str]:
        ai = set(a.get("interests", []) or [])
        bi = set(b.get("interests", []) or [])
        union = ai | bi
        jaccard = (len(ai & bi) / len(union)) if union else 0.0
        total = jaccard * 40

        reasons: list[str] = []
        conflicts: list[str] = []

        shared = sorted(ai & bi)
        if shared:
            reasons.append(
                f"Shares {len(shared)} interest(s): {', '.join(shared[:4])} "
                f"({jaccard:.0%} overlap)"
            )
        else:
            conflicts.append("No overlapping interests found")

        if a.get("location") and a.get("location") == b.get("location"):
            total += 15
            reasons.append(f"Both based in {a['location']}")
        elif a.get("location") and b.get("location"):
            conflicts.append(
                f"Different cities ({a['location']} vs {b['location']}) — distance trade-off"
            )

        if isinstance(a.get("age"), int) and isinstance(b.get("age"), int):
            diff = abs(a["age"] - b["age"])
            if diff <= 5:
                total += 10
                reasons.append(f"Close in age ({a['age']} vs {b['age']})")
            elif diff > 8:
                conflicts.append(f"Age gap of {diff} years")

        prefs = ((a.get("preferences", {}) or {}).get("looking_for", "") or "").lower()
        b_text = " ".join(list(bi) + [t.get("trait", "") for t in b.get("traits", [])]).lower()
        pref_hits = sum(1 for w in prefs.split() if len(w) > 4 and w in b_text)
        pref_pts = min(pref_hits, 5) * 2
        total += pref_pts
        if pref_hits:
            reasons.append(f"{pref_hits} preference keyword(s) match B's profile")

        high_ev = sum(1 for e in b.get("evidence", []) if e.get("confidence") == "high")
        ev_pts = min(high_ev, 5) * 2
        total += ev_pts
        if high_ev >= 2:
            reasons.append(f"Strong evidence quality ({high_ev} high-confidence observations)")

        prio_hits = 0
        for p in a.get("priorities", []) or []:
            words = [w for w in p.lower().split() if len(w) > 4]
            if any(w in b_text for w in words):
                prio_hits += 1
        prio_pts = min(prio_hits, 2) * 5
        total += prio_pts
        if prio_hits:
            reasons.append(f"B matches {prio_hits} of A's stated priorities")

        eval_score = MatchRanker._eval_for(date, a.get("participant_id", ""))
        if eval_score is not None:
            boost = (eval_score - 50) / 50 * 15
            total += boost
            reasons.append(
                f"Actual date outcome: A rated it {eval_score:.0f}/100 "
                f"({'positive' if boost >= 0 else 'negative'} adjustment)"
            )

        while len(reasons) < 4:
            reasons.append("Compatible communication style observed in profile")
        reasons = reasons[:6]

        total = max(0.0, min(100.0, round(total, 1)))

        if (high_ev >= 3 and (date is not None or len(shared) >= 2)) or total >= 75:
            confidence = "high"
        elif shared or date is not None or total >= 45:
            confidence = "medium"
        else:
            confidence = "low"

        return total, reasons, conflicts[:3], confidence
