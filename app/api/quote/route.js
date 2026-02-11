import { NextResponse } from "next/server";

// ─── PROVIDER 1: Yahoo Finance (cookie/crumb auth) ─────────────
async function fetchYahooQuotes(symbols) {
  const cookieRes = await fetch("https://fc.yahoo.com", { redirect: "manual" });
  const setCookie = cookieRes.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];

  const crumbRes = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Cookie: cookie,
    },
  });
  if (!crumbRes.ok) throw new Error("Failed to get crumb");
  const crumb = await crumbRes.text();

  const res = await fetch(
    `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}&crumb=${encodeURIComponent(crumb)}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Cookie: cookie,
      },
    }
  );
  if (!res.ok) throw new Error(`Yahoo v7 returned ${res.status}`);
  const data = await res.json();
  const result = data.quoteResponse?.result;
  if (!result || result.length === 0) throw new Error("No results");
  return result;
}

// ─── PROVIDER 2: Yahoo Finance scrape endpoint ──────────────────
async function fetchYahooScrape(symbolList) {
  const results = await Promise.all(
    symbolList.slice(0, 10).map(async (sym) => {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?range=1d&interval=1d`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          }
        );
        if (!res.ok) return null;
        const data = await res.json();
        const meta = data.chart?.result?.[0]?.meta;
        if (!meta || !meta.regularMarketPrice) return null;
        return {
          symbol: sym,
          shortName: meta.shortName || sym.replace("-USD", ""),
          regularMarketPrice: meta.regularMarketPrice,
          regularMarketChange: meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose || 0),
          regularMarketChangePercent:
            ((meta.regularMarketPrice - (meta.chartPreviousClose || meta.previousClose || 0)) /
              (meta.chartPreviousClose || meta.previousClose || 1)) * 100,
          regularMarketPreviousClose: meta.chartPreviousClose || meta.previousClose || 0,
          regularMarketDayHigh: meta.regularMarketDayHigh || meta.regularMarketPrice,
          regularMarketDayLow: meta.regularMarketDayLow || meta.regularMarketPrice,
          regularMarketOpen: meta.regularMarketOpen || meta.regularMarketPrice,
          regularMarketVolume: meta.regularMarketVolume || 0,
          fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh || 0,
          fiftyTwoWeekLow: meta.fiftyTwoWeekLow || 0,
          fiftyDayAverage: meta.fiftyDayAverage || 0,
          twoHundredDayAverage: meta.twoHundredDayAverage || 0,
        };
      } catch {
        return null;
      }
    })
  );
  const valid = results.filter(Boolean);
  if (valid.length === 0) throw new Error("No valid scrape results");
  return valid;
}

