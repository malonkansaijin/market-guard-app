import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import type { DailyItem, WarningPayload } from '../types';

const warningColor: Record<string, string> = {
  info: '#3b82f6',
  watch: '#f97316',
  alert: '#ef4444',
  high: '#7c3aed',
  invalidated: '#9ca3af'
};

const ribbonFill: Record<string, string> = {
  alert: 'rgba(239, 68, 68, 0.16)',
  high: 'rgba(124, 58, 237, 0.16)',
  watch: 'rgba(249, 115, 22, 0.12)',
  info: 'rgba(59, 130, 246, 0.12)'
};

const severityPriority: Record<string, number> = {
  info: 1,
  watch: 2,
  alert: 3,
  high: 4
};

const DAY_MS = 1000 * 60 * 60 * 24;
const CANDLE_WIDTH_RATIO = 0.7;

type MAKey = 'ma21' | 'ma50' | 'ma200';

const MA_CONFIG: Array<{ key: MAKey; name: string; color: string }> = [
  { key: 'ma21', name: 'MA21', color: '#14b8a6' },
  { key: 'ma50', name: 'MA50', color: '#f59e0b' },
  { key: 'ma200', name: 'MA200', color: '#6366f1' }
];

interface MarketChartProps {
  items: DailyItem[];
  height?: number;
}

function buildAnnotations(items: DailyItem[]): ApexOptions['annotations'] {
  const annotations: ApexOptions['annotations'] = { xaxis: [] };
  const timestamps = items.map((item) => new Date(item.date).getTime());

  for (let idx = 0; idx < items.length; idx += 1) {
    const item = items[idx];
    const dateValue = timestamps[idx];
    const prevGap =
      idx > 0
        ? Math.max(dateValue - timestamps[idx - 1], 1)
        : idx + 1 < timestamps.length
          ? Math.max(timestamps[idx + 1] - dateValue, 1)
          : DAY_MS;
    const nextGap =
      idx + 1 < timestamps.length
        ? Math.max(timestamps[idx + 1] - dateValue, 1)
        : prevGap;
    const baseGap = Math.max(Math.min(prevGap, nextGap, DAY_MS), 1);
    const ribbonWidth = baseGap * CANDLE_WIDTH_RATIO;
    const halfWidth = ribbonWidth / 2;
    const start = dateValue - halfWidth;
    const end = dateValue + halfWidth;
    const topWarnings = item.warnings_top ?? [];

    const highlightTarget = topWarnings.reduce<WarningPayload | null>((best, candidate) => {
      const candidateRank = severityPriority[candidate.severity] ?? 0;
      if (candidateRank === 0) {
        return best;
      }
      if (best === null) {
        return candidate;
      }
      const bestRank = severityPriority[best.severity] ?? 0;
      return candidateRank > bestRank ? candidate : best;
    }, null);

    if (highlightTarget) {
      annotations.xaxis?.push({
        x: start,
        x2: end,
        borderColor: 'transparent',
        fillColor: ribbonFill[highlightTarget.severity] ?? 'rgba(59, 130, 246, 0.1)',
        opacity: 1
      });
    }

    const severeTop = topWarnings.filter(
      (warning) => warning.severity === 'alert' || warning.severity === 'high'
    );

    severeTop.forEach((warning, idx) => {
      annotations.xaxis?.push({
        x: dateValue,
        borderColor: warningColor[warning.severity] ?? '#6366f1',
        strokeDashArray: 4,
        label: {
          text: warning.code,
          style: {
            background: warningColor[warning.severity] ?? '#6366f1',
            color: '#fff',
            fontSize: '10px'
          },
          orientation: 'horizontal',
          offsetY: -60 - idx * 18
        }
      });
    });

    const ftdWarnings = item.warnings_bottom.filter((warning) => warning.code === 'FTD');
    if (ftdWarnings.length > 0) {
      annotations.xaxis?.push({
        x: dateValue,
        strokeDashArray: 4,
        borderColor: '#22c55e',
        label: {
          text: 'FTD',
          style: {
            background: '#22c55e',
            color: '#fff',
            fontSize: '10px'
          },
          orientation: 'horizontal',
          offsetY: -60
        }
      });
    }
  }
  return annotations;
}

