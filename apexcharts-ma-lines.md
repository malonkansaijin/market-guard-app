# Proposal: Render MA Lines (MA21/MA50/MA200) as Continuous Lines on ApexCharts

## Goal
On the Scan Details chart (ApexCharts mixed candlestick + lines), moving averages (MA21/50/200) currently appear as **dots**.  
Fix the configuration and data shaping so MAs render as **continuous smooth lines** over the candlesticks.

## Context
- Frontend charting: **ApexCharts**
- Data: daily OHLCV with precomputed `ma21`, `ma50`, `ma200`
- Problem symptoms: markers (dots) visible but **no connecting stroke**, especially in early periods with `null` MA values.

---

## Requirements (what Codex should implement)
1. Use **mixed series**: candlestick for price, line for each MA.
2. Ensure **x-axis is datetime** and series data uses `{ x: timestamp(ms), y: number | null }`.
3. Enable `chart.connectNullData = true` to bridge early `null` windows.
4. Hide markers (`markers.size = 0`) and set explicit **stroke widths** so lines are visible.
5. Data must be **sorted ascending by timestamp** and use consistent timestamps across all series.
6. Provide a small **helper** to transform rows into Apex series entries.

---

## Acceptance Criteria
- MA21/MA50/MA200 render as **smooth continuous lines** (no isolated dots).
- Price series remains candlestick.
- Lines continue across initial `null` gaps (e.g., first 50/200 days) via `connectNullData`.
- No console warnings about x-axis type or invalid series shape.
- Zoom/pan keeps lines aligned with candles.

---

## Implementation

### 1) Series assembly
```ts
type Row = {
  date: string | number | Date;
  open: number; high: number; low: number; close: number; volume: number;
  ma21?: number | null; ma50?: number | null; ma200?: number | null;
};

const toTs = (d: Row['date']) => new Date(d as any).getTime();

export function buildSeries(rows: Row[]) {
  const ohlc = rows.map(r => ({
    x: toTs(r.date),
    y: [r.open, r.high, r.low, r.close],
  }));

  const mapMA = (key: 'ma21'|'ma50'|'ma200') =>
    rows.map(r => ({ x: toTs(r.date), y: r[key] ?? null }));

  return [
    { name: 'Price', type: 'candlestick', data: ohlc },
    { name: 'MA21',  type: 'line',        data: mapMA('ma21') },
    { name: 'MA50',  type: 'line',        data: mapMA('ma50') },
    { name: 'MA200', type: 'line',        data: mapMA('ma200') },
  ];
}
```

### 2) Chart options
```ts
import type { ApexOptions } from 'apexcharts';

export const buildOptions = (): ApexOptions => ({
  chart: {
    type: 'line',                 // base = line for mixed types
    animations: { enabled: false },
    toolbar: { show: true },
    zoom: { enabled: true },
    // key: connect across null MA windows
    connectNullData: true,
  },
  xaxis: {
    type: 'datetime',
    tooltip: { enabled: false },
  },
  stroke: {
    curve: 'smooth',
    // [candles, MA21, MA50, MA200]
    width: [1, 3, 3, 3],
  },
  markers: {
    // prevent dots-only look
    size: [0, 0, 0, 0],
  },
  legend: { show: true },
  tooltip: {
    shared: true,
    x: { format: 'yyyy-MM-dd' },
  },
});
```

### 3) Usage
```ts
const series = buildSeries(rowsSortedAsc);
const options = buildOptions();
// <ReactApexChart type="line" series={series} options={options} />
```

---

## Troubleshooting Checklist
- [ ] Each MA series item is `{ x: number(ms), y: number|null }` (no strings in `x`).
- [ ] `xaxis.type = 'datetime'` and **all series share identical timestamps**.
- [ ] `chart.connectNullData = true` to bridge `null` windows for MA50/200.
- [ ] `stroke.width` > 0 and `markers.size = 0` to avoid dots dominating.
- [ ] Data **sorted ascending**; unsorted time can break line drawing.
- [ ] If still dotted: verify CSS is not overriding `.apexcharts-series` stroke widths.

---

## Optional Styling
```ts
colors: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'], // price, 21, 50, 200 (optional)
dashArray: [0, 0, 0, 0],
```

---

## Notes
- Candlestick and line series can coexist; ensure **series-specific `type`** is set.
- If server sends ISO strings for dates, convert to timestamps on the client to avoid timezone shifts.
