import type { SymbolOverview, SymbolScan } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8000';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }

  return await response.json() as T;
}

export async function fetchSummary(symbols: string, days: number): Promise<SymbolOverview[]> {
  const query = new URLSearchParams({ symbols, days: days.toString() });
  return await fetchJson<SymbolOverview[]>(`/summary?${query.toString()}`);
}

export async function fetchScan(symbols: string, days: number): Promise<SymbolScan[]> {
  const query = new URLSearchParams({ symbols, days: days.toString() });
  return await fetchJson<SymbolScan[]>(`/scan?${query.toString()}`);
}
