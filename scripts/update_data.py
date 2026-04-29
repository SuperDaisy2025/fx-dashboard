"""
update_data.py
直近5日分の5分足を10分足に間引いてCSVに追記・重複削除する。
GitHub Actions から毎日自動実行される。
"""

import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

OUTPUT_PATH = Path("data/usdjpy_10min.csv")
TICKER = "JPY=X"
LOOKBACK_DAYS = 5  # 直近何日分を取得するか


def fetch_recent_5min() -> pd.DataFrame:
    end = datetime.utcnow()
    start = end - timedelta(days=LOOKBACK_DAYS)
    print(f"取得範囲: {start.date()} ～ {end.date()}  (5分足)")

    df = yf.download(
        TICKER,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        interval="5m",
        auto_adjust=True,
        progress=False,
    )

    if df.empty:
        raise RuntimeError("データを取得できませんでした。")

    df = df.reset_index()
    df.columns = [c.lower() for c in df.columns]

    for col in ("datetime", "date", "index"):
        if col in df.columns:
            df = df.rename(columns={col: "timestamp"})
            break

    df = df[["timestamp", "open", "high", "low", "close", "volume"]]
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True)
    return df


def resample_to_10min(df: pd.DataFrame) -> pd.DataFrame:
    """5分足 → 10分足 OHLCV リサンプル"""
    df = df.set_index("timestamp").sort_index()
    resampled = df.resample("10min").agg(
        {
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
        }
    ).dropna(subset=["open"])
    resampled = resampled.reset_index()
    resampled["timestamp"] = resampled["timestamp"].dt.strftime("%Y-%m-%d %H:%M:%S")
    return resampled


def merge_and_save(new_df: pd.DataFrame):
    if OUTPUT_PATH.exists():
        existing = pd.read_csv(OUTPUT_PATH)
        merged = pd.concat([existing, new_df], ignore_index=True)
    else:
        print("⚠️  既存CSVが見つかりません。新規作成します。")
        merged = new_df

    merged = merged.drop_duplicates(subset="timestamp")
    merged = merged.sort_values("timestamp")
    merged.to_csv(OUTPUT_PATH, index=False)
    print(f"✅ CSV更新完了: {OUTPUT_PATH}  (合計 {len(merged)} 行)")


def main():
    raw = fetch_recent_5min()
    resampled = resample_to_10min(raw)
    merge_and_save(resampled)


if __name__ == "__main__":
    main()
