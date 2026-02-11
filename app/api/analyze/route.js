import { NextResponse } from "next/server";

const safe = (v, d = 2) => (v != null && !isNaN(v) ? Number(v).toFixed(d) : "N/A");

function buildPrompt(body) {
  const { symbol, price, change, pe, forwardPe, high52, low52, sma50, sma200, rsi, bbUpper, bbLower, volume, avgVolume } = body;
  const pNum = Number(price) || 0;
  const l52 = Number(low52) || 0;
  const h52 = Number(high52) || 1;
  const rangePos = h52 - l52 !== 0 ? (((pNum - l52) / (h52 - l52)) * 100).toFixed(0) : "N/A";
  const volRatio = Number(avgVolume) > 0 ? (Number(volume) / Number(avgVolume)).toFixed(1) : "N/A";

  return `You are an expert stock/crypto analyst writing for a personal trading terminal. Give a detailed, actionable analysis of ${symbol}.

Current data:
- Price: $${safe(price)} (${Number(change) >= 0 ? "+" : ""}${safe(change)}% today)
- P/E: ${safe(pe, 1)} | Forward P/E: ${safe(forwardPe, 1)}
- 52W Range: $${safe(low52)} - $${safe(high52)} (${rangePos}% of range)
- 50-Day SMA: $${safe(sma50)} (price ${pNum > Number(sma50) ? "above" : "below"})
- 200-Day SMA: $${safe(sma200)} (price ${pNum > Number(sma200) ? "above" : "below"})
- RSI(14): ${safe(rsi, 1)}
- Bollinger: Upper $${safe(bbUpper)} / Lower $${safe(bbLower)}
- Volume ratio vs average: ${volRatio}x

RULES:
1. "summary" must be 3-4 sentences with specific price references and what they mean
2. "technicals" must have 3-5 signals, each with a specific "detail" sentence (not just a word)
3. "keyLevels" support and resistance must be specific dollar amounts based on the data
4. "shortTermOutlook" must be 2-3 sentences with specific price targets or ranges to watch
5. "risks" must be 3-4 DETAILED sentences (15+ words each) about specific risks for THIS stock right now — not generic words like "recession" or "competition". Reference actual market conditions, sector trends, valuation concerns, or technical breakdown levels.
6. "beginnerNotes" must be 4-5 sentences written in VERY simple, casual language like you're explaining to a friend who just started investing. NO jargon. Explain what the data actually means for them in plain english. Use phrases like "basically...", "think of it like...", "in simple terms...". Reference the actual numbers but explain what they mean. Tell them what the smart move might be in a friendly way.

Respond ONLY with valid JSON, no markdown, no backticks, no extra text:
{"signal":"BULLISH","confidence":70,"summary":"3-4 detailed sentences","technicals":[{"label":"Signal Name","type":"bull","detail":"Specific explanation sentence"},{"label":"Another Signal","type":"bear","detail":"Another specific explanation"}],"keyLevels":{"support":190.00,"resistance":230.00},"shortTermOutlook":"2-3 detailed sentences with price levels","risks":["A full detailed sentence about a specific risk","Another full sentence about a different risk","A third detailed risk sentence"],"beginnerNotes":"4-5 casual, jargon-free sentences explaining what all this means for someone new to trading. Be friendly and specific."}

signal must be BULLISH, BEARISH, or NEUTRAL. type must be bull, bear, or neutral. ONLY output valid JSON.`;
}

// ─── PROVIDER 1: Groq (free, fast) ─────────────────────────────
async function callGroq(prompt) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("No GROQ_API_KEY");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── PROVIDER 2: Gemini (free tier) ────────────────────────────
async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("No GEMINI_API_KEY");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 1000, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// ─── PROVIDER 3: Anthropic ─────────────────────────────────────
async function callAnthropic(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("No ANTHROPIC_API_KEY");

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.map((b) => b.text || "").join("") || "";
}

// ─── PROVIDER 4: OpenAI ────────────────────────────────────────
async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("No OPENAI_API_KEY");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

