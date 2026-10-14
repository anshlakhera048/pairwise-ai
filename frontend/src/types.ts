export interface Participant {
  id: string;
  name: string;
  age: number;
  location: string;
  headline: string;
  linkedin_url: string;
  instagram_url: string;
  photo_url: string;
  is_synthetic: boolean;
  analysis_status: string;
  created_at: string;
}

export interface Trait {
  trait: string;
  confidence: number;
}

export interface EvidenceItem {
  claim: string;
  source: string;
  quote: string;
  confidence: number;
}

export interface Preferences {
  looking_for: string;
  dealbreakers: string[];
}

export interface Analysis {
  summary: string;
  traits: Trait[];
  interests: string[];
  preferences: Preferences;
  evidence: EvidenceItem[];
  unknowns: string[];
  priorities: string[];
  analyzer: string;
}

export interface ParticipantDetail {
  participant: Participant;
  analysis: Analysis | null;
  dates: AgentDate[];
  ranking_count: number;
}

export interface DateTurn {
  turn: number;
  speaker: "a" | "b";
  text: string;
}

export interface DateEval {
  score: number;
  summary: string;
  pros: string[];
  cons: string[];
}

export type DateMode = "live_llm" | "scripted_demo";

export interface AgentDate {
  id: string;
  participant_a_id: string;
  participant_b_id: string;
  status: string;
  mode: DateMode;
  transcript: DateTurn[];
  eval_a: DateEval;
  eval_b: DateEval;
  decision: string;
  decision_explanation: string;
  created_at: string;
}

export interface RankingEntry {
  participant_id: string;
  candidate_id: string;
  rank: number;
  score: number;
  reasons: string[];
  conflicts: string[];
  confidence: number;
  based_on_date_id: string | null;
}

export interface DashboardData {
  participant_count: number;
  analyses_completed: number;
  dates_completed: number;
  rankings_completed: number;
  recent_interactions: RecentInteraction[];
}

export interface RecentInteraction {
  date_id: string;
  a_name: string;
  b_name: string;
  created_at: string;
  decision: string;
}

export interface Health {
  status: string;
  llm_configured: boolean;
  version: string;
}

export interface CreateParticipantInput {
  name: string;
  age: number;
  location: string;
  headline: string;
  linkedin_url: string;
  instagram_url: string;
  linkedin_text?: string;
  instagram_text?: string;
}

export interface SeedResult {
  seeded: boolean;
  participants?: number;
  reason?: string;
}
