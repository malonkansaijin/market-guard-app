import { useMemo, useState } from 'react';
import { fetchScan, fetchSummary } from './api/client';
import { useApi } from './hooks/useApi';
import { SummaryTable } from './components/SummaryTable';
import { ScanDetails } from './components/ScanDetails';
import type { SymbolOverview, SymbolScan } from './types';

const DEFAULT_SYMBOLS = '^N225,SPY,QQQ';
const DEFAULT_DAYS = 120;

export default function App(): JSX.Element {
  const [symbols, setSymbols] = useState(DEFAULT_SYMBOLS);
  const [days, setDays] = useState(DEFAULT_DAYS);

  const summaryState = useApi<SymbolOverview[]>(
    () => fetchSummary(symbols, days),
    [symbols, days]
  );

  const scanState = useApi<SymbolScan[]>(
    () => fetchScan(symbols, days),
    [symbols, days]
  );

  const isLoading = summaryState.loading || scanState.loading;
  const errorMessage = summaryState.error ?? scanState.error;

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const symbolsValue = String(formData.get('symbols') ?? DEFAULT_SYMBOLS).toUpperCase();
    const daysValue = Number(formData.get('days') ?? DEFAULT_DAYS);
    setSymbols(symbolsValue);
    setDays(daysValue);
  };

  const summaryData = useMemo(() => summaryState.data ?? [], [summaryState.data]);
  const scanData = useMemo(() => scanState.data ?? [], [scanState.data]);

  return (
    <div className="app-shell">
      <div className="card">
        <h2>Market Guard Dashboard</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <label>
            Symbols
            <input
              type="text"
              name="symbols"
              defaultValue={symbols}
              style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5f5' }}
            />
          </label>
          <label>
            Days
            <input
              type="number"
              min={30}
              max={365}
              name="days"
              defaultValue={days}
              style={{ marginLeft: 8, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5f5', width: 80 }}
            />
          </label>
          <button type="submit" style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3b82f6', color: '#fff', fontWeight: 600 }}>更新</button>
        </form>
      </div>

      {isLoading && <div className="loading">読み込み中...</div>}
      {errorMessage && <div className="error">エラー: {errorMessage}</div>}

      {!isLoading && !errorMessage && summaryData.length > 0 && (
        <SummaryTable data={summaryData} />
      )}

      {!isLoading && !errorMessage && scanData.length > 0 && (
        <ScanDetails data={scanData} />
      )}
    </div>
  );
}
