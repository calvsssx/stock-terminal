"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import {
  theme, pctColor, fmt, fmtPrice,
  calcSMA, calcRSI, calcBollinger,
  fetchQuotes, fetchChart, fetchAnalysis,
  RANGES, DEFAULT_WATCHLIST,
} from "@/lib/utils";

// ─── SMALL COMPONENTS ───────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "rgba(6,8,12,0.95)", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "10px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
      <div style={{ color: theme.textDim, marginBottom: 4, fontWeight: 600 }}>{label}</div>
      {payload.filter((p) => p.value != null).map((p, i) => (
        <div key={i} style={{ color: p.color || theme.text, margin: "2px 0" }}>
          {p.name}: <span style={{ fontWeight: 700 }}>{typeof p.value === "number" && p.value > 1000 ? fmtPrice(p.value) : typeof p.value === "number" ? p.value.toFixed(2) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const Metric = ({ label, value, sub, color }) => (
  <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: "12px 16px", minWidth: 120, flex: "1 1 120px" }}>
    <div style={{ fontSize: 10, color: theme.textDim, textTransform: "uppercase", letterSpacing: 1.2, fontWeight: 700, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{label}</div>
    <div style={{ fontSize: 20, fontWeight: 800, color: color || theme.textBright, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: theme.textDim, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Signal = ({ type, text }) => {
  const c = type === "bull" ? theme.accent : type === "bear" ? theme.red : theme.amber;
  const bg = type === "bull" ? theme.accentDim : type === "bear" ? theme.redDim : "rgba(255,179,71,0.12)";
  return (
    <span style={{ display: "inline-block", background: bg, border: `1px solid ${c}33`, color: c, borderRadius: 5, padding: "3px 8px", fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginRight: 6, marginBottom: 6 }}>
      {text}
    </span>
  );
};

// ─── MAIN TERMINAL ──────────────────────────────────────────────
export default function Terminal() {
  const [watchlist, setWatchlist] = useState(DEFAULT_WATCHLIST);
  const [quotes, setQuotes] = useState({});
  const [selected, setSelected] = useState("AMZN");
  const [chartData, setChartData] = useState([]);
  const [range, setRange] = useState("3mo");
  const [interval, setIntervalVal] = useState("1d");
  const [chartLoading, setChartLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [showOverlay, setShowOverlay] = useState({ sma20: true, sma50: true, bollinger: false });
  const [activePanel, setActivePanel] = useState("chart");
  const [addTicker, setAddTicker] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [dataStatus, setDataStatus] = useState("loading"); // "loading" | "live" | "fallback" | "error"
  const [dataProvider, setDataProvider] = useState("");
  const inputRef = useRef(null);

  // ─── DATA LOADING ─────────────────────────────────────────────
  const loadQuotes = useCallback(async () => {
    const data = await fetchQuotes(watchlist);
    if (data.length > 0) {
      const map = {};
      data.forEach((q) => { if (q.symbol) map[q.symbol] = q; });
      setQuotes(map);
      const provider = data._provider || "";
      setDataProvider(provider);
      setDataStatus(provider === "fallback" ? "fallback" : "live");
    } else {
      setDataStatus("error");
    }
  }, [watchlist]);

  const loadChart = useCallback(async () => {
    setChartLoading(true);
    const data = await fetchChart(selected, range, interval);
    setChartData(data);
    setChartLoading(false);
  }, [selected, range, interval]);

  useEffect(() => { loadQuotes(); }, [loadQuotes]);
  useEffect(() => { loadChart(); }, [loadChart]);

  // Auto-refresh every 15s
  useEffect(() => {
    const t = window.setInterval(() => { loadQuotes(); loadChart(); }, 15000);
    return () => window.clearInterval(t);
  }, [loadQuotes, loadChart]);

  // ─── DERIVED STATE ────────────────────────────────────────────
  const q = quotes[selected] || {};
  const price = q.regularMarketPrice || 0;
  const change = q.regularMarketChange || 0;
  const changePct = q.regularMarketChangePercent || 0;
  const isUp = change >= 0;

  const sma20 = calcSMA(chartData, 20);
  const sma50 = calcSMA(chartData, 50);
  const rsiData = calcRSI(chartData);
  const bollingerData = calcBollinger(chartData);
  const currentRSI = rsiData.filter((v) => v !== null).pop();

  const enrichedChart = chartData.map((d, i) => ({
    ...d,
    sma20: sma20[i],
    sma50: sma50[i],
    rsi: rsiData[i],
    bbUpper: bollingerData[i]?.upper,
    bbLower: bollingerData[i]?.lower,
    bbMid: bollingerData[i]?.mid,
  }));

  // ─── ACTIONS ──────────────────────────────────────────────────
  const handleAddTicker = () => {
    const t = addTicker.trim().toUpperCase();
    if (t && !watchlist.includes(t)) {
      setWatchlist((prev) => [...prev, t]);
      setAddTicker("");
      setSearchOpen(false);
    }
  };

  const handleRemoveTicker = (t) => {
    setWatchlist((prev) => prev.filter((s) => s !== t));
    if (selected === t) setSelected(watchlist.find((s) => s !== t) || "AAPL");
  };

  const runAI = async () => {
    setAnalysisLoading(true);
    setActivePanel("ai");
    const lastBB = bollingerData[bollingerData.length - 1] || {};
    const result = await fetchAnalysis({
      symbol: selected,
      price,
      change: changePct,
      pe: q.trailingPE,
      forwardPe: q.forwardPE,
      high52: q.fiftyTwoWeekHigh || 0,
      low52: q.fiftyTwoWeekLow || 0,
      sma50: q.fiftyDayAverage || 0,
      sma200: q.twoHundredDayAverage || 0,
      rsi: currentRSI || 50,
      bbUpper: lastBB.upper || 0,
      bbLower: lastBB.lower || 0,
      volume: q.regularMarketVolume || 0,
      avgVolume: q.averageDailyVolume10Day || 1,
    });

    if (result && result.signal) {
      // Valid AI response
      setAnalysis(result);
    } else {
      // Show the actual error so user can debug
      const errMsg = result?.error || result?.detail || "Unknown error";
      setAnalysis({
        signal: "NEUTRAL",
        confidence: 0,
        summary: `AI analysis failed: ${errMsg}`,
        technicals: [],
        keyLevels: { support: q.fiftyTwoWeekLow || 0, resistance: q.fiftyTwoWeekHigh || 0 },
        shortTermOutlook: "Check Vercel logs (vercel.com → your project → Logs tab) for details. Make sure ANTHROPIC_API_KEY is set correctly in Settings → Environment Variables, then redeploy.",
        risks: [`API Error: ${errMsg}`],
      });
    }
    setAnalysisLoading(false);
  };

  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", position: "relative", overflow: "hidden" }}>
      {/* Ambient glow */}
      <div style={{ position: "fixed", top: -200, right: -200, width: 600, height: 600, background: isUp ? "radial-gradient(circle, rgba(0,212,170,0.04) 0%, transparent 70%)" : "radial-gradient(circle, rgba(255,71,87,0.04) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: 1400, margin: "0 auto", padding: "16px 20px" }}>
        {/* ─── HEADER ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: dataStatus === "live" ? theme.accent : dataStatus === "fallback" ? theme.amber : dataStatus === "error" ? theme.red : theme.amber, boxShadow: `0 0 12px ${dataStatus === "live" ? theme.accent : theme.amber}` }} />
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 800, color: theme.textBright, letterSpacing: 2 }}>MARKET TERMINAL</span>
            <span style={{ fontSize: 10, color: dataStatus === "live" ? theme.accent : dataStatus === "fallback" ? theme.amber : theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
              {dataStatus === "live" ? `LIVE · ${dataProvider}` : dataStatus === "fallback" ? "ESTIMATED DATA" : dataStatus === "error" ? "OFFLINE" : "CONNECTING..."}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
              {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
            </span>
            <button onClick={() => { loadQuotes(); loadChart(); }} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 6, padding: "4px 10px", color: theme.accent, fontSize: 11, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>
              ↻ REFRESH
            </button>
          </div>
        </div>

        {/* ─── WATCHLIST ─── */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 6, alignItems: "center" }}>
          {watchlist.map((sym) => {
            const wq = quotes[sym] || {};
            const wp = wq.regularMarketChangePercent || 0;
            const isActive = sym === selected;
            return (
              <button key={sym} onClick={() => { setSelected(sym); setAnalysis(null); }} style={{
                background: isActive ? (wp >= 0 ? theme.accentDim : theme.redDim) : theme.surface,
                border: `1px solid ${isActive ? (wp >= 0 ? theme.accent + "44" : theme.red + "44") : theme.border}`,
                borderRadius: 8, padding: "8px 14px", cursor: "pointer", minWidth: 90, transition: "all 0.2s",
                display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 2,
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", width: "100%", alignItems: "center" }}>
                  <span style={{ fontSize: 12, fontWeight: 800, color: isActive ? theme.textBright : theme.text, fontFamily: "'JetBrains Mono', monospace" }}>{sym.replace("-USD", "")}</span>
                  {watchlist.length > 1 && (
                    <span onClick={(e) => { e.stopPropagation(); handleRemoveTicker(sym); }} style={{ fontSize: 10, color: theme.textDim, cursor: "pointer", marginLeft: 6, lineHeight: 1 }}>✕</span>
                  )}
                </div>
                {wq.regularMarketPrice ? (
                  <>
                    <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>{fmtPrice(wq.regularMarketPrice)}</span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: pctColor(wp), fontFamily: "'JetBrains Mono', monospace" }}>
                      {wp >= 0 ? "+" : ""}{wp.toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span style={{ fontSize: 10, color: theme.textDim }}>loading...</span>
                )}
              </button>
            );
          })}

          <button onClick={() => { setSearchOpen(!searchOpen); setTimeout(() => inputRef.current?.focus(), 100); }} style={{
            background: "transparent", border: `1px dashed ${theme.border}`, borderRadius: 8,
            padding: "8px 14px", cursor: "pointer", color: theme.textDim, fontSize: 18, minWidth: 44, display: "flex", alignItems: "center", justifyContent: "center",
          }}>+</button>
          {searchOpen && (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <input ref={inputRef} value={addTicker} onChange={(e) => setAddTicker(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleAddTicker()}
                placeholder="e.g. TSLA" maxLength={10}
                style={{ background: theme.surface, border: `1px solid ${theme.borderHover}`, borderRadius: 6, padding: "6px 10px", color: theme.textBright, fontSize: 12, width: 100, fontFamily: "'JetBrains Mono', monospace", outline: "none" }} />
              <button onClick={handleAddTicker} style={{ background: theme.accent, border: "none", borderRadius: 6, padding: "6px 10px", color: theme.bg, fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'JetBrains Mono', monospace" }}>ADD</button>
            </div>
          )}
        </div>

        {/* ─── PRICE HEADER ─── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 800, color: theme.textBright }}>{selected}</span>
              <span style={{ fontSize: 13, color: theme.textDim }}>{q.shortName || q.longName || ""}</span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <span style={{ fontSize: 38, fontWeight: 800, color: theme.textBright, fontFamily: "'JetBrains Mono', monospace" }}>
                {price ? fmtPrice(price) : "—"}
              </span>
              {price > 0 && (
                <span style={{ fontSize: 16, fontWeight: 700, color: pctColor(changePct), fontFamily: "'JetBrains Mono', monospace" }}>
                  {isUp ? "▲" : "▼"} {Math.abs(change).toFixed(2)} ({changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%)
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {[{ id: "chart", label: "CHART" }, { id: "metrics", label: "METRICS" }, { id: "ai", label: "AI ANALYSIS" }].map((p) => (
              <button key={p.id} onClick={() => (p.id === "ai" ? runAI() : setActivePanel(p.id))} style={{
                background: activePanel === p.id ? theme.surfaceHover : "transparent",
                border: `1px solid ${activePanel === p.id ? theme.borderHover : theme.border}`,
                borderRadius: 6, padding: "6px 14px", cursor: "pointer",
                color: activePanel === p.id ? theme.textBright : theme.textDim,
                fontSize: 11, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", letterSpacing: 0.5, transition: "all 0.15s",
              }}>
                {p.id === "ai" && analysisLoading ? "ANALYZING..." : p.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── CHART PANEL ─── */}
        {activePanel === "chart" && (
          <div className="fade-in">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 3 }}>
                {RANGES.map((r) => (
                  <button key={r.value} onClick={() => { setRange(r.value); setIntervalVal(r.interval); }} style={{
                    background: range === r.value ? theme.surfaceHover : "transparent",
                    border: `1px solid ${range === r.value ? theme.borderHover : "transparent"}`,
                    borderRadius: 5, padding: "4px 10px", cursor: "pointer",
                    color: range === r.value ? theme.textBright : theme.textDim,
                    fontSize: 11, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
                  }}>{r.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 3 }}>
                {[{ key: "sma20", label: "SMA20", color: theme.amber }, { key: "sma50", label: "SMA50", color: theme.purple }, { key: "bollinger", label: "BB", color: theme.blue }].map((o) => (
                  <button key={o.key} onClick={() => setShowOverlay((prev) => ({ ...prev, [o.key]: !prev[o.key] }))} style={{
                    background: showOverlay[o.key] ? o.color + "18" : "transparent",
                    border: `1px solid ${showOverlay[o.key] ? o.color + "44" : theme.border}`,
                    borderRadius: 5, padding: "4px 10px", cursor: "pointer",
                    color: showOverlay[o.key] ? o.color : theme.textDim,
                    fontSize: 10, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace",
                  }}>{o.label}</button>
                ))}
              </div>
            </div>

            {/* Price chart */}
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "16px 8px 8px", marginBottom: 12, position: "relative" }}>
              {chartLoading && <div style={{ position: "absolute", top: 16, right: 16, fontSize: 10, color: theme.accent, fontFamily: "'JetBrains Mono', monospace", zIndex: 2 }}>LOADING...</div>}
              {enrichedChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={340}>
                  <ComposedChart data={enrichedChart}>
                    <defs>
                      <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={isUp ? theme.accent : theme.red} stopOpacity={0.2} />
                        <stop offset="100%" stopColor={isUp ? theme.accent : theme.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="time" tick={{ fill: theme.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={50} />
                    <YAxis domain={["auto", "auto"]} tick={{ fill: theme.textDim, fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0))} width={55} />
                    <Tooltip content={<ChartTooltip />} />
                    {showOverlay.bollinger && <Area type="monotone" dataKey="bbUpper" stroke="none" fill={theme.blue} fillOpacity={0.05} name="BB Upper" />}
                    <Area type="monotone" dataKey="close" stroke={isUp ? theme.accent : theme.red} strokeWidth={2} fill="url(#areaFill)" name="Price" />
                    {showOverlay.sma20 && <Line type="monotone" dataKey="sma20" stroke={theme.amber} strokeWidth={1.2} dot={false} name="SMA 20" strokeDasharray="4 4" />}
                    {showOverlay.sma50 && <Line type="monotone" dataKey="sma50" stroke={theme.purple} strokeWidth={1.2} dot={false} name="SMA 50" strokeDasharray="6 3" />}
                    {showOverlay.bollinger && <Line type="monotone" dataKey="bbUpper" stroke={theme.blue} strokeWidth={1} dot={false} name="BB Upper" strokeDasharray="2 2" />}
                    {showOverlay.bollinger && <Line type="monotone" dataKey="bbLower" stroke={theme.blue} strokeWidth={1} dot={false} name="BB Lower" strokeDasharray="2 2" />}
                  </ComposedChart>
                </ResponsiveContainer>
              ) : (
                <div style={{ height: 340, display: "flex", alignItems: "center", justifyContent: "center", color: theme.textDim, fontSize: 13 }}>
                  {chartLoading ? "Loading chart data..." : "No chart data available. Check if the ticker is valid."}
                </div>
              )}
            </div>

            {/* Volume */}
            {enrichedChart.length > 0 && (
              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 8px 4px", marginBottom: 12 }}>
                <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1, paddingLeft: 8, marginBottom: 4 }}>VOLUME</div>
                <ResponsiveContainer width="100%" height={80}>
                  <BarChart data={enrichedChart}>
                    <XAxis dataKey="time" hide />
                    <YAxis hide />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="volume" name="Volume" radius={[2, 2, 0, 0]}>
                      {enrichedChart.map((entry, i) => (
                        <Cell key={i} fill={i > 0 && entry.close >= (enrichedChart[i - 1]?.close || 0) ? theme.accent + "55" : theme.red + "55"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* RSI */}
            {enrichedChart.length > 0 && (
              <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: "12px 8px 4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingLeft: 8, paddingRight: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1 }}>RSI (14)</span>
                  <span style={{ fontSize: 11, color: currentRSI > 70 ? theme.red : currentRSI < 30 ? theme.accent : theme.amber, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>
                    {currentRSI ? currentRSI.toFixed(1) : "—"} {currentRSI > 70 ? "OVERBOUGHT" : currentRSI < 30 ? "OVERSOLD" : ""}
                  </span>
                </div>
                <ResponsiveContainer width="100%" height={80}>
                  <LineChart data={enrichedChart}>
                    <XAxis dataKey="time" hide />
                    <YAxis domain={[0, 100]} hide />
                    <ReferenceLine y={70} stroke={theme.red} strokeDasharray="3 3" strokeOpacity={0.4} />
                    <ReferenceLine y={30} stroke={theme.accent} strokeDasharray="3 3" strokeOpacity={0.4} />
                    <ReferenceLine y={50} stroke={theme.textDim} strokeDasharray="2 2" strokeOpacity={0.2} />
                    <Tooltip content={<ChartTooltip />} />
                    <Line type="monotone" dataKey="rsi" stroke={theme.amber} strokeWidth={1.5} dot={false} name="RSI" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* ─── METRICS PANEL ─── */}
        {activePanel === "metrics" && (
          <div className="fade-in">
            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>PRICE DATA</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <Metric label="Open" value={fmtPrice(q.regularMarketOpen)} />
              <Metric label="Day High" value={fmtPrice(q.regularMarketDayHigh)} />
              <Metric label="Day Low" value={fmtPrice(q.regularMarketDayLow)} />
              <Metric label="Prev Close" value={fmtPrice(q.regularMarketPreviousClose)} />
              <Metric label="52W High" value={fmtPrice(q.fiftyTwoWeekHigh)} sub={q.fiftyTwoWeekHigh ? `${(((price - q.fiftyTwoWeekHigh) / q.fiftyTwoWeekHigh) * 100).toFixed(1)}% off` : ""} color={theme.red} />
              <Metric label="52W Low" value={fmtPrice(q.fiftyTwoWeekLow)} sub={q.fiftyTwoWeekLow ? `${(((price - q.fiftyTwoWeekLow) / q.fiftyTwoWeekLow) * 100).toFixed(1)}% above` : ""} color={theme.accent} />
            </div>

            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>FUNDAMENTALS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              <Metric label="Market Cap" value={q.marketCap ? `$${fmt(q.marketCap, 1)}` : "—"} />
              <Metric label="P/E (TTM)" value={q.trailingPE ? q.trailingPE.toFixed(1) + "x" : "—"} />
              <Metric label="Forward P/E" value={q.forwardPE ? q.forwardPE.toFixed(1) + "x" : "—"} />
              <Metric label="EPS (TTM)" value={q.trailingEps ? `$${q.trailingEps.toFixed(2)}` : "—"} />
              <Metric label="P/B Ratio" value={q.priceToBook ? q.priceToBook.toFixed(1) + "x" : "—"} />
              <Metric label="Beta" value={q.beta ? q.beta.toFixed(2) : "—"} />
              <Metric label="Div Yield" value={q.dividendYield ? (q.dividendYield * 100).toFixed(2) + "%" : "N/A"} />
              <Metric label="Volume" value={q.regularMarketVolume ? fmt(q.regularMarketVolume, 1) : "—"} sub={q.averageDailyVolume10Day ? `Avg: ${fmt(q.averageDailyVolume10Day, 1)}` : ""} />
            </div>

            <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 12 }}>MOVING AVERAGES</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Metric label="50-Day SMA" value={q.fiftyDayAverage ? fmtPrice(q.fiftyDayAverage) : "—"}
                sub={q.fiftyDayAverage ? (price > q.fiftyDayAverage ? "Price ABOVE ▲" : "Price BELOW ▼") : ""}
                color={q.fiftyDayAverage ? (price > q.fiftyDayAverage ? theme.accent : theme.red) : undefined} />
              <Metric label="200-Day SMA" value={q.twoHundredDayAverage ? fmtPrice(q.twoHundredDayAverage) : "—"}
                sub={q.twoHundredDayAverage ? (price > q.twoHundredDayAverage ? "Price ABOVE ▲" : "Price BELOW ▼") : ""}
                color={q.twoHundredDayAverage ? (price > q.twoHundredDayAverage ? theme.accent : theme.red) : undefined} />
              <Metric label="RSI (14)" value={currentRSI ? currentRSI.toFixed(1) : "—"}
                sub={currentRSI ? (currentRSI > 70 ? "Overbought" : currentRSI < 30 ? "Oversold" : "Neutral") : ""}
                color={currentRSI ? (currentRSI > 70 ? theme.red : currentRSI < 30 ? theme.accent : theme.amber) : undefined} />
            </div>
          </div>
        )}

        {/* ─── AI PANEL ─── */}
        {activePanel === "ai" && (
          <div className="fade-in">
            {analysisLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 60, gap: 16 }}>
                <div style={{ width: 40, height: 40, border: `3px solid ${theme.border}`, borderTop: `3px solid ${theme.accent}`, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
                <span style={{ fontSize: 12, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>Analyzing {selected}...</span>
              </div>
            ) : analysis ? (
              <div>
                <div style={{
                  background: analysis.signal === "BULLISH" ? theme.accentDim : analysis.signal === "BEARISH" ? theme.redDim : "rgba(255,179,71,0.1)",
                  border: `1px solid ${analysis.signal === "BULLISH" ? theme.accent + "33" : analysis.signal === "BEARISH" ? theme.red + "33" : theme.amber + "33"}`,
                  borderRadius: 14, padding: 20, marginBottom: 16,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                    <span style={{ fontSize: 24, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
                      color: analysis.signal === "BULLISH" ? theme.accent : analysis.signal === "BEARISH" ? theme.red : theme.amber }}>
                      {analysis.signal}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>CONFIDENCE</span>
                      <div style={{ width: 80, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${analysis.confidence}%`, height: "100%", borderRadius: 3,
                          background: analysis.signal === "BULLISH" ? theme.accent : analysis.signal === "BEARISH" ? theme.red : theme.amber }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: theme.textBright, fontFamily: "'JetBrains Mono', monospace" }}>{analysis.confidence}%</span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.7, margin: 0 }}>{analysis.summary}</p>
                </div>

                {analysis.technicals?.length > 0 && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 10 }}>TECHNICAL SIGNALS</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {analysis.technicals.map((t, i) => (
                        <Signal key={i} type={t.type} text={`${t.label} — ${t.detail}`} />
                      ))}
                    </div>
                  </div>
                )}

                {analysis.keyLevels && (
                  <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                    <Metric label="Support" value={fmtPrice(analysis.keyLevels.support)} color={theme.accent} />
                    <Metric label="Resistance" value={fmtPrice(analysis.keyLevels.resistance)} color={theme.red} />
                    <Metric label="Current" value={fmtPrice(price)} />
                  </div>
                )}

                {analysis.shortTermOutlook && (
                  <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>SHORT-TERM OUTLOOK</div>
                    <p style={{ fontSize: 13, color: theme.text, lineHeight: 1.7, margin: 0 }}>{analysis.shortTermOutlook}</p>
                  </div>
                )}

                {analysis.risks?.length > 0 && (
                  <div style={{ background: theme.redDim, border: `1px solid ${theme.red}22`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 10, color: theme.red, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5, marginBottom: 8 }}>⚠ KEY RISKS</div>
                    {analysis.risks.map((r, i) => (
                      <div key={i} style={{ fontSize: 12, color: theme.text, lineHeight: 1.7, paddingLeft: 12, borderLeft: `2px solid ${theme.red}33`, marginBottom: 6 }}>{r}</div>
                    ))}
                  </div>
                )}

                {analysis.beginnerNotes && (
                  <div style={{
                    background: "linear-gradient(135deg, rgba(78,154,245,0.08), rgba(167,139,250,0.06))",
                    border: `1px solid rgba(78,154,245,0.2)`,
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{ fontSize: 16 }}>💡</span>
                      <span style={{ fontSize: 10, color: theme.blue, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: 1.5 }}>PLAIN ENGLISH BREAKDOWN</span>
                    </div>
                    <p style={{
                      fontSize: 13,
                      color: theme.textBright,
                      lineHeight: 1.9,
                      margin: 0,
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 400,
                    }}>
                      {analysis.beginnerNotes}
                    </p>
                  </div>
                )}

                <button onClick={runAI} style={{ background: "transparent", border: `1px solid ${theme.border}`, borderRadius: 8, padding: "8px 16px", cursor: "pointer", color: theme.textDim, fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>↻ RE-ANALYZE</button>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 60, color: theme.textDim }}>
                <p>Click AI ANALYSIS to generate insights</p>
              </div>
            )}
          </div>
        )}

        {/* ─── FOOTER ─── */}
        <div style={{ marginTop: 24, padding: "12px 0", borderTop: `1px solid ${theme.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            Yahoo Finance (15s refresh) • AI Analysis • Not financial advice
          </span>
          <span style={{ fontSize: 10, color: theme.textDim, fontFamily: "'JetBrains Mono', monospace" }}>
            {watchlist.length} assets • {enrichedChart.length} data points
          </span>
        </div>
      </div>
    </div>
  );
}
