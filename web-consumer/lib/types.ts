export type Factors = {
  barrier_iv: number;
  jockey: number;
  trainer: number;
  horse: number;
  form: number;
  class_tf: number;
  weight_chg: number;
  rating: number;
  days: number;
};

export type Runner = {
  rank: number;
  horse_name: string;
  horse_id?: number;
  horse_no?: number | null;
  barrier?: number | null;
  jockey_name?: string | null;
  trainer_name?: string | null;
  official_rating?: number | null;
  days_since_last_run?: number | null;
  last_6_runs?: string | null;
  win_pct: number;
  place_pct: number;
  show_pct: number;
  public_odds?: number | null;
  market_pct?: number | null;
  edge?: number | null;
  is_value?: boolean;
  factors?: Factors;
  actual_position?: number | null;
};

export type Verdict = {
  label: "Standout" | "Confident" | "Competitive" | "Wide open" | string;
  detail: string;
  tone: "standout" | "confident" | "competitive" | "open";
};

export type Race = {
  race_id: number;
  race_number: number;
  distance_m: number;
  course_config: string;
  track_surface: string;
  race_class?: string | null;
  going?: string | null;
  field_size: number;
  top3: string[];
  runners: Runner[];
  actual_top3: string[];
  finishers: { position: number; horse_name: string; horse_no?: number | null }[];
  top3_hits: number;
  top_pick_hit: boolean;
  has_results: boolean;
  // Consumer additions (export_consumer.py):
  verdict?: Verdict;
  narrative?: string;
};

export type Meeting = {
  meeting_date: string;
  venue?: string;
  fetched_at?: string;
  settled_at?: string;
  has_results: boolean;
  demo?: boolean;
  races: Race[];
};

export type MeetingSummary = {
  date: string;
  venue?: string;
  race_count: number;
  has_results: boolean;
  demo?: boolean;
  top3_precision: number | null;
  value_bet_count: number;
  value_bet_roi: number | null;
};

// Consumer "Track Record" feed (export_consumer.py performance.json).
export type TrackRecord = {
  generated_at: string;
  headline: {
    meetings: number;
    races: number;
    date_from?: string | null;
    date_to?: string | null;
    top3_precision: number | null;
    top3_hits: number;
    top3_attempts: number;
    top_pick_rate: number | null;
    top_pick_hits: number;
    top_pick_attempts: number;
    // Same-sample honesty baselines (export_consumer.py).
    baseline_fav_rate?: number | null;
    baseline_fav_hits?: number;
    baseline_fav_attempts?: number;
    baseline_random_rate?: number | null;
  };
  meetings: {
    date: string;
    venue?: string;
    race_count: number;
    demo: boolean;
    top3_precision: number | null;
    top_pick_rate: number | null;
  }[];
};

export type MeetingsIndex = {
  generated_at: string;
  meetings: MeetingSummary[];
};

export type QualityMetric = {
  brier: number;
  logloss: number;
  race_logloss: number;
};

export type CalibrationBin = {
  lo: number;
  hi: number;
  n: number;
  pred: number;
  actual: number;
};

export type ModelQuality = {
  generated_at: string;
  n_races: number;
  n_meetings: number;
  window: string;
  best_l2: number;
  metrics: {
    blend: QualityMetric | null;
    market: QualityMetric | null;
    model: QualityMetric | null;
  };
  reference: { label: string; brier: number; logloss: number };
  calibration: CalibrationBin[];
  calibration_market: CalibrationBin[];
};

export type BettingStrategy = {
  key: string;
  label: string;
  staked: number;
  returned: number;
  net: number;
  roi_pct: number;
};

export type Betting = {
  unit: number;
  strategies: BettingStrategy[];
  per_meeting: { date: string; nets: Record<string, number> }[];
};

export type WinEdgeRanker = {
  bets: number;
  wins: number;
  win_pct: number;
  staked: number;
  returned: number;
  profit: number;
  roi_pct: number;
};

export type WinEdgeVenue = {
  venue: string;
  stake: number;
  best_l2: number;
  n_races: number;
  n_meetings: number;
  from_date: string;
  rankers: { blend: WinEdgeRanker; market: WinEdgeRanker; model: WinEdgeRanker };
  edge_gap_pts: number | null;
  verdict: "real_edge" | "rides_market" | "worse_than_market" | null;
  selective: { agree: WinEdgeRanker | null; disagree: WinEdgeRanker | null };
  generated_at: string;
};

export type WinEdge = {
  venues: Record<string, WinEdgeVenue>;
  generated_at: string;
};

export type Performance = {
  generated_at: string;
  meetings_total: number;
  meetings_settled: number;
  betting?: Betting | null;
  model_quality?: ModelQuality | null;
  win_edge?: WinEdge | null;
  top3_precision: number | null;
  top3_hits: number;
  top3_attempts: number;
  top_pick_rate: number | null;
  top_pick_hits: number;
  top_pick_attempts: number;
  value_bet_staked: number;
  value_bet_wins: number;
  value_bet_pnl: number;
  value_bet_roi: number | null;
  meetings: {
    meeting_date: string;
    venue?: string;
    race_count: number;
    has_results: boolean;
    top3_precision: number | null;
    top_pick_rate: number | null;
    value_bet_count: number;
    value_bet_settled: number;
    value_bet_wins: number;
    value_bet_pnl: number | null;
    value_bet_roi: number | null;
  }[];
};

export type EntityRecord = {
  id: number;
  name: string;
  runs?: number;
  rides?: number;
  wins: number;
  places: number;
  win_pct: number;
  place_pct: number;
  last_run?: string | null;
  trail60?: {
    rides: number;
    wins: number;
    places: number;
    win_pct: number;
    place_pct: number;
  };
};

export type Profiles = {
  as_of: string;
  horses: EntityRecord[];
  jockeys: EntityRecord[];
  trainers: EntityRecord[];
};
