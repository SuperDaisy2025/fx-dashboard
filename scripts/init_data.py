import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

OUTPUT_PATH = Path("data/usdjpy_10min.csv")
TICKER = "JPY=X"


def fetch_hourly_data() -> pd.DataFrame:
    end = datetime.utcnow()
    start = end - timedelta(days=365)
    print(f"取得範囲: {start.date()} ～ {end.date()}  (1時間足)")

    df = yf.download(
        TICKER,
        start=start.strftime("%Y-%m-%d"),
        end=end.strftime("%Y-%m-%d"),
        interval="1h",
        auto_adjust=True,
        progress=False,
        group_by="column",
    )

    print("取得直後のカラム:", df.columns.tolist())
    print("インデックス名:", df.index.name)

    # MultiIndex をフラット化
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0].lower() for col in df.columns]
    else:
        df.columns = [c.lower() for c in df.columns]

    print("フラット化後のカラム:", df.columns.tolist())

    # インデックス（日時）を列に変換
    df = df.reset_index()
    df.columns = [c.lower() if isinstance(c, str) else c for c in df.columns]

    print("reset_index後のカラム:", df.columns.tolist())

    # timestamp列を特定
    for col in ("datetime", "date", "price", "index"):
        if col in df.columns:
            df = df.rename(columns={col: "timestamp"})
            break

    # 最初の列がtimestampでない場合は強制的にリネーム
    if "timestamp" not in df.columns:
        df = df.rename(columns={df.columns[0]: "timestamp"})

    print("最終カラム:", df.columns.tolist())

    df = df[["timestamp", "open", "high", "low", "close", "volume"]]
    df["timestamp"] = pd.to_datetime(df["timestamp"], utc=True).dt.strftime(
        "%Y-%m-%d %H:%M:%S"
    )
    df = df.sort_values("timestamp").drop_duplicates(subset="timestamp")
    return df


def main():
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    df = fetch_hourly_data()
    df.to_csv(OUTPUT_PATH, index=False)
    print(f"✅ 初期データ保存完了: {OUTPUT_PATH}  ({len(df)} 行)")


if __name__ == "__main__":
    main()
