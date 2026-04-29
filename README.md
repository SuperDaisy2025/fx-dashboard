# FX Dashboard – USD/JPY

USD/JPY 為替レートを自動収集・GitHub Pages で可視化する PWA です。

## 📁 構成

```
fx-dashboard/
├── data/
│   └── usdjpy_10min.csv          # 為替データ（自動更新）
├── scripts/
│   ├── init_data.py              # 初期データ作成（手動1回）
│   └── update_data.py            # 日次更新（GitHub Actions）
├── web/
│   ├── index.html                # PWA フロント
│   ├── app.js                    # Chart.js ロジック
│   ├── sw.js                     # Service Worker
│   └── manifest.json             # PWA マニフェスト
└── .github/workflows/
    └── update.yml                # GitHub Actions ワークフロー
```

---

## 🚀 セットアップ手順

### Step 1 : リポジトリ作成

1. GitHub で新しいリポジトリ（例: `fx-dashboard`）を **Public** で作成
2. このファイル一式をプッシュ

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/YOUR_USERNAME/fx-dashboard.git
git push -u origin main
```

---

### Step 2 : GitHub Actions の書き込み権限を設定

> Actions から CSV を push するために必要な設定です。

1. リポジトリページで **Settings** タブを開く
2. 左メニューの **Actions → General** をクリック
3. ページ下部の **"Workflow permissions"** セクションを探す
4. **"Read and write permissions"** を選択して **Save**

```
Settings > Actions > General > Workflow permissions
  ○ Read repository contents and packages permissions
  ● Read and write permissions  ← これを選択
```

これで `GITHUB_TOKEN` が自動的に書き込み権限を持ちます。  
**個人用 Personal Access Token (PAT) の作成は不要**です。

---

### Step 3 : GitHub Pages を設定

1. **Settings → Pages**
2. Source: **Deploy from a branch**
3. Branch: `main` / Folder: **`/web`** を選択して **Save**

数分後、`https://YOUR_USERNAME.github.io/fx-dashboard/` で公開されます。

---

### Step 4 : app.js の CSV URL を書き換え

`web/app.js` の先頭にある `CSV_URL` を自分のリポジトリに合わせて変更してください。

```js
// 変更前
const CSV_URL = "https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO/main/data/usdjpy_10min.csv";

// 変更後（例）
const CSV_URL = "https://raw.githubusercontent.com/taro-yamada/fx-dashboard/main/data/usdjpy_10min.csv";
```

---

### Step 5 : 初期データ作成（手動・初回のみ）

ローカル環境で一度だけ実行します。

```bash
pip install yfinance pandas
python scripts/init_data.py
```

生成された `data/usdjpy_10min.csv` をコミット・プッシュします。

```bash
git add data/usdjpy_10min.csv
git commit -m "add initial data"
git push
```

---

### Step 6 : 自動更新の確認

GitHub Actions タブで **"Update FX Data"** ワークフローを確認できます。

- 自動実行: 毎日 00:00 UTC（日本時間 09:00）
- 手動実行: ワークフロー画面の **"Run workflow"** ボタンで即時実行可能

---

## ⚠️ 注意事項

| 項目 | 内容 |
|------|------|
| データソース | Yahoo Finance (無料・非商用推奨) |
| 5分足の取得期限 | yfinance は直近60日分のみ取得可能 |
| 為替市場の休場 | 週末・祝日はデータなし（正常） |
| CORS | `raw.githubusercontent.com` はCORSヘッダーが付くため fetch 可能 |
| PWAアイコン | `web/icons/` フォルダに `icon-192.png` と `icon-512.png` を追加するとホーム画面追加が綺麗になります |

---

## 🛠️ ローカル確認

GitHub Pages と同じ環境でローカル確認したい場合:

```bash
# Python の簡易サーバー
cd web
python -m http.server 8080
# → http://localhost:8080 で確認
```

> **注意**: `file://` では Service Worker が動作しません。必ず `http://localhost` 経由で確認してください。