export function MarketChart({ items, height = 360 }: MarketChartProps): JSX.Element {
  const priceValues = items.map((item) => item.c);
  const maValues = items.flatMap((item) =>
    [item.ma21, item.ma50, item.ma200].filter(
      (value): value is number => value !== null && value !== undefined
    )
  );
  const relevantValues = [...priceValues, ...maValues];
  const hasValues = relevantValues.length > 0;
  const minPrice = hasValues ? Math.min(...relevantValues) : undefined;
  const maxPrice = hasValues ? Math.max(...relevantValues) : undefined;

  const toTimestamp = (value: string): number => new Date(value).getTime();
  const firstTimestamp = items.length > 0 ? toTimestamp(items[0].date) : undefined;
  const lastTimestamp = items.length > 0 ? toTimestamp(items[items.length - 1].date) : undefined;
  const gap =
    items.length > 1 ? Math.max(toTimestamp(items[1].date) - firstTimestamp!, 1) : DAY_MS;
  const xPadding = gap / 2;
  const xMin = firstTimestamp !== undefined ? firstTimestamp - xPadding : undefined;
  const xMax = lastTimestamp !== undefined ? lastTimestamp + xPadding : undefined;

  const priceCandles = [
    {
      name: 'Price',
      type: 'candlestick' as const,
      data: items.map((item) => ({
        x: toTimestamp(item.date),
        y: [item.o, item.h, item.l, item.c]
      }))
    }
  ];

  const maSeries = MA_CONFIG.map(({ key, name, color }) => ({
    name,
    type: 'line' as const,
    data: items.map((item) => ({
      x: toTimestamp(item.date),
      y: item[key] ?? null
    })),
    color,
    connectNulls: true
  })).filter((series) => series.data.some((point) => point.y !== null));

  const volumeBars = [
    {
      name: 'Volume',
      type: 'column' as const,
      data: items.map((item) => ({
        x: toTimestamp(item.date),
        y: item.v,
        fillColor: item.c >= item.o ? '#ef4444' : '#16a34a'
      }))
    }
  ];

  const annotations = buildAnnotations(items);

  const priceOptions: ApexOptions = {
    chart: {
      type: 'candlestick',
      height,
      background: 'transparent',
      id: 'market-guard-price',
      group: 'market-guard-sync',
      toolbar: {
        show: true,
        tools: { pan: true, zoom: true, zoomin: true, zoomout: true, reset: true }
      },
      animations: { enabled: false },
      sparkline: { enabled: false }
    },
    xaxis: {
      type: 'datetime',
      labels: { datetimeUTC: false },
      tickPlacement: 'on',
      min: xMin,
      max: xMax
    },
    yaxis: {
      decimalsInFloat: 2,
      tooltip: { enabled: true },
      min: minPrice !== undefined ? minPrice * 0.97 : undefined,
      max: maxPrice !== undefined ? maxPrice * 1.03 : undefined,
      labels: {
        minWidth: 72
      }
    },
    colors: ['#0ea5e9', ...MA_CONFIG.map(({ color }) => color)],
    stroke: {
      width: [1, ...maSeries.map(() => 3)],
      curve: 'smooth'
    },
    plotOptions: {
      candlestick: {
        colors: { upward: '#ef4444', downward: '#16a34a' }
      }
    },
    fill: {
      opacity: [1, ...maSeries.map(() => 0)]
    },
    markers: {
      size: [0, ...maSeries.map(() => 0)],
      hover: { size: 0 }
    },
    tooltip: {
      shared: true,
      x: { format: 'yyyy-MM-dd' }
    },
    legend: {
      show: true
    },
    annotations
  };

  const volumeOptions: ApexOptions = {
    chart: {
      type: 'bar',
      height: 160,
      background: 'transparent',
      id: 'market-guard-volume',
      group: 'market-guard-sync',
      brush: { enabled: true, target: 'market-guard-price' },
      toolbar: { show: false },
      offsetY: -35,
      selection:
        xMin !== undefined && xMax !== undefined
          ? {
              xaxis: {
                min: xMin,
                max: xMax,
              },
            }
          : undefined,
    },
    xaxis: {
      type: 'datetime',
      labels: { datetimeUTC: false },
      tickPlacement: 'on',
      min: xMin,
      max: xMax
    },
    yaxis: {
      labels: {
        formatter: (value) => `${Math.round(value / 1_000_000)}M`,
        minWidth: 72
      }
    },
    dataLabels: { enabled: false },
    plotOptions: {
      bar: {
        columnWidth: '60%'
      }
    },
    stroke: { width: 0 },
    fill: { opacity: 0.65 },
    legend: { show: false },
    tooltip: {
      shared: false,
      x: { format: 'yyyy-MM-dd' }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
      <Chart
        options={priceOptions}
        series={[...priceCandles, ...maSeries]}
        height={height}
        type="candlestick"
      />
      <Chart options={volumeOptions} series={volumeBars} height={160} type="bar" />
    </div>
  );
}
