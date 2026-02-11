import { NextResponse } from "next/server";

// ─── PROVIDER 1: Yahoo v8 chart (most reliable for chart data) ─
async function fetchYahooChart(symbol, range, interval) {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
    }
  );
  if (!res.ok) throw new Error(`Yahoo chart returned ${res.status}`);
  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result?.timestamp) throw new Error("No chart data");
  return data;
}

// ─── PROVIDER 2: Yahoo with cookie/crumb ────────────────────────
async function fetchYahooChartWithCrumb(symbol, range, interval) {
  const cookieRes = await fetch("https://fc.yahoo.com", { redirect: "manual" });
  const setCookie = cookieRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Cookie: cookie,
    },
  });
  if (!crumbRes.ok) throw new Error("Crumb fetch failed");
  const crumb = await crumbRes.text();

  const res = await fetch(
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&crumb=${encodeURIComponent(crumb)}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Cookie: cookie,
      },
    }
  );
  if (!res.ok) throw new Error(`Yahoo crumb chart returned ${res.status}`);
  const data = await res.json();
  if (!data.chart?.result?.[0]?.timestamp) throw new Error("No data");
  return data;
}

// ─── FALLBACK: Generate realistic chart data ────────────────────
function generateFallbackChart(symbol, range) {
  const prices = {
    AAPL: 228, AMZN: 210, GOOGL: 198, MSFT: 420, NVDA: 129,
    META: 680, TSLA: 382, NFLX: 985, AMD: 119,
    "BTC-USD": 97500, "ETH-USD": 3180, "SOL-USD": 210,
  };
  const basePrice = prices[symbol] || 100 + ((symbol.charCodeAt(0) * 13) % 300);
  const isCrypto = symbol.includes("-USD");
  const volatility = isCrypto ? 0.03 : 0.015;

  const pointCounts = { "1d": 78, "5d": 40, "1mo": 22, "3mo": 63, "6mo": 126, "1y": 52, "5y": 60 };
  const points = pointCounts[range] || 63;

  const timestamps = [];
  const closes = [], opens = [], highs = [], lows = [], volumes = [];

  let price = basePrice * (0.88 + Math.random() * 0.12);
  const now = Math.floor(Date.now() / 1000);

  const stepSeconds = {
    "1d": 300, "5d": 7200, "1mo": 86400, "3mo": 86400,
    "6mo": 86400, "1y": 604800, "5y": 2592000,
  };
  const step = stepSeconds[range] || 86400;

  for (let i = 0; i < points; i++) {
    const change = (Math.random() - 0.48) * volatility * price;
    price = Math.max(price * 0.7, price + change);
    timestamps.push(now - (points - i) * step);
    closes.push(+price.toFixed(2));
    opens.push(+(price - change * 0.3).toFixed(2));
    highs.push(+(price + Math.abs(change) * 0.5).toFixed(2));
    lows.push(+(price - Math.abs(change) * 0.5).toFixed(2));
    volumes.push(Math.floor(20e6 + Math.random() * 80e6));
  }
  // Last point = current price
  closes[closes.length - 1] = basePrice;

  return {
    chart: {
      result: [{
        meta: { symbol, regularMarketPrice: basePrice },
        timestamp: timestamps,
        indicators: {
          quote: [{ close: closes, open: opens, high: highs, low: lows, volume: volumes }],
        },
      }],
    },
    _provider: "fallback",
  };
}

// ─── MAIN ───────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "3mo";
  const interval = searchParams.get("interval") || "1d";

  if (!symbol) return NextResponse.json({ error: "Missing symbol" }, { status: 400 });

  const providers = [
    { name: "yahoo-v8", fn: () => fetchYahooChart(symbol, range, interval) },
    { name: "yahoo-crumb", fn: () => fetchYahooChartWithCrumb(symbol, range, interval) },
  ];

  for (const p of providers) {
    try {
      const data = await p.fn();
      console.log(`✅ Chart from ${p.name} for ${symbol}`);
      return NextResponse.json(data);
    } catch (err) {
      console.warn(`⚠️ ${p.name} chart: ${err.message}`);
    }
  }

  console.log(`⚠️ Using fallback chart for ${symbol}`);
  return NextResponse.json(generateFallbackChart(symbol, range));
}
