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
  items.forEach((item) => {
    const dateValue = new Date(item.date).getTime();
    const severeWarnings: WarningPayload[] = [
      ...item.warnings_top,
      ...item.warnings_bottom
    ].filter((warning) => warning.severity === 'alert' || warning.severity === 'high');
    severeWarnings.forEach((warning, idx) => {
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
  });
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

  const priceSeries = [
    {
      name: 'Price',
      type: 'candlestick' as const,
      data: items.map((item) => ({
        x: new Date(item.date),
        y: [item.o, item.h, item.l, item.c]
      })),
      yAxisIndex: 0
    }
  ];

  const volumeSeries = [
    {
      name: 'Volume',
      type: 'column' as const,
      data: items.map((item) => ({
        x: new Date(item.date),
        y: item.v,
        fillColor: item.c >= item.o ? '#16a34a' : '#ef4444'
      })),
      yAxisIndex: 1
    }
  ];

  const maSeries = MA_CONFIG.map(({ key, name, color }) => {
    const data = items.map((item) => ({
      x: new Date(item.date),
      y: item[key] ?? null
    }));
    const hasValue = data.some((point) => point.y !== null);
    if (!hasValue) {
      return null;
    }
    return {
      name,
      type: 'line' as const,
      data,
      color,
      yAxisIndex: 0,
      connectNulls: true
    };
  }).filter((series): series is NonNullable<typeof series> => series !== null);

  const annotations = buildAnnotations(items);

  const strokeWidths = [1, ...maSeries.map(() => 2), 0];
  const fillOpacities = [1, ...maSeries.map(() => 0), 0.3];

  const options: ApexOptions = {
    chart: {
      type: 'candlestick',
      height,
      background: 'transparent',
      toolbar: {
        show: true,
        tools: { pan: true, zoom: true, zoomin: true, zoomout: true, reset: true }
      }
    },
    xaxis: {
      type: 'datetime',
      labels: {
        datetimeUTC: false
      }
    },
    yaxis: [
      {
        seriesName: 'Price',
        decimalsInFloat: 2,
        tooltip: { enabled: true },
        min: minPrice !== undefined ? minPrice * 0.97 : undefined,
        max: maxPrice !== undefined ? maxPrice * 1.03 : undefined
      },
      {
        seriesName: 'Volume',
        opposite: true,
        decimalsInFloat: 0,
        labels: {
          formatter: (value) => `${Math.round(value / 1_000_000)}M`
        }
      }
    ],
    grid: {
      padding: {
        top: 80,
        bottom: 16
      }
    },
    stroke: {
      width: strokeWidths,
      curve: 'smooth'
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: '#16a34a',
          downward: '#ef4444'
        }
      },
      bar: {
        columnWidth: '60%'
      }
    },
    fill: {
      opacity: fillOpacities
    },
    markers: {
      size: [0, ...maSeries.map(() => 0), 0]
    },
    tooltip: {
      shared: true,
      x: {
        format: 'yyyy-MM-dd'
      }
    },
    legend: {
      show: true
    },
    annotations
  };

  const series = [...priceSeries, ...maSeries, ...volumeSeries];

  return (
    <div style={{ marginBottom: 16 }}>
      <Chart options={options} series={series} height={height} type="candlestick" />
    </div>
  );
}
