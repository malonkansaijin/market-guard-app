import type { DailyItem, PostFTDMetrics, SymbolScan, WarningPayload } from '../types';
import { MarketChart } from './MarketChart';

interface ScanDetailsProps {
  data: SymbolScan[];
}

function formatPct(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)}%`;
}

function pctClass(value: number | null): string {
  if (value === null) return '';
  if (value >= 5) return 'pct-strong-up';
  if (value > 0) return 'pct-up';
  if (value <= -5) return 'pct-strong-down';
  if (value < 0) return 'pct-down';
  return '';
}

function classifyDelta(current: number | null, reference: number | null, strongThreshold = 0.05): string {
  if (current === null || reference === null || reference === 0) return '';
  const delta = (current - reference) / Math.abs(reference);
  if (delta >= strongThreshold) return 'pct-strong-up';
  if (delta > 0) return 'pct-up';
  if (delta <= -strongThreshold) return 'pct-strong-down';
  if (delta < 0) return 'pct-down';
  return '';
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

function DailyRow({ item, prev }: { item: DailyItem; prev: DailyItem | null }): JSX.Element {
  const closeClass = classifyDelta(item.c, item.o);
  const ma21Class = classifyDelta(item.c, item.ma21);
  const ma50Class = classifyDelta(item.c, item.ma50);
  const ma200Class = classifyDelta(item.c, item.ma200);
  const prevVolume = prev ? prev.v : null;
  const volumeClass = classifyDelta(item.v, prevVolume);

  return (
    <tr>
      <td>{item.date}</td>
      <td className={closeClass}>{item.c.toFixed(2)}</td>
      <td className={pctClass(item.pct)}>{formatPct(item.pct)}</td>
      <td className={ma21Class}>{item.ma21 ? item.ma21.toFixed(2) : '—'}</td>
      <td className={ma50Class}>{item.ma50 ? item.ma50.toFixed(2) : '—'}</td>
      <td className={ma200Class}>{item.ma200 ? item.ma200.toFixed(2) : '—'}</td>
      <td className={volumeClass}>{item.v.toLocaleString()}</td>
      <td>{renderWarnings(item.warnings_top)}</td>
      <td>{renderWarnings(item.warnings_bottom)}</td>
    </tr>
  );
}

function renderPostFtdMetrics(metrics: PostFTDMetrics | null): JSX.Element | null {
  if (!metrics) return null;

  return (
    <div className="post-ftd-summary">
      <div>
        <span className="post-ftd-label">監視日数</span>
        <span>{metrics.monitor_days}</span>
      </div>
      <div>
        <span className="post-ftd-label">MA50割れ</span>
        <span>{metrics.ma50_breaches}</span>
      </div>
      <div>
        <span className="post-ftd-label">出来高フェード</span>
        <span>{metrics.volume_fade_triggered ? 'あり' : 'なし'}</span>
      </div>
      <div>
        <span className="post-ftd-label">初動3日保持</span>
        <span>{metrics.ma50_held_first3 ? '維持' : '崩れ'}</span>
      </div>
    </div>
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
      <p className="legend-note">
        <strong>Volume bars:</strong>{' '}
        <span className="legend-swatch legend-volume-up">■</span> Close ≧ Open（上昇日）{' '}
        <span className="legend-swatch legend-volume-down">■</span> Close ＜ Open（下落日）
      </p>
      {data.map((symbol) => {
        const recentItems = symbol.items.slice(-15);
        const baseIndex = symbol.items.length - recentItems.length;
        return (
          <div key={symbol.symbol} style={{ marginBottom: 32 }}>
            <div className="section-title">{symbol.symbol} — {symbol.last_date}</div>
            <MarketChart items={symbol.items} />
            {renderPostFtdMetrics(symbol.post_ftd_metrics)}
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
                {recentItems.map((item, index) => {
                  const absoluteIndex = baseIndex + index;
                  const prev = absoluteIndex > 0 ? symbol.items[absoluteIndex - 1] : null;
                  return <DailyRow key={item.date} item={item} prev={prev} />;
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}
