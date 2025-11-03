import type { DailyItem, SymbolScan, WarningPayload } from '../types';
import { MarketChart } from './MarketChart';

interface ScanDetailsProps {
  data: SymbolScan[];
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)}%`;
}

function renderWarnings(list: WarningPayload[]): JSX.Element {
  if (list.length === 0) {
    return <span style={{ color: '#94a3b8' }}>なし</span>;
  }
  return (
    <div className="warning-list">
      {list.map((warning, index) => (
        <span key={`${warning.code}-${index}`} className={`badge ${warning.severity}`}>
          {warning.code}
        </span>
      ))}
    </div>
  );
}

function DailyRow({ item }: { item: DailyItem }): JSX.Element {
  return (
    <tr>
      <td>{item.date}</td>
      <td>{item.c.toFixed(2)}</td>
      <td>{formatPct(item.pct)}</td>
      <td>{item.ma21 ? item.ma21.toFixed(2) : '—'}</td>
      <td>{item.ma50 ? item.ma50.toFixed(2) : '—'}</td>
      <td>{item.ma200 ? item.ma200.toFixed(2) : '—'}</td>
      <td>{item.v.toLocaleString()}</td>
      <td>{renderWarnings(item.warnings_top)}</td>
      <td>{renderWarnings(item.warnings_bottom)}</td>
    </tr>
  );
}

export function ScanDetails({ data }: ScanDetailsProps): JSX.Element {
  return (
    <div className="card">
      <h2>Scan Details</h2>
      <p className="legend-note">
        <strong>Top ribbon:</strong>{' '}
        <span className="legend-swatch legend-alert">■</span> DD cluster alert (4+){' '}
        <span className="legend-swatch legend-high">■</span> DD cluster high risk (6+){' '}
        <span className="legend-swatch legend-watch">■</span> Watch-level (MA50 break 等){' '}
        <span className="legend-swatch legend-info">■</span> Info-level (MA21 reclaim 等)
      </p>
      {data.map((symbol) => (
        <div key={symbol.symbol} style={{ marginBottom: 32 }}>
          <div className="section-title">{symbol.symbol} — {symbol.last_date}</div>
          <MarketChart items={symbol.items} />
          <table>
            <thead>
              <tr>
                <th>日付</th>
                <th>終値</th>
                <th>前日比%</th>
                <th>MA21</th>
                <th>MA50</th>
                <th>MA200</th>
                <th>出来高</th>
                <th>Top Warn</th>
                <th>Bottom Warn</th>
              </tr>
            </thead>
            <tbody>
              {symbol.items.slice(-15).map((item) => (
                <DailyRow key={item.date} item={item} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
