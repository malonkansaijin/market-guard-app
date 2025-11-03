export type WarningSeverity = 'info' | 'watch' | 'alert' | 'high' | 'invalidated';

export interface WarningPayload {
  type: 'top' | 'bottom';
  code: string;
  severity: WarningSeverity;
  message: string;
  ttl_days?: number;
  evidence?: Record<string, number | string | null | undefined>;
}

export interface DailyItem {
  date: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  pct: number | null;
  ma21: number | null;
  ma50: number | null;
  ma200: number | null;
  warnings_top: WarningPayload[];
  warnings_bottom: WarningPayload[];
}

export interface FTDInfo {
  status: 'none' | 'active' | 'invalidated';
  date: string | null;
  invalidated_on: string | null;
  day1: string | null;
}

export interface PostFTDMetrics {
  monitor_days: number;
  monitor_window: number;
  ma50_breaches: number;
  ma50_breach_dates: string[];
  volume_decline_streak: number;
  volume_fade_triggered: boolean;
  volume_fade_date: string | null;
  ma50_held_first3: boolean;
}

export interface SymbolScan {
  symbol: string;
  last_date: string;
  regime: string;
  dd_25d: number;
  churn_25d: number;
  ftd: FTDInfo;
  sparkline: string;
  items: DailyItem[];
  post_ftd_metrics: PostFTDMetrics | null;
}

export interface SymbolOverview {
  symbol: string;
  last_date: string;
  regime: string;
  dd_25d: number;
  churn_25d: number;
  ftd: FTDInfo;
  sparkline: string;
  high_priority_warnings: number;
  post_ftd_metrics: PostFTDMetrics | null;
}

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface BreadthMetrics {
  total: number;
  above_ma21: number;
  above_ma50: number;
  positive_close: number;
  above_ma21_pct: number;
  above_ma50_pct: number;
  positive_close_pct: number;
}

export interface LeadingSymbolStat {
  symbol: string;
  close: number;
  ma50: number | null;
  below_ma50: boolean;
}

export interface LeadingStats {
  total: number;
  below_ma50: number;
  below_ma50_pct: number;
  symbols: LeadingSymbolStat[];
}

export interface MarketContext {
  breadth: BreadthMetrics;
  leading: LeadingStats;
}