// ─── LOCAL FALLBACK (no API needed) ─────────────────────────────
function localAnalysis(body) {
  const { symbol, price, change, pe, high52, low52, sma50, sma200, rsi, volume, avgVolume } = body;
  const p = Number(price) || 0;
  const r = Number(rsi) || 50;
  const chg = Number(change) || 0;
  const s50 = Number(sma50) || p;
  const s200 = Number(sma200) || p;
  const vol = Number(volume) || 0;
  const avgVol = Number(avgVolume) || 1;
  const h52 = Number(high52) || p * 1.2;
  const l52 = Number(low52) || p * 0.8;

  let bullPoints = 0, bearPoints = 0;
  const technicals = [];

  if (p > s50) { bullPoints += 2; technicals.push({ label: "Above 50 SMA", type: "bull", detail: `Price above ${safe(sma50)}` }); }
  else { bearPoints += 2; technicals.push({ label: "Below 50 SMA", type: "bear", detail: `Price below ${safe(sma50)}` }); }

  if (p > s200) { bullPoints += 2; technicals.push({ label: "Above 200 SMA", type: "bull", detail: `Long-term uptrend intact` }); }
  else { bearPoints += 2; technicals.push({ label: "Below 200 SMA", type: "bear", detail: `Long-term trend broken` }); }

  if (r > 70) { bearPoints += 2; technicals.push({ label: `RSI ${r.toFixed(0)} Overbought`, type: "bear", detail: "May be due for pullback" }); }
  else if (r < 30) { bullPoints += 2; technicals.push({ label: `RSI ${r.toFixed(0)} Oversold`, type: "bull", detail: "Potential bounce zone" }); }
  else { technicals.push({ label: `RSI ${r.toFixed(0)} Neutral`, type: "neutral", detail: "No extreme momentum" }); }

  if (chg > 2) { bullPoints += 1; technicals.push({ label: `Up ${chg.toFixed(1)}% today`, type: "bull", detail: "Strong daily move" }); }
  else if (chg < -2) { bearPoints += 1; technicals.push({ label: `Down ${Math.abs(chg).toFixed(1)}% today`, type: "bear", detail: "Significant selling" }); }

  if (vol > avgVol * 1.5) {
    technicals.push({ label: `Volume ${(vol / avgVol).toFixed(1)}x avg`, type: chg > 0 ? "bull" : "bear", detail: chg > 0 ? "Buying conviction" : "Selling pressure" });
  }

  const signal = bullPoints > bearPoints + 1 ? "BULLISH" : bearPoints > bullPoints + 1 ? "BEARISH" : "NEUTRAL";
  const confidence = Math.min(85, 40 + Math.abs(bullPoints - bearPoints) * 10);
  const rangePct = h52 - l52 > 0 ? ((p - l52) / (h52 - l52) * 100).toFixed(0) : 50;

  return JSON.stringify({
    signal,
    confidence,
    summary: `${symbol} is trading at $${safe(price)} (${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% today). The stock is ${p > s50 ? "above" : "below"} its 50-day moving average with RSI at ${r.toFixed(0)}, sitting at ${rangePct}% of its 52-week range.`,
    technicals,
    keyLevels: {
      support: +(l52 + (p - l52) * 0.3).toFixed(2),
      resistance: +(p + (h52 - p) * 0.4).toFixed(2),
    },
    shortTermOutlook: `Watch the $${safe(sma50)} level (50-day SMA) as key ${p > s50 ? "support" : "resistance"}. ${r > 65 ? "RSI is elevated — momentum may slow." : r < 35 ? "RSI suggests oversold conditions — watch for a bounce." : "Momentum is neutral."}`,
    risks: [
      p > h52 * 0.95 ? `Trading near 52-week high ($${safe(high52)}) — upside may be limited without a strong catalyst, and profit-taking could trigger a pullback` : `Currently ${((1 - p / h52) * 100).toFixed(0)}% below the 52-week high of $${safe(high52)} — while this creates recovery potential, it also signals sustained selling pressure that may continue`,
      vol > avgVol * 2 ? `Volume is ${(vol / avgVol).toFixed(1)}x the 10-day average, indicating heightened volatility — large moves in either direction are more likely in the near term` : `Volume is near average levels — watch for a spike in volume to confirm any breakout or breakdown from current levels`,
      r > 65 ? `RSI at ${r.toFixed(0)} is approaching overbought territory — momentum traders may start taking profits, which could cap short-term gains` : r < 35 ? `RSI at ${r.toFixed(0)} is in oversold territory — while this can signal a bounce, oversold conditions can persist during strong downtrends` : `Macro uncertainty including interest rate policy and sector rotation could impact ${symbol} regardless of its technical setup`,
    ],
    beginnerNotes: `Okay so here's the deal with ${symbol} in plain english. The stock is at $${safe(price)} right now, which is ${p > s50 ? "above" : "below"} where it's been trading on average lately ($${safe(sma50)}). ${p > s50 ? "That's generally a good sign — it means the stock has momentum going for it." : "That's not great — it means the stock has been losing steam compared to recent weeks."} The RSI is at ${r.toFixed(0)} — ${r > 70 ? "which basically means a LOT of people have been buying and it might be getting expensive, so be careful jumping in right now" : r < 30 ? "which means it's been beaten down pretty hard, and sometimes that means it's a bargain, but it could also keep dropping" : "which is pretty neutral, meaning there's no extreme buying or selling pressure right now"}. ${chg > 2 ? "It had a solid green day today, up " + chg.toFixed(1) + "%, so buyers are showing up." : chg < -2 ? "It dropped " + Math.abs(chg).toFixed(1) + "% today, so there's definitely some selling going on." : "Today's move was pretty small, nothing dramatic."} If you're new to this, ${r < 35 && p < s50 ? "this might look like a deal but be cautious — stocks can stay cheap for a while before bouncing back. Don't put in more than you're okay losing." : p > s50 && r < 65 ? "the overall trend looks okay, but always do your own research and never invest money you can't afford to lose." : "it's probably best to watch this one for a bit before making any moves, and definitely don't bet the farm on one stock."}`,
    _source: "local-analysis",
  });
}

// ─── MAIN HANDLER ───────────────────────────────────────────────
export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = buildPrompt(body);

  const providers = [
    { name: "groq", fn: () => callGroq(prompt) },
    { name: "gemini", fn: () => callGemini(prompt) },
    { name: "anthropic", fn: () => callAnthropic(prompt) },
    { name: "openai", fn: () => callOpenAI(prompt) },
    { name: "local", fn: () => localAnalysis(body) },
  ];

  for (const p of providers) {
    try {
      const text = await p.fn();
      if (!text) continue;

      const clean = text.replace(/```json|```/g, "").trim();
      const analysis = JSON.parse(clean);

      if (analysis.signal) {
        console.log(`✅ AI analysis from ${p.name}: ${analysis.signal}`);
        analysis._provider = p.name;
        return NextResponse.json(analysis);
      }
    } catch (err) {
      console.warn(`⚠️ ${p.name}: ${err.message}`);
    }
  }

  return NextResponse.json({ error: "All AI providers failed" }, { status: 500 });
}
