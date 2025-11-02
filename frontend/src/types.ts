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

export interface SymbolScan {
  symbol: string;
  last_date: string;
  regime: string;
  dd_25d: number;
  churn_25d: number;
  ftd: FTDInfo;
  sparkline: string;
  items: DailyItem[];
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
}

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}
