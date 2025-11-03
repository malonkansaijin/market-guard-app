import type { MarketContext } from '../types';

interface MarketContextCardProps {
  context: MarketContext;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function MarketContextCard({ context }: MarketContextCardProps): JSX.Element {
  const { breadth, leading } = context;

  return (
    <div className="card">
      <h2>Market Context</h2>
      <div className="context-grid">
        <div>
          <h3 className="context-subtitle">Breadth Snapshot</h3>
          <ul className="context-list">
            <li>
              <strong>{breadth.above_ma50}/{breadth.total}</strong> above MA50&nbsp;
              <span className="context-muted">({formatPct(breadth.above_ma50_pct)})</span>
            </li>
            <li>
              <strong>{breadth.above_ma21}/{breadth.total}</strong> above MA21&nbsp;
              <span className="context-muted">({formatPct(breadth.above_ma21_pct)})</span>
            </li>
            <li>
              <strong>{breadth.positive_close}/{breadth.total}</strong> positive day&nbsp;
              <span className="context-muted">({formatPct(breadth.positive_close_pct)})</span>
            </li>
          </ul>
        </div>
        <div>
          <h3 className="context-subtitle">Leading Stocks</h3>
          <ul className="context-list">
            <li>
              <strong>{leading.below_ma50}/{leading.total}</strong> below MA50&nbsp;
              <span className="context-muted">({formatPct(leading.below_ma50_pct)})</span>
            </li>
          </ul>
          <div className="context-leaders">
            {leading.symbols.map((item) => (
              <div key={item.symbol} className="context-leader-row">
                <span className="context-leader-symbol">{item.symbol}</span>
                <span className="context-leader-metric">
                  <span>{item.close.toFixed(2)}</span>
                  <span className={`badge ${item.below_ma50 ? 'alert' : 'info'}`}>
                    {item.below_ma50 ? '↓ MA50' : '↑ MA50'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
