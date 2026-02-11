// ─── FORMATTING ─────────────────────────────────────────────────
export const fmt = (n, d = 2) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(d)}T`;
  if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(d)}B`;
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(d)}M`;
  return n.toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
};

export const fmtPrice = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// ─── THEME ──────────────────────────────────────────────────────
export const theme = {
  bg: "#06080c",
  surface: "#0c1017",
  surfaceHover: "#111820",
  border: "rgba(255,255,255,0.06)",
  borderHover: "rgba(255,255,255,0.12)",
  text: "#c8cdd3",
  textDim: "#5a6270",
  textBright: "#eef0f3",
  accent: "#00d4aa",
  accentDim: "rgba(0,212,170,0.15)",
  red: "#ff4757",
  redDim: "rgba(255,71,87,0.12)",
  amber: "#ffb347",
  blue: "#4e9af5",
  purple: "#a78bfa",
};

export const pctColor = (v) => (v >= 0 ? theme.accent : theme.red);

// ─── TECHNICALS ─────────────────────────────────────────────────
export const calcSMA = (data, period) => {
  return data.map((_, i) => {
    if (i < period - 1) return null;
    const slice = data.slice(i - period + 1, i + 1);
    return slice.reduce((s, d) => s + (d.close || 0), 0) / period;
  });
};

export const calcRSI = (data, period = 14) => {
  const rsi = new Array(data.length).fill(null);
  if (data.length < period + 1) return rsi;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = (data[i].close || 0) - (data[i - 1].close || 0);
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < data.length; i++) {
    const diff = (data[i].close || 0) - (data[i - 1].close || 0);
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? -diff : 0)) / period;
    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return rsi;
};

export const calcBollinger = (data, period = 20) => {
  return data.map((_, i) => {
    if (i < period - 1) return { upper: null, lower: null, mid: null };
    const slice = data.slice(i - period + 1, i + 1).map((d) => d.close || 0);
    const mean = slice.reduce((s, v) => s + v, 0) / period;
    const variance = slice.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / period;
    const std = Math.sqrt(variance);
    return { upper: mean + 2 * std, lower: mean - 2 * std, mid: mean };
  });
};

// ─── DATA FETCHING (client-side, hits our API routes) ───────────
export const fetchQuotes = async (symbols) => {
  try {
    const res = await fetch(`/api/quote?symbols=${symbols.join(",")}`);
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    const result = data.quoteResponse?.result || [];
    // Attach provider info
    result._provider = data._provider || "unknown";
    return result;
  } catch {
    return [];
  }
};

export const fetchChart = async (symbol, range, interval) => {
  try {
    const res = await fetch(`/api/chart?symbol=${symbol}&range=${range}&interval=${interval}`);
    if (!res.ok) throw new Error("API failed");
    const data = await res.json();
    const result = data.chart?.result?.[0];
    if (!result) throw new Error("No data");
    const timestamps = result.timestamp || [];
    const quotes = result.indicators?.quote?.[0] || {};
    return timestamps
      .map((t, i) => {
        const d = new Date(t * 1000);
        return {
          time:
            range === "1d"
              ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : range === "5d"
              ? d.toLocaleDateString([], { weekday: "short", hour: "2-digit", minute: "2-digit" })
              : d.toLocaleDateString([], { month: "short", day: "numeric" }),
          close: quotes.close?.[i] ? +quotes.close[i].toFixed(2) : null,
          open: quotes.open?.[i] ? +quotes.open[i].toFixed(2) : null,
          high: quotes.high?.[i] ? +quotes.high[i].toFixed(2) : null,
          low: quotes.low?.[i] ? +quotes.low[i].toFixed(2) : null,
          volume: quotes.volume?.[i] || 0,
        };
      })
      .filter((d) => d.close !== null);
  } catch {
    return [];
  }
};

export const fetchAnalysis = async (params) => {
  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      return { error: data.error || `HTTP ${res.status}`, detail: data.detail || "" };
    }
    return data;
  } catch (error) {
    return { error: `Network error: ${error.message}` };
  }
};

// ─── RANGES ─────────────────────────────────────────────────────
export const RANGES = [
  { label: "1D", value: "1d", interval: "5m" },
  { label: "5D", value: "5d", interval: "15m" },
  { label: "1M", value: "1mo", interval: "30m" },
  { label: "3M", value: "3mo", interval: "1d" },
  { label: "6M", value: "6mo", interval: "1d" },
  { label: "1Y", value: "1y", interval: "1wk" },
  { label: "5Y", value: "5y", interval: "1mo" },
];

export const DEFAULT_WATCHLIST = ["AAPL", "AMZN", "GOOGL", "MSFT", "NVDA", "META", "TSLA", "BTC-USD", "ETH-USD"];