// ─── PROVIDER 3: Finnhub free tier ──────────────────────────────
async function fetchFinnhubQuotes(symbolList) {
  const apiKey = process.env.FINNHUB_API_KEY || "";
  if (!apiKey) throw new Error("No FINNHUB_API_KEY");

  const results = await Promise.all(
    symbolList.map(async (sym) => {
      try {
        const isCrypto = sym.includes("-USD");
        const finnSym = isCrypto ? `BINANCE:${sym.replace("-USD", "")}USDT` : sym;
        const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${finnSym}&token=${apiKey}`);
        if (!res.ok) return null;
        const d = await res.json();
        if (!d.c || d.c === 0) return null;
        return {
          symbol: sym,
          shortName: sym.replace("-USD", ""),
          regularMarketPrice: d.c,
          regularMarketChange: d.d || 0,
          regularMarketChangePercent: d.dp || 0,
          regularMarketPreviousClose: d.pc || 0,
          regularMarketOpen: d.o || 0,
          regularMarketDayHigh: d.h || 0,
          regularMarketDayLow: d.l || 0,
        };
      } catch { return null; }
    })
  );
  const valid = results.filter(Boolean);
  if (valid.length === 0) throw new Error("No Finnhub results");
  return valid;
}

// ─── FALLBACK: Realistic estimated data ─────────────────────────
function fallbackQuotes(symbolList) {
  const prices = {
    AAPL: 228, AMZN: 210, GOOGL: 198, GOOG: 199, MSFT: 420, NVDA: 129,
    META: 680, TSLA: 382, NFLX: 985, AMD: 119, CRM: 330, ORCL: 185,
    INTC: 23, QCOM: 175, AVGO: 225, PLTR: 110, COIN: 290, SQ: 85,
    SHOP: 115, UBER: 78, ABNB: 155, SNAP: 12, PINS: 37, ROKU: 95,
    "BTC-USD": 97500, "ETH-USD": 3180, "SOL-USD": 210, "DOGE-USD": 0.32,
    "XRP-USD": 2.45, "ADA-USD": 0.98, "AVAX-USD": 38,
    SPY: 608, QQQ: 530, VOO: 558, IWM: 228,
  };
  return symbolList.map((sym) => {
    const base = prices[sym] || 50 + ((sym.charCodeAt(0) * 13 + sym.charCodeAt(sym.length - 1) * 7) % 400);
    const pct = (Math.random() - 0.5) * 3;
    const chg = base * pct / 100;
    return {
      symbol: sym, shortName: sym.replace("-USD", ""),
      regularMarketPrice: +(base + chg).toFixed(2),
      regularMarketChange: +chg.toFixed(2),
      regularMarketChangePercent: +pct.toFixed(2),
      regularMarketPreviousClose: +base.toFixed(2),
      regularMarketOpen: +(base + chg * 0.3).toFixed(2),
      regularMarketDayHigh: +(base + Math.abs(chg) * 1.3).toFixed(2),
      regularMarketDayLow: +(base - Math.abs(chg) * 0.8).toFixed(2),
      fiftyTwoWeekHigh: +(base * 1.25).toFixed(2),
      fiftyTwoWeekLow: +(base * 0.65).toFixed(2),
      regularMarketVolume: Math.floor(30e6 + Math.random() * 80e6),
      averageDailyVolume10Day: Math.floor(40e6 + Math.random() * 30e6),
      marketCap: Math.floor(base * (2e9 + Math.random() * 1e12)),
      trailingPE: +(15 + Math.random() * 35).toFixed(1),
      forwardPE: +(12 + Math.random() * 28).toFixed(1),
      trailingEps: +(base / (15 + Math.random() * 35)).toFixed(2),
      beta: +(0.8 + Math.random() * 1.2).toFixed(2),
      fiftyDayAverage: +(base * (0.95 + Math.random() * 0.1)).toFixed(2),
      twoHundredDayAverage: +(base * (0.88 + Math.random() * 0.15)).toFixed(2),
      _fallback: true,
    };
  });
}

// ─── MAIN ───────────────────────────────────────────────────────
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const symbols = searchParams.get("symbols");
  if (!symbols) return NextResponse.json({ error: "Missing symbols" }, { status: 400 });

  const symbolList = symbols.split(",").map((s) => s.trim());

  const providers = [
    { name: "yahoo-crumb", fn: () => fetchYahooQuotes(symbols) },
    { name: "yahoo-chart-meta", fn: () => fetchYahooScrape(symbolList) },
    { name: "finnhub", fn: () => fetchFinnhubQuotes(symbolList) },
  ];

  for (const p of providers) {
    try {
      const result = await p.fn();
      if (result?.length > 0) {
        console.log(`✅ Quotes from ${p.name} (${result.length} symbols)`);
        return NextResponse.json({ quoteResponse: { result }, _provider: p.name });
      }
    } catch (err) {
      console.warn(`⚠️ ${p.name}: ${err.message}`);
    }
  }

  console.log("⚠️ All live providers failed — using fallback");
  return NextResponse.json({
    quoteResponse: { result: fallbackQuotes(symbolList) },
    _provider: "fallback",
  });
}
