/* app.js – FX Dashboard メインロジック */

// ── 設定 ────────────────────────────────────────────────
const CSV_URL =
  "https://raw.githubusercontent.com/SuperDaisy2025/fx-dashboard/main/data/usdjpy_10min.csv";

const RANGE_OPTIONS = [
  { label: "1D",  hours: 24 },
  { label: "3D",  hours: 72 },
  { label: "1W",  hours: 168 },
  { label: "2W",  hours: 336 },
  { label: "1M",  hours: 720 },
  { label: "3M",  hours: 2160 },
  { label: "ALL", hours: Infinity },
];

// ── 状態 ────────────────────────────────────────────────
let allData   = [];       // { t: Date, o, h, l, c, v }[]
let chart     = null;
let activeIdx = 3;        // デフォルト: 2W

// ── CSV パース ──────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split("\n").slice(1); // ヘッダー除外
  return lines
    .map((line) => {
      const [timestamp, open, high, low, close, volume] = line.split(",");
      const t = new Date(timestamp + "Z"); // UTC として解釈
      if (isNaN(t)) return null;
      return {
        t,
        o: parseFloat(open),
        h: parseFloat(high),
        l: parseFloat(low),
        c: parseFloat(close),
        v: parseFloat(volume) || 0,
      };
    })
    .filter(Boolean);
}

// ── データ取得 ──────────────────────────────────────────
async function loadData() {
  setStatus("loading");
  try {
    const res = await fetch(CSV_URL + "?t=" + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    allData = parseCSV(text);
    if (allData.length === 0) throw new Error("データが空です");
    updateStats();
    renderChart();
    setStatus("ok");
  } catch (err) {
    console.error(err);
    setStatus("error", err.message);
  }
}

// ── 統計情報 ────────────────────────────────────────────
function updateStats() {
  if (allData.length === 0) return;
  const latest   = allData.at(-1);
  const prev     = allData.at(-2);
  const change   = prev ? latest.c - prev.c : 0;
  const changePct= prev ? (change / prev.c) * 100 : 0;

  const dayAgo   = new Date(latest.t.getTime() - 86_400_000);
  const daySlice = allData.filter((d) => d.t >= dayAgo);
  const high24   = Math.max(...daySlice.map((d) => d.h));
  const low24    = Math.min(...daySlice.map((d) => d.l));

  el("stat-price").textContent   = latest.c.toFixed(3);
  el("stat-change").textContent  = `${change >= 0 ? "+" : ""}${change.toFixed(3)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`;
  el("stat-change").className    = "stat-value " + (change >= 0 ? "positive" : "negative");
  el("stat-high").textContent    = high24.toFixed(3);
  el("stat-low").textContent     = low24.toFixed(3);
  el("stat-updated").textContent = formatJST(latest.t);
}

// ── チャート描画 ────────────────────────────────────────
function getSlicedData() {
  const { hours } = RANGE_OPTIONS[activeIdx];
  if (hours === Infinity) return allData;
  const cutoff = new Date(Date.now() - hours * 3_600_000);
  return allData.filter((d) => d.t >= cutoff);
}

function renderChart() {
  const sliced = getSlicedData();
  const labels = sliced.map((d) => d.t);
  const values = sliced.map((d) => d.c);

  const ctx = el("fx-chart").getContext("2d");

  // グラデーション塗りつぶし
  const gradient = ctx.createLinearGradient(0, 0, 0, ctx.canvas.offsetHeight || 400);
  gradient.addColorStop(0,   "rgba(0, 212, 170, 0.25)");
  gradient.addColorStop(0.6, "rgba(0, 212, 170, 0.05)");
  gradient.addColorStop(1,   "rgba(0, 212, 170, 0)");

  if (chart) {
    chart.data.labels = labels;
    chart.data.datasets[0].data = values;
    chart.data.datasets[0].backgroundColor = gradient;
    chart.update("none");
    return;
  }

  chart = new Chart(ctx, {
    type: "line",
    plugins: [mondayPlugin],
    data: {
      labels,
      datasets: [
        {
          label: "USD/JPY",
          data: values,
          borderColor: "#00d4aa",
          borderWidth: 1.5,
          backgroundColor: gradient,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: "#00d4aa",
          tension: 0.1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,14,26,0.95)",
          borderColor: "rgba(0,212,170,0.3)",
          borderWidth: 1,
          titleColor: "#8892a4",
          bodyColor: "#e8eaf0",
          padding: 12,
          callbacks: {
            title: (items) => formatJST(new Date(items[0].parsed.x)),
            label: (item) => ` ${item.parsed.y.toFixed(3)} JPY`,
          },
        },
        crosshair: false,
      },
      scales: {
        x: {
          type: "time",
          time: {
            displayFormats: {
              minute: "MM/dd HH:mm",
              hour:   "MM/dd HH:mm",
              day:    "MM/dd",
              week:   "MM/dd",
              month:  "yyyy/MM",
            },
          },
          grid: { color: "rgba(255,255,255,0.04)" },
          ticks: {
            color: "#8892a4",
            maxTicksLimit: 8,
            maxRotation: 0,
          },
          border: { color: "rgba(255,255,255,0.06)" },
        },
        y: {
          position: "right",
          grid:  { color: "rgba(255,255,255,0.04)" },
          ticks: { color: "#8892a4" },
          border: { color: "rgba(255,255,255,0.06)" },
        },
      },
    },
  });
}

