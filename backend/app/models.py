from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Participant(BaseModel):
    id: str
    name: str
    age: int
    location: str
    headline: str = ""
    linkedin_url: str
    instagram_url: str
    photo_url: Optional[str] = None
    is_synthetic: bool = False
    analysis_status: Literal["pending", "ready", "failed"] = "pending"
    created_at: str


class ParticipantCreate(BaseModel):
    name: str
    age: int
    location: str
    headline: str = ""
    linkedin_url: str
    instagram_url: str
    linkedin_text: str = ""
    instagram_text: str = ""


class Trait(BaseModel):
    trait: str
    confidence: Literal["high", "medium", "low"]


class EvidenceItem(BaseModel):
    claim: str
    source: Literal["linkedin", "instagram"]
    quote: str
    confidence: Literal["high", "medium", "low"]


class Preferences(BaseModel):
    looking_for: str = ""
    dealbreakers: list[str] = Field(default_factory=list)


class Analysis(BaseModel):
    participant_id: str
    summary: str
    traits: list[Trait] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    preferences: Preferences = Field(default_factory=Preferences)
    evidence: list[EvidenceItem] = Field(default_factory=list)
    unknowns: list[str] = Field(default_factory=list)
    priorities: list[str] = Field(default_factory=list)
    analyzer: Literal["llm", "scripted", "manual"] = "scripted"
    created_at: str = ""


class DateMsg(BaseModel):
    turn: int
    speaker: Literal["a", "b"]
    text: str


class DateEval(BaseModel):
    score: float
    summary: str
    pros: list[str] = Field(default_factory=list)
    cons: list[str] = Field(default_factory=list)


class Date(BaseModel):
    id: str
    participant_a_id: str
    participant_b_id: str
    status: Literal["completed", "failed"] = "completed"
    mode: Literal["live_llm", "scripted_demo"] = "scripted_demo"
    transcript: list[DateMsg] = Field(default_factory=list)
    eval_a: DateEval
    eval_b: DateEval
    decision: str = ""
    decision_explanation: str = ""
    created_at: str = ""


class DateCreate(BaseModel):
    participant_a_id: str
    participant_b_id: str


class RankingEntry(BaseModel):
    participant_id: str
    candidate_id: str
    rank: int
    score: float
    reasons: list[str] = Field(default_factory=list)
    conflicts: list[str] = Field(default_factory=list)
    confidence: Literal["high", "medium", "low"] = "medium"
    based_on_date_id: Optional[str] = None


class RecentInteraction(BaseModel):
    date_id: str
    a_name: str
    b_name: str
    created_at: str
    decision: str


class Dashboard(BaseModel):
    participant_count: int
    analyses_completed: int
    dates_completed: int
    rankings_completed: int
    recent_interactions: list[RecentInteraction] = Field(default_factory=list)
