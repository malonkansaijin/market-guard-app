# Backend Setup

## 1. 仮想環境と依存パッケージ

```bash
cd backend
python -m venv .venv
source .venv/bin/activate           # PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt      # requirements.txt がある場合
# まだ requirements.txt を作っていない場合は:
pip install fastapi uvicorn[standard] yfinance pandas numpy rich
```

## 2. サーバの起動

```bash
uvicorn app.main:app --reload
```

- http://127.0.0.1:8000/scan?symbols=SPY,QQQ
- http://127.0.0.1:8000/summary?symbols=SPY,QQQ
- Swagger UI: http://127.0.0.1:8000/docs

## 3. 環境変数で調整できる閾値

`backend/app/config.py` の `ThresholdConfig` が下記の値を読み込みます。設定しない場合はデフォルト値が使われます。

| 変数 | 既定値 | 内容 |
|------|--------|------|
| `DD_TTL_DAYS` | `25` | Distribution Day の寿命（日数） |
| `DD_DROP_PCT` | `-0.2` | DD 判定の下落率しきい値（%） |
| `CHURN_RANGE` | `0.2` | Churn 判定の値幅（%） |
| `FTD_WINDOW_MIN` | `4` | FTD 判定の下限営業日 |
| `FTD_WINDOW_MAX` | `10` | FTD 判定の上限営業日 |
| `FTD_GAIN_PCT` | `1.7` | FTD 判定の上昇率しきい値（%） |
| `DD_CLUSTER_ALERT` | `4` | DD クラスタ警戒レベル |
| `DD_CLUSTER_HIGH` | `6` | DD クラスタ高警戒レベル |
| `CHURN_CLUSTER_BOOST` | `2` | Churn がクラスタ警戒レベルを引き上げる件数 |

例:
```bash
export DD_DROP_PCT=-0.3
export FTD_GAIN_PCT=2.0
uvicorn app.main:app --reload
```

## 4. サンプルレスポンス

`backend/samples/scan_SPY_QQQ.json` と `backend/samples/summary_SPY_QQQ.json` に API のサンプル出力を保存しています。フロントエンド実装時のモックや仕様確認に利用できます。

## 5. 簡易テスト

サンプル JSON が最新のスキーマに沿っているか確認するためのテストを用意しています。

```bash
cd backend
source .venv/bin/activate
pytest
```

（`pytest` が未インストールなら `pip install pytest` で追加してください。）
