# Project: market-guard — CAN-SLIM 天井/底 兆候アラート

## Goal
無料・低遅延の公開データ（日足×出来高）から **CAN-SLIM** に基づく **天井兆候（Top）／底兆候（Bottom）** を自動検出し、  
**警告（warnings）を日付ごとに付与**、UIで**色付け**して可視化する。

## Constraints
- データ: Yahoo Finance（`yfinance`）の日足（Open/High/Low/Close/Volume）
- 近似: 指数は **ETF** を利用（`SPY`=S&P500, `QQQ`=Nasdaq）
- 無料・遅延少：日次ベースで十分。リアルタイム不要
- 実装: Python（FastAPI or Typer CLI）＋任意のフロント（Vite+React想定）。単純 REST JSON

---

## API (Backend)
### `GET /scan?symbols=SPY,QQQ&days=180`
- 期間の OHLCV を取得→指標計算→**日別 warnings を付与**して返す
- 返却: `SymbolSummary[]`（下記スキーマ）

### `GET /summary?symbols=SPY,QQQ`
- 直近の**集計サマリ**（DDカウント、最新レジーム、FTDの有効/失効 状態、未読の高優先アラート数）

> 初回ロードは `/` → `/scan` へリダイレクトでも可（ブラウザ開くだけで表が出る UX）

---

## Data Schema
```json
// SymbolSummary
{
  "symbol": "QQQ",
  "last_date": "2025-11-03",
  "regime": "Uptrend | UnderPressure | Correction | Neutral",
  "dd_25d": 5,
  "churn_25d": 2,
  "ftd": { "date": "2025-10-24", "status": "active | invalidated | none" },
  "items": [ /* DailyItem[] 時系列（昇順） */ ]
}

// DailyItem
{
  "date": "2025-11-03",
  "o": 0, "h": 0, "l": 0, "c": 429.12, "v": 51234567,
  "ma21": 426.8, "ma50": 432.4, "ma200": 410.2,
  "pct": -0.45,
  "warnings_top": [ Warning ],
  "warnings_bottom": [ Warning ]
}

// Warning
{
  "type": "top | bottom",
  "code": "DD | DD_CLUSTER | CHURN | MA21_BELOW | MA50_BREAK | MA21_RECLAIM | RALLY_DAY1 | FTD | FTD_INVALID",
  "severity": "info | watch | alert | high | invalidated",
  "message": "FTD: day1から6日目に+1.9% & vol↑",
  "evidence": { "pct": 1.92, "vol_ratio": 1.18, "day1": "2025-10-24" },
  "ttl_days": 25
}
```

---

## Detection Rules (CAN-SLIM 準拠・最小セット)

### Top signals（天井兆候）
- **T1: Distribution Day（DD）**  
  条件: `pct_change <= -0.2%` **かつ** `volume > prev_volume`  
  期限: **25 営業日**で消化 → `ttl_days=25`  
  severity: `watch`
- **T2: DD Cluster（蓄積）**  
  条件: 直近25日で **DD ≥ 4 → alert**, **DD ≥ 6 → high**  
  補助: 直近25日 **CHURN ≥ 2** で +1段階（任意）
- **T3: MA 悪化**  
  `c < ma21` → `watch` / `c < ma50` **かつ** `volume > prev` → `alert`
- **T4: 反発の質低下**（任意）  
  直近5日で **上昇日なのに出来高減 ≥ 3** → `watch`

### Bottom signals（底兆候）
- **B1: Rally Attempt（Day1）**  
  重要安値の翌日以降、**前日安値を下抜かず陽線でクローズ** → `info`
- **B2: Follow-Through Day（FTD）**  
  `day1` から **4〜10 営業日**の間に **+1.7% 以上 & volume>prev** → `alert`  
  **失効条件**:  
  - FTD後 **5営業日以内**に **DD ≥ 2**   
  - または **Day1 の安値を下抜け**  
  → `FTD_INVALID`（`invalidated`）
- **B3: MA21 奪回**  
  `cross_up(c, ma21)` **かつ** `volume>prev` → `watch`（底確認の裏付け）

