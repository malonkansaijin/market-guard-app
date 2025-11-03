import type { PostFTDMetrics, SymbolOverview } from '../types';

interface SummaryTableProps {
  data: SymbolOverview[];
}

const regimeColor: Record<string, string> = {
  Uptrend: '#22c55e',
  'Under Pressure': '#f97316',
  Correction: '#ef4444',
  Neutral: '#0ea5e9'
};

const COLUMN_HEADERS: Array<{ key: string; label: string; description: string }> = [
  {
    key: 'symbol',
    label: 'Symbol',
    description: '表示中のティッカーコードです。\n指数やETFを含みます。\n例: SPY, ^N225。'
  },
  {
    key: 'regime',
    label: 'Regime',
    description: 'CAN-SLIM による市場レジームです。\nUptrendなどの区分でリスク\nを把握します。'
  },
  {
    key: 'dd25',
    label: 'DD (25d)',
    description: '直近25営業日のDistribution Day\n(機関投資家の売り圧力が出た日)件数\nです。6本で Correction への警戒目安\nとなります。'
  },
  {
    key: 'churn25',
    label: 'Churn (25d)',
    description: '直近25営業日のChurn(失速日)件数\nです。値幅が狭く出来高が増える\n失速シグナルを示します。'
  },
  {
    key: 'ftd',
    label: 'FTD Status',
    description: 'Follow-Through Day(上昇転換確認日)\nの状態です。active・invalidated・ \nnoneのいずれかを表示します。'
  },
  {
    key: 'alerts',
    label: 'High Priority Alerts',
    description: '最新日の重要警告件数です。\nalert または high レベルのみを\nカウントしています。'
  },
  {
    key: 'postFtd',
    label: 'Post-FTD',
    description: 'FTD 後の MA50 割れ回数や出来高フェードの有無を確認します。'
  },
  {
    key: 'sparkline',
    label: 'Sparkline',
    description: '直近終値のミニチャートです。\n市場の短期トレンドをひと目で\n確認できます。'
  }
];

function renderRegime(regime: string): JSX.Element {
  const color = regimeColor[regime] ?? '#6366f1';
  return (
    <span style={{ color, fontWeight: 700 }}>{regime}</span>
  );
}

function renderPostFtd(metrics: PostFTDMetrics | null): JSX.Element {
  if (!metrics) {
    return <span className="context-muted">—</span>;
  }
  return (
    <div className="post-ftd-cell">
      <span>MA50割れ: {metrics.ma50_breaches}</span>
      <span>Fade: {metrics.volume_fade_triggered ? 'あり' : 'なし'}</span>
    </div>
  );
}

export function SummaryTable({ data }: SummaryTableProps): JSX.Element {
  return (
    <div className="card">
      <h2>Market Overview</h2>
      <table>
        <thead>
          <tr>
            {COLUMN_HEADERS.map((column) => (
              <th key={column.key}>
                <span className="header-tooltip" data-tooltip={column.description}>
                  {column.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.symbol}>
              <td>{item.symbol}</td>
              <td>{renderRegime(item.regime)}</td>
              <td>{item.dd_25d}</td>
              <td>{item.churn_25d}</td>
              <td>{item.ftd.status}</td>
              <td>{item.high_priority_warnings}</td>
              <td>{renderPostFtd(item.post_ftd_metrics)}</td>
              <td style={{ fontFamily: 'monospace' }}>{item.sparkline}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">* High Priority Alerts は最新日の `alert/high` レベルの warnings 数。</p>
    </div>
  );
}
