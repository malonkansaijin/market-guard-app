# Project: market-guard
Goal: 無料・低遅延の公開データで、O'Neil流の市場判定を CLI で可視化する。
Deliverable: 単一ファイル `market_guard.py`（Python3）。依存は pip で入る一般的ライブラリのみ。

## Requirements
- データ: Yahoo Finance 無料API（yfinance）。指数の近似として ETF を使用（SPY= S&P500, QQQ= Nasdaq）。
- 指標:
  - DD(Distribution Day): 「前日比 -0.2% 以下」かつ「出来高 前日比 増」。
  - 失速/Churn: 「前日比 ±0.2% 以内」かつ「出来高 前日比 増」（参考カウント）。
  - FTD(Follow-Through Day): 底らしき日から 4〜10 営業日後、前日比 +1.7% 以上かつ出来高増。
  - 21/50/200 日移動平均。
  - 直近 25 営業日の DD/Churn カウント（DD は25日で消化）。
- レジーム判定（簡易版でOK）:
  - Correction: DD>=6 または 終値<MA50
  - Under Pressure: DD>=4 または 終値<MA21
  - Uptrend: 有効FTDがある
  - それ以外は Neutral
- CLI:
  - `scan` コマンド: 既定は SPY,QQQ / 期間120日。表形式で Regime, Close, DD(25d), Churn(25d), FTD日付, 21/50/200, スパークラインを出力。
  - `plot` コマンド: PNG グラフ保存（終値, MA21/50/200, DDマーカー, FTD縦線）。
  - オプション: `--symbols SPY,QQQ,XLK`, `--days 180`, `--out charts` 等。
- 端末出力: `rich` を使って見やすく。グラフは `matplotlib`。
- コード品質: 1ファイル完結、関数に分割、コメント最小限で可読性重視。

## Non-Goals
- リアルタイム足・板、証券会社APIは使わない。
- 過度なパラメータ化や GUI 化は不要。

## Acceptance Criteria
- `python -m venv .venv && source .venv/bin/activate`
- `pip install yfinance pandas numpy rich typer matplotlib`
- `python market_guard.py scan` 実行で SPY/QQQ の表が出る。
- `python market_guard.py plot --out charts` 実行で PNG が保存される。
- DD/FTD の定義は上記要件どおり実装されている。
- コマンドとオプションのヘルプが `--help` で表示される。

## Nice to have（任意）
- 先導株の簡易チェック（例: 引数で銘柄列を渡し、50日線割れ件数を表示）。
- FTD 検出の候補一覧表示。

## Implement now
- 上記仕様で `market_guard.py` を生成し、必要パッケージと使い方を docstring に記述。

---

## Summary (2025-11-02 時点)
- `market_guard.py` を FastAPI バックエンド＋React フロントへ発展。`/scan` と `/summary` API が CAN-SLIM 指標・警告を JSON 返却し、フロントはダッシュボード表示。
- `backend/app/config.py` で閾値を環境変数化。サンプルレスポンス（`backend/samples/*.json`）と Pytest（`backend/tests/test_samples.py`）でスキーマ検証。
- フロント（Vite + React）は Summary 表と詳細テーブルを実装。デフォルト銘柄は `^N225,SPY,QQQ`。`npm install` → `npm run dev` で起動。
- MarketChart コンポーネントはローソク足＋MA21/50/200 を上段、出来高バーを下段に分離。警告はアノテーションで表示し、MA ラインは `connectNulls` で常時線表示。
- 最新コミット: `Add frontend dashboard and CAN-SLIM API enhancements`（`main` に push 済み）。