// ── 月曜日補助線プラグイン ──────────────────────────────
const mondayPlugin = {
  id: "mondayLines",
  afterDraw(chartInstance) {
    const { hours } = RANGE_OPTIONS[activeIdx];
    // 1W未満は補助線不要
    if (hours < 168) return;

    const xScale = chartInstance.scales.x;
    const yScale = chartInstance.scales.y;
    const ctx2   = chartInstance.ctx;
    const top    = yScale.top;
    const bottom = yScale.bottom;

    const sliced = getSlicedData();
    const seen   = new Set();

    sliced.forEach((d) => {
      // 月曜日 (getDay() === 1) かつ 00:00〜00:09 のデータで1本だけ描く
      if (d.t.getDay() !== 1) return;
      const dateKey = d.t.toISOString().slice(0, 10);
      if (seen.has(dateKey)) return;
      seen.add(dateKey);

      const x = xScale.getPixelForValue(d.t.getTime());
      if (x < xScale.left || x > xScale.right) return;

      // 補助線
      ctx2.save();
      ctx2.beginPath();
      ctx2.moveTo(x, top);
      ctx2.lineTo(x, bottom);
      ctx2.strokeStyle = "rgba(0, 212, 170, 0.2)";
      ctx2.lineWidth   = 1;
      ctx2.setLineDash([4, 4]);
      ctx2.stroke();

      // 日付ラベル
      const label = `${d.t.getMonth() + 1}/${d.t.getDate()}`;
      ctx2.setLineDash([]);
      ctx2.fillStyle = "rgba(0, 212, 170, 0.6)";
      ctx2.font      = "10px monospace";
      ctx2.textAlign = "center";
      ctx2.fillText(label, x, top - 4);
      ctx2.restore();
    });
  },
};


function setRange(idx) {
  activeIdx = idx;
  document.querySelectorAll(".range-btn").forEach((btn, i) => {
    btn.classList.toggle("active", i === idx);
  });
  renderChart();
}

function buildRangeButtons() {
  const wrap = el("range-buttons");
  RANGE_OPTIONS.forEach(({ label }, i) => {
    const btn = document.createElement("button");
    btn.className = "range-btn" + (i === activeIdx ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => setRange(i));
    wrap.appendChild(btn);
  });
}

// ── ステータス表示 ──────────────────────────────────────
function setStatus(state, msg = "") {
  const bar = el("status-bar");
  bar.className = "status-bar " + state;
  bar.querySelector(".status-text").textContent =
    state === "loading" ? "データ取得中…"
    : state === "error"   ? `⚠ ${msg}`
    :                       "最新データを表示中";
}

// ── ユーティリティ ──────────────────────────────────────
function el(id) { return document.getElementById(id); }

function formatJST(date) {
  return date.toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── PWA Service Worker 登録 ─────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .catch((e) => console.warn("SW registration failed:", e));
  });
}

// ── 初期化 ──────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  buildRangeButtons();
  loadData();

  el("refresh-btn").addEventListener("click", loadData);

  // 30分ごとに自動リフレッシュ
  setInterval(loadData, 30 * 60 * 1000);
});
