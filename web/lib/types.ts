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
  finishers: { position: number; horse_name: string }[];
  top3_hits: number;
  top_pick_hit: boolean;
  has_results: boolean;
};

export type Meeting = {
  meeting_date: string;
  fetched_at?: string;
  settled_at?: string;
  has_results: boolean;
  races: Race[];
};

export type MeetingSummary = {
  date: string;
  race_count: number;
  has_results: boolean;
  top3_precision: number | null;
  value_bet_count: number;
  value_bet_roi: number | null;
};

export type MeetingsIndex = {
  generated_at: string;
  meetings: MeetingSummary[];
};

export type Performance = {
  generated_at: string;
  meetings_total: number;
  meetings_settled: number;
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
