import type { SymbolOverview } from '../types';

interface SummaryTableProps {
  data: SymbolOverview[];
}

const regimeColor: Record<string, string> = {
  Uptrend: '#22c55e',
  'Under Pressure': '#f97316',
  Correction: '#ef4444',
  Neutral: '#0ea5e9'
};

function renderRegime(regime: string): JSX.Element {
  const color = regimeColor[regime] ?? '#6366f1';
  return (
    <span style={{ color, fontWeight: 700 }}>{regime}</span>
  );
}

export function SummaryTable({ data }: SummaryTableProps): JSX.Element {
  return (
    <div className="card">
      <h2>Market Overview</h2>
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Regime</th>
            <th>DD (25d)</th>
            <th>Churn (25d)</th>
            <th>FTD Status</th>
            <th>High Priority Alerts</th>
            <th>Sparkline</th>
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
              <td style={{ fontFamily: 'monospace' }}>{item.sparkline}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="table-note">* High Priority Alerts は最新日の `alert/high` レベルの warnings 数。</p>
    </div>
  );
}