### Regime（参考）
- `Correction`: `dd_25d ≥ 6` **or** `c < ma50`  
- `UnderPressure`: `dd_25d ≥ 4` **or** `c < ma21`  
- `Uptrend`: `FTD active`  
- それ以外: `Neutral`

---

## Pseudocode (Detector)
```python
for each symbol:
  df = fetch_ohlcv(symbol, days)
  calc_ma(df, [21, 50, 200])
  df['pct'] = df['c'].pct_change()*100
  df['DD'] = (df['pct'] <= -0.2) & (df['v'] > df['v'].shift(1))
  df['CHURN'] = (abs(df['pct']) <= 0.2) & (df['v'] > df['v'].shift(1))

  # warnings per day
  for i in range(1, len(df)):
    warn_top, warn_bottom = [], []

    if df.DD[i]: warn_top += [W("DD","watch",ttl=25, evidence=...)]
    if df.c[i] < df.ma50[i] and df.v[i] > df.v[i-1]:
        warn_top += [W("MA50_BREAK","alert")]
    elif df.c[i] < df.ma21[i]:
        warn_top += [W("MA21_BELOW","watch")]

    # Rally/FTD
    day1 = detect_rally_day1(df)      # 最直近のみでよい
    ftd  = detect_ftd(df, day1)       # 4~10日窓で +1.7% & vol↑
    if day1 == i: warn_bottom += [W("RALLY_DAY1","info")]
    if ftd == i:  warn_bottom += [W("FTD","alert", evidence=...)]

    # 失効
    if ftd_active and (dd_count_within(ftd_day, 5) >= 2 or undercut_day1_low):
        warn_bottom += [W("FTD_INVALID","invalidated")]

    attach_to_daily_item(i, warn_top, warn_bottom)

  # cluster summary
  dd_25 = rolling_sum(df.DD, 25).iloc[-1]
  add_cluster_warnings(dd_25, churn_25, ...)
```

---

## UI Spec（色付け）
- **ローソク背景/下に点描**  
  - `DD`: **淡赤丸**  
  - `CHURN`: **橙三角**  
  - `FTD`: **濃緑縦線＋ラベル**  
  - `MA21_BELOW/MA50_BREAK`: ローソク縁を **黄/赤**  
  - `MA21_RECLAIM`: **薄緑**縁
- **テーブル**  
  - `warnings_top` / `warnings_bottom` の件数を **バッジ**表示  
  - DD クラスタ `alert/high` は**上部バナー**で1行通知
- **初期表示**  
  - アプリ起動→自動で `/scan` を fetch → テーブル＋Sparkline 表示  
  - バナーで **FTD 有効化/失効** と **DDクラスタ到達**を即時通知

---

## Config (閾値の外出し)
`.env` などで調整可能にする：
```
DD_DROP_PCT=-0.2
FTD_WINDOW_MIN=4
FTD_WINDOW_MAX=10
FTD_GAIN_PCT=1.7
DD_CLUSTER_ALERT=4
DD_CLUSTER_HIGH=6
DD_TTL_DAYS=25
MA50_BREAK_VOLCONFIRM=true
```

---

## Acceptance Criteria
- `GET /scan` が **SymbolSummary** を返し、**各日**に `warnings_top/bottom` が付与される
- `DD` は 25 営業日で自動消滅（TTL）
- `FTD` が **4〜10日窓**で正しく検出され、**失効条件**で `FTD_INVALID` を返す
- `regime` が仕様どおりに決定される
- フロントで **色付け**・**バナー通知**・**件数バッジ** が表示される
- 依存は `yfinance pandas numpy`（＋サーバは FastAPI など）で完結

---

## Tasks (優先順)
1. Fetch 層：OHLCV 取得・MA 計算
2. Detector：DD/CHURN, Rally, FTD, 失効, MA 交差
3. Cluster 集計：25日ロールで DD/CHURN カウント
4. Regime 付与
5. API 実装：`/scan`, `/summary`
6. UI：初回オート `/scan`、表＋Sparkline、色付け、バナー
7. パラメータ外出し・ユニットテスト

---

### Notes
- 先導株のブレイク失敗や市場の広がり（A/D、Up/Down Volume）は**拡張フェーズ**で追加可能。まずは**上記3本柱**（DD系・MA系・Rally→FTD）で MVP を完成させる。
