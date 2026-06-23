import { useState, useEffect, useCallback, useRef } from "react";

const C = {
  bg:        "#08090F",
  surface:   "#0E1120",
  card:      "#131829",
  border:    "#1C2540",
  accent:    "#00C9A7",
  accentDim: "#00C9A714",
  bull:      "#00E676",
  bullDim:   "#00E67614",
  bear:      "#FF4560",
  bearDim:   "#FF456014",
  warn:      "#FFB300",
  warnDim:   "#FFB30014",
  muted:     "#3D4D66",
  text:      "#E8EDF5",
  sub:       "#7A8BA8",
  gold:      "#FFD700",
  error:     "#FF6B6B",
};

// ── Timeframe config ───────────────────────────────────────────
// Each TF has: granularity (seconds), higher TF for MTF confirmation, candle count
const TIMEFRAMES = {
  "1m":  { granularity: 60,    label: "1m",  htfGran: 300,   candles: 250 },
  "5m":  { granularity: 300,   label: "5m",  htfGran: 3600,  candles: 250 },
  "15m": { granularity: 900,   label: "15m", htfGran: 3600,  candles: 250 },
  "1h":  { granularity: 3600,  label: "1h",  htfGran: 14400, candles: 250 },
  "4h":  { granularity: 14400, label: "4h",  htfGran: 86400, candles: 250 },
};

const REFRESH_SECONDS = 300;
const DERIV_APP_ID    = "1089";

// ── Markets — ALL via Deriv WebSocket ──────────────────────────
const FOREX = [
  { symbol: "XAUUSD", name: "Gold",    deriv: "frxXAUUSD", isJPY: false, isGold: true  },
  { symbol: "EURUSD", name: "EUR/USD", deriv: "frxEURUSD", isJPY: false, isGold: false },
  { symbol: "GBPUSD", name: "GBP/USD", deriv: "frxGBPUSD", isJPY: false, isGold: false },
  { symbol: "USDJPY", name: "USD/JPY", deriv: "frxUSDJPY", isJPY: true,  isGold: false },
  { symbol: "AUDUSD", name: "AUD/USD", deriv: "frxAUDUSD", isJPY: false, isGold: false },
  { symbol: "USDCAD", name: "USD/CAD", deriv: "frxUSDCAD", isJPY: false, isGold: false },
  { symbol: "USDCHF", name: "USD/CHF", deriv: "frxUSDCHF", isJPY: false, isGold: false },
  { symbol: "EURJPY", name: "EUR/JPY", deriv: "frxEURJPY", isJPY: true,  isGold: false },
  { symbol: "GBPJPY", name: "GBP/JPY", deriv: "frxGBPJPY", isJPY: true,  isGold: false },
  { symbol: "EURGBP", name: "EUR/GBP", deriv: "frxEURGBP", isJPY: false, isGold: false },
];

const SYNTHETICS = [
  { symbol: "Volatility 10",  name: "V10",   deriv: "R_10",      isJPY: false, isGold: false },
  { symbol: "Volatility 25",  name: "V25",   deriv: "R_25",      isJPY: false, isGold: false },
  { symbol: "Volatility 50",  name: "V50",   deriv: "R_50",      isJPY: false, isGold: false },
  { symbol: "Volatility 75",  name: "V75",   deriv: "R_75",      isJPY: false, isGold: false },
  { symbol: "Volatility 100", name: "V100",  deriv: "R_100",     isJPY: false, isGold: false },
  { symbol: "1HZ10V",         name: "1Hz10", deriv: "1HZ10V",    isJPY: false, isGold: false },
  { symbol: "Step Index",     name: "Step",  deriv: "stpRNG",    isJPY: false, isGold: false },
  { symbol: "Jump 10",        name: "Jmp10", deriv: "JD10",      isJPY: false, isGold: false },
  { symbol: "Boom 300",       name: "B300",  deriv: "BOOM300N",  isJPY: false, isGold: false },
  { symbol: "Boom 500",       name: "B500",  deriv: "BOOM500",   isJPY: false, isGold: false },
  { symbol: "Crash 300",      name: "C300",  deriv: "CRASH300N", isJPY: false, isGold: false },
  { symbol: "Crash 500",      name: "C500",  deriv: "CRASH500",  isJPY: false, isGold: false },
];

// ── Deriv WebSocket ────────────────────────────────────────────
function derivWS(request, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`wss://ws.binaryws.com/websockets/v3?app_id=${DERIV_APP_ID}`);
    const timer = setTimeout(() => { ws.close(); reject(new Error("Timeout")); }, timeoutMs);
    ws.onopen    = () => ws.send(JSON.stringify(request));
    ws.onmessage = (e) => {
      clearTimeout(timer);
      ws.close();
      try {
        const d = JSON.parse(e.data);
        if (d.error) return reject(new Error(d.error.message));
        resolve(d);
      } catch (err) { reject(err); }
    };
    ws.onerror = () => { clearTimeout(timer); reject(new Error("WebSocket error")); };
  });
}

async function fetchCandles(derivSymbol, granularity, count = 250) {
  const d = await derivWS({
    ticks_history:     derivSymbol,
    adjust_start_time: 1,
    count,
    end:               "latest",
    granularity,
    style:             "candles",
  });
  return (d.candles || []).map(c => ({
    open: +c.open, high: +c.high, low: +c.low, close: +c.close, time: c.epoch * 1000,
  }));
}

async function fetchLivePrice(derivSymbol) {
  const d = await derivWS({ ticks: derivSymbol, subscribe: 0 }, 8000);
  return d.tick?.quote ?? null;
}

// ── Indicators ─────────────────────────────────────────────────
function ema(prices, p) {
  if (prices.length < p) return null;
  const k = 2 / (p + 1);
  let v = prices.slice(0, p).reduce((a, b) => a + b, 0) / p;
  for (let i = p; i < prices.length; i++) v = prices[i] * k + v * (1 - k);
  return v;
}

function rsiCalc(closes, p = 14) {
  if (closes.length < p + 1) return 50;
  const d = closes.slice(1).map((c, i) => c - closes[i]);
  let ag = 0, al = 0;
  d.slice(0, p).forEach(x => { if (x > 0) ag += x; else al -= x; });
  ag /= p; al /= p;
  for (let i = p; i < d.length; i++) {
    ag = (ag * (p - 1) + Math.max(d[i], 0)) / p;
    al = (al * (p - 1) + Math.max(-d[i], 0)) / p;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

function macdHistogram(closes) {
  const e12 = ema(closes, 12), e26 = ema(closes, 26);
  if (!e12 || !e26) return 0;
  const macdLine   = e12 - e26;
  const macdSeries = [];
  for (let i = 26; i <= closes.length; i++) {
    const s = closes.slice(0, i);
    const a = ema(s, 12), b = ema(s, 26);
    if (a && b) macdSeries.push(a - b);
  }
  const signal = ema(macdSeries, 9) ?? macdLine;
  return macdLine - signal;
}

function bollingerBands(closes, p = 20) {
  if (closes.length < p) return {};
  const s   = closes.slice(-p);
  const mid = s.reduce((a, b) => a + b, 0) / p;
  const std = Math.sqrt(s.map(x => (x - mid) ** 2).reduce((a, b) => a + b, 0) / p);
  return { upper: mid + 2 * std, lower: mid - 2 * std, mid };
}

function atrCalc(candles, p = 14) {
  if (candles.length < p + 1) return null;
  const trs = candles.slice(1).map((c, i) =>
    Math.max(c.high - c.low, Math.abs(c.high - candles[i].close), Math.abs(c.low - candles[i].close))
  );
  return trs.slice(-p).reduce((a, b) => a + b, 0) / p;
}

// ── HTF Trend (for MTF confirmation) ──────────────────────────
// Returns "BULL", "BEAR", or "NEUTRAL" based on EMA stack on higher TF candles
function htfTrend(htfCandles) {
  if (!htfCandles || htfCandles.length < 50) return "NEUTRAL";
  const closes = htfCandles.map(c => c.close);
  const e9  = ema(closes, 9);
  const e21 = ema(closes, 21);
  const e50 = ema(closes, 50);
  if (!e9 || !e21 || !e50) return "NEUTRAL";
  if (e9 > e21 && e21 > e50) return "BULL";
  if (e9 < e21 && e21 < e50) return "BEAR";
  return "NEUTRAL";
}

// ── Market Structure ───────────────────────────────────────────
function marketStructure(candles) {
  if (candles.length < 10) return "NEUTRAL";
  const r = candles.slice(-10);
  let bull = 0, bear = 0;
  for (let i = 2; i < r.length; i++) {
    if (r[i].high > r[i-1].high && r[i-1].high > r[i-2].high) bull++;
    if (r[i].low  > r[i-1].low  && r[i-1].low  > r[i-2].low)  bull++;
    if (r[i].high < r[i-1].high && r[i-1].high < r[i-2].high) bear++;
    if (r[i].low  < r[i-1].low  && r[i-1].low  < r[i-2].low)  bear++;
  }
  if (bull > bear + 1) return "BULLISH";
  if (bear > bull + 1) return "BEARISH";
  return "NEUTRAL";
}

// ── Liquidity Sweep ────────────────────────────────────────────
function liquiditySweep(candles, dec) {
  if (candles.length < 20) return null;
  const lookback   = candles.slice(-20, -1);
  const last       = candles[candles.length - 1];
  const recentHigh = Math.max(...lookback.map(c => c.high));
  const recentLow  = Math.min(...lookback.map(c => c.low));
  if (last.low < recentLow   && last.close > recentLow)
    return { side: "bull", label: `Liq. Sweep below ${recentLow.toFixed(dec)} → Bullish reversal` };
  if (last.high > recentHigh && last.close < recentHigh)
    return { side: "bear", label: `Liq. Sweep above ${recentHigh.toFixed(dec)} → Bearish reversal` };
  return null;
}

// ── Support & Resistance ───────────────────────────────────────
function supportResistance(candles) {
  if (candles.length < 10) return {};
  const slice      = candles.slice(-20);
  const resistance = Math.max(...slice.map(c => c.high));
  const support    = Math.min(...slice.map(c => c.low));
  const price      = candles[candles.length - 1].close;
  const rng        = resistance - support || 1;
  return {
    support, resistance,
    nearSupport:    (price - support)    < rng * 0.08,
    nearResistance: (resistance - price) < rng * 0.08,
  };
}

// ── ATR Volatility Filter ──────────────────────────────────────
function isVolatilityHealthy(candles, atrValue) {
  if (!atrValue || candles.length < 20) return true;
  const avgRange = candles.slice(-20).reduce((a, c) => a + (c.high - c.low), 0) / 20;
  return atrValue >= avgRange * 0.3;
}

// ── Price Action Patterns ──────────────────────────────────────
function priceActionPatterns(candles) {
  if (candles.length < 3) return [];
  const pats = [];
  const c0 = candles[candles.length - 1];
  const c1 = candles[candles.length - 2];
  const c2 = candles[candles.length - 3];

  const body   = c => Math.abs(c.close - c.open);
  const rng    = c => (c.high - c.low) || 0.00001;
  const isBull = c => c.close > c.open;
  const isBear = c => c.close < c.open;
  const upWick = c => c.high - Math.max(c.open, c.close);
  const dnWick = c => Math.min(c.open, c.close) - c.low;

  if (isBear(c1) && isBull(c0) && c0.open <= c1.close && c0.close >= c1.open)
    pats.push({ name: "Bullish Engulfing", side: "bull", strength: 3 });
  if (isBull(c1) && isBear(c0) && c0.open >= c1.close && c0.close <= c1.open)
    pats.push({ name: "Bearish Engulfing", side: "bear", strength: 3 });
  if (dnWick(c0) > body(c0) * 2 && upWick(c0) < body(c0) * 0.5 && body(c0) < rng(c0) * 0.4)
    pats.push({ name: "Hammer", side: "bull", strength: 2 });
  if (upWick(c0) > body(c0) * 2 && dnWick(c0) < body(c0) * 0.5 && body(c0) < rng(c0) * 0.4)
    pats.push({ name: "Shooting Star", side: "bear", strength: 2 });
  if (body(c0) < rng(c0) * 0.1)
    pats.push({ name: "Doji — Indecision", side: "neutral", strength: 1 });
  if (c0.high < c1.high && c0.low > c1.low)
    pats.push({ name: "Inside Bar", side: "neutral", strength: 1 });
  if (isBull(c2) && isBull(c1) && isBull(c0) && c1.close > c2.close && c0.close > c1.close)
    pats.push({ name: "Three White Soldiers", side: "bull", strength: 3 });
  if (isBear(c2) && isBear(c1) && isBear(c0) && c1.close < c2.close && c0.close < c1.close)
    pats.push({ name: "Three Black Crows", side: "bear", strength: 3 });
  if (isBear(c2) && body(c1) < rng(c1) * 0.3 && isBull(c0) && c0.close > (c2.open + c2.close) / 2)
    pats.push({ name: "Morning Star", side: "bull", strength: 3 });
  if (isBull(c2) && body(c1) < rng(c1) * 0.3 && isBear(c0) && c0.close < (c2.open + c2.close) / 2)
    pats.push({ name: "Evening Star", side: "bear", strength: 3 });

  return pats;
}

// ── Core Signal Engine ─────────────────────────────────────────
function buildSignal(market, candles, htfCandles, livePrice) {
  const { symbol, isJPY = false, isGold = false } = market;
  const isSyn = SYNTHETICS.some(s => s.symbol === symbol);
  const dec   = isGold ? 2 : isJPY ? 3 : isSyn ? 3 : 5;

  const closes = candles.map(c => c.close);
  const price  = livePrice ?? closes[closes.length - 1];

  // ── Indicators (primary TF) ────────────────────────────────
  const ema9   = ema(closes, 9)   ?? price;
  const ema21  = ema(closes, 21)  ?? price;
  const ema50  = ema(closes, 50)  ?? price;
  const ema200 = ema(closes, 200);
  const RSI    = rsiCalc(closes);
  const macdH  = macdHistogram(closes);
  const bb     = bollingerBands(closes);
  const ATR    = atrCalc(candles);
  const pa     = priceActionPatterns(candles);
  const sr     = supportResistance(candles);
  const ms     = marketStructure(candles);
  const sweep  = liquiditySweep(candles, dec);
  const volOk  = isVolatilityHealthy(candles, ATR);

  // ── MTF: Higher Timeframe trend ────────────────────────────
  const htf        = htfTrend(htfCandles);
  const htfConfirms = (side) => htf === "NEUTRAL" || (side === "bull" && htf === "BULL") || (side === "bear" && htf === "BEAR");

  // ── Scoring ────────────────────────────────────────────────
  let bull = 0, bear = 0;
  const factors = [];

  const add = (label, side, pts) => {
    if (side === "bull") bull += pts;
    else if (side === "bear") bear += pts;
    factors.push({ label, side });
  };

  // 1. Volatility filter
  if (!volOk) add("⚠ Low volatility — reduced signal quality", "neutral", 0);

  // 2. MTF Higher TF confirmation (3pts — strong weight)
  if      (htf === "BULL") add(`HTF Trend: BULLISH (higher TF EMA stack up)`,   "bull", 3);
  else if (htf === "BEAR") add(`HTF Trend: BEARISH (higher TF EMA stack down)`,  "bear", 3);
  else                     add(`HTF Trend: NEUTRAL — trade with caution`,         "neutral", 0);

  // 3. EMA Stack primary TF (3pts)
  if      (ema9 > ema21 && ema21 > ema50) add("EMA Stack Bullish: 9 > 21 > 50", "bull", 3);
  else if (ema9 < ema21 && ema21 < ema50) add("EMA Stack Bearish: 9 < 21 < 50", "bear", 3);
  else                                     add("EMA Stack Mixed — no clear trend", "neutral", 0);

  // 4. Price vs EMA21 (1pt)
  if (price > ema21) add("Price above EMA21", "bull", 1);
  else               add("Price below EMA21", "bear", 1);

  // 5. EMA200 long-term bias (1pt)
  if (ema200) {
    if (price > ema200) add("Above EMA200 — long-term bullish", "bull", 1);
    else                add("Below EMA200 — long-term bearish", "bear", 1);
  }

  // 6. RSI (2pts)
  if      (RSI > 55 && RSI < 70) add(`RSI ${RSI.toFixed(1)} — Bullish momentum`,   "bull", 2);
  else if (RSI < 45 && RSI > 30) add(`RSI ${RSI.toFixed(1)} — Bearish momentum`,   "bear", 2);
  else if (RSI >= 70)             add(`RSI ${RSI.toFixed(1)} — Overbought caution`, "bear", 1);
  else if (RSI <= 30)             add(`RSI ${RSI.toFixed(1)} — Oversold bounce`,    "bull", 1);
  else                            add(`RSI ${RSI.toFixed(1)} — Neutral zone`,        "neutral", 0);

  // 7. MACD Histogram (2pts)
  if      (macdH > 0) add(`MACD Histogram positive`, "bull", 2);
  else if (macdH < 0) add(`MACD Histogram negative`, "bear", 2);

  // 8. Bollinger Bands (2pts)
  if      (bb.lower && price < bb.lower) add("Price below Lower BB — oversold",   "bull", 2);
  else if (bb.upper && price > bb.upper) add("Price above Upper BB — overbought", "bear", 2);
  else if (bb.mid) {
    if (price > bb.mid) add("Price above BB midline", "bull", 1);
    else                add("Price below BB midline", "bear", 1);
  }

  // 9. Support & Resistance (2pts each)
  if (sr.nearSupport)    add(`Near Support ${sr.support?.toFixed(dec)}`,    "bull", 2);
  if (sr.nearResistance) add(`Near Resistance ${sr.resistance?.toFixed(dec)}`, "bear", 2);

  // 10. Market Structure (2pts)
  if      (ms === "BULLISH") add("Market Structure: Higher Highs / Higher Lows", "bull", 2);
  else if (ms === "BEARISH") add("Market Structure: Lower Highs / Lower Lows",   "bear", 2);
  else                       add("Market Structure: Ranging / Choppy",            "neutral", 0);

  // 11. Liquidity Sweep (3pts)
  if (sweep) add(sweep.label, sweep.side, 3);

  // 12. Price Action patterns (variable)
  pa.forEach(pat => {
    if      (pat.side === "bull") { bull += pat.strength; factors.push({ label: `PA: ${pat.name}`, side: "bull" }); }
    else if (pat.side === "bear") { bear += pat.strength; factors.push({ label: `PA: ${pat.name}`, side: "bear" }); }
    else                          { factors.push({ label: `PA: ${pat.name}`, side: "neutral" }); }
  });

  // ── Signal: requires score + MTF agreement ─────────────────
  const MAX      = 25; // 3 HTF + 3 EMA + 1 price + 1 ema200 + 2 RSI + 2 MACD + 2 BB + 4 SR + 2 MS + 3 sweep + PA
  const bullConf = Math.min(100, Math.round((bull / MAX) * 100));
  const bearConf = Math.min(100, Math.round((bear / MAX) * 100));
  const trend    = ema9 > ema21 ? "UP" : ema9 < ema21 ? "DOWN" : "FLAT";

  const minScore  = 9;
  const minMargin = 2;

  let signal, confidence, tp1, tp2, sl;

  const bullValid = volOk && bull >= minScore && bull > bear + minMargin && htfConfirms("bull");
  const bearValid = volOk && bear >= minScore && bear > bull + minMargin && htfConfirms("bear");

  if (bullValid) {
    signal = "BUY"; confidence = bullConf;
    sl  = +(price - ATR * 1.5).toFixed(dec);
    tp1 = +(price + ATR * 2.0).toFixed(dec);
    tp2 = +(price + ATR * 3.5).toFixed(dec);
  } else if (bearValid) {
    signal = "SELL"; confidence = bearConf;
    sl  = +(price + ATR * 1.5).toFixed(dec);
    tp1 = +(price - ATR * 2.0).toFixed(dec);
    tp2 = +(price - ATR * 3.5).toFixed(dec);
  } else {
    signal = "WAIT"; confidence = Math.max(bullConf, bearConf);
    sl = tp1 = tp2 = null;
  }

  const pipMult = isGold ? 100 : isJPY ? 100 : isSyn ? 1 : 10000;
  const pips    = ATR ? +(ATR * pipMult).toFixed(1) : null;
  const rr      = tp1 && sl ? +(Math.abs(tp1 - price) / Math.abs(sl - price)).toFixed(2) : null;

  return {
    symbol, price: +price.toFixed(dec), signal, confidence,
    tp1, tp2, sl, rr, pips, factors, bull, bear, MAX,
    timestamp: new Date(), rsi: +RSI.toFixed(1),
    macdH: +macdH.toFixed(6), trend, paPatterns: pa,
    marketStructure: ms, liquiditySweep: sweep, htfTrend: htf,
    ema9: +ema9.toFixed(dec), ema21: +ema21.toFixed(dec), ema50: +ema50.toFixed(dec),
    atr: ATR ? +ATR.toFixed(dec + 1) : null,
    volOk, source: "live",
  };
}

// ── AI Analysis ────────────────────────────────────────────────
async function fetchAIAnalysis(sig, tf) {
  const prompt = `You are a senior trader specializing in forex and synthetic indices. Analyze this ${tf} signal.

Symbol: ${sig.symbol} | Timeframe: ${tf}
Signal: ${sig.signal} | Confluence: ${sig.confidence}%
Price: ${sig.price} | Trend: ${sig.trend}
HTF Trend: ${sig.htfTrend} | Market Structure: ${sig.marketStructure}
${sig.liquiditySweep ? `Liquidity Sweep: ${sig.liquiditySweep.label}` : "No liquidity sweep"}
RSI: ${sig.rsi} | MACD: ${sig.macdH > 0 ? "+" : ""}${sig.macdH} | ATR: ${sig.atr}
EMA 9/21/50: ${sig.ema9} / ${sig.ema21} / ${sig.ema50}
Bull: ${sig.bull}/${sig.MAX} | Bear: ${sig.bear}/${sig.MAX}
PA Patterns: ${sig.paPatterns?.map(p => p.name).join(", ") || "None"}
Factors: ${sig.factors.filter(f => f.side !== "neutral").map(f => f.label).join(" | ")}
${sig.tp1 ? `TP1: ${sig.tp1} | TP2: ${sig.tp2} | SL: ${sig.sl} | R:R: ${sig.rr}` : "WAIT — no trade levels"}

Respond ONLY with this exact JSON, no markdown, no backticks:
{"verdict":"one strong sentence","edge":"strongest reason to take this trade","risk":"biggest threat","bias":"BULLISH|BEARISH|NEUTRAL","winProbability":<integer 40-85>,"action":"exact action right now"}`;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1000, messages: [{ role: "user", content: prompt }] }),
  });
  const data = await res.json();
  const text = data.content?.find(b => b.type === "text")?.text || "{}";
  return JSON.parse(text.replace(/```json|```/g, "").trim());
}

// ── Utilities ──────────────────────────────────────────────────
const fmtTime = d => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
// ── Utilities ──────────────────────────────────────────────────
const fmtTime = d => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ── UI Components ──────────────────────────────────────────────
const SignalBadge = ({ signal }) => {
  const cfg = {
    BUY:  { bg: C.bullDim, color: C.bull, label: "▲ BUY"  },
    SELL: { bg: C.bearDim, color: C.bear, label: "▼ SELL" },
    WAIT: { bg: C.warnDim, color: C.warn, label: "◆ WAIT" },
  }[signal] || {};
  return <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>{cfg.label}</span>;
};

const Pill = ({ label, color, bg }) => (
  <span style={{ fontSize: 10, color, fontWeight: 600, background: bg || C.surface, padding: "2px 7px", borderRadius: 10 }}>{label}</span>
);

const ConfBar = ({ value, signal }) => {
  const color = signal === "BUY" ? C.bull : signal === "SELL" ? C.bear : C.warn;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.sub }}>Confluence</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
};

// ── Signal Card ────────────────────────────────────────────────
function SignalCard({ item, tf, onAnalyze, aiData, aiLoading }) {
  const [expanded, setExpanded] = useState(false);
  const [showPA,   setShowPA]   = useState(false);
  const borderColor = item.signal === "BUY" ? C.bull : item.signal === "SELL" ? C.bear : C.border;

  if (item.error) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.error}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{item.symbol}</span>
          <span style={{ fontSize: 10, color: C.error }}>● ERROR</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{item.error}</div>
      </div>
    );
  }

  const trendColor  = item.trend === "UP" ? C.bull : item.trend === "DOWN" ? C.bear : C.sub;
  const htfColor    = item.htfTrend === "BULL" ? C.bull : item.htfTrend === "BEAR" ? C.bear : C.muted;
  const msColor     = item.marketStructure === "BULLISH" ? C.bull : item.marketStructure === "BEARISH" ? C.bear : C.muted;

  return (
    <div style={{ background: C.card, border: `1px solid ${borderColor}22`, borderLeft: `3px solid ${borderColor}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>

      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.bull, display: "inline-block" }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>{item.symbol}</span>
            <SignalBadge signal={item.signal} />
          </div>
          <div style={{ marginTop: 5, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <Pill label={`${item.trend === "UP" ? "↑" : item.trend === "DOWN" ? "↓" : "→"} ${item.trend}`} color={trendColor} />
            <Pill label={`HTF ${item.htfTrend}`} color={htfColor} />
            <Pill label={item.marketStructure === "BULLISH" ? "HH/HL" : item.marketStructure === "BEARISH" ? "LH/LL" : "Range"} color={msColor} />
            <span style={{ fontSize: 10, color: C.muted }}>{fmtTime(item.timestamp)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: item.signal === "BUY" ? C.bull : item.signal === "SELL" ? C.bear : C.text }}>
            {item.price}
          </div>
          {item.rr && <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>R:R {item.rr}</div>}
        </div>
      </div>

      {/* Score bar */}
      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <div style={{ flex: 1, background: C.bullDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bull, fontWeight: 700, textAlign: "center" }}>▲ {item.bull} bull</div>
        <div style={{ flex: 1, background: C.bearDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bear, fontWeight: 700, textAlign: "center" }}>▼ {item.bear} bear</div>
        <div style={{ background: C.surface, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.muted, textAlign: "center" }}>/{item.MAX}</div>
      </div>

      {/* TP/SL */}
      {item.tp1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[{ l: "TP1", v: item.tp1, c: C.bull }, { l: "TP2", v: item.tp2, c: C.accent }, { l: "SL", v: item.sl, c: C.bear }, { l: "PIPS", v: item.pips, c: C.warn }].map(({ l, v, c }) => (
            <div key={l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", fontSize: 12 }}>
              <span style={{ color: C.sub, marginRight: 4 }}>{l}</span>
              <span style={{ color: c, fontWeight: 700, fontFamily: "monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <ConfBar value={item.confidence} signal={item.signal} />

      {/* Quick stats */}
      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>RSI: <span style={{ color: item.rsi > 70 ? C.bear : item.rsi < 30 ? C.bull : C.sub, fontWeight: 700 }}>{item.rsi}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>ATR: <span style={{ color: C.sub, fontWeight: 700 }}>{item.atr ?? "—"}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>MACD: <span style={{ color: item.macdH > 0 ? C.bull : C.bear, fontWeight: 700 }}>{item.macdH > 0 ? "▲" : "▼"}</span></span>
        {!item.volOk && <span style={{ fontSize: 11, color: C.warn, fontWeight: 600 }}>⚠ Low vol</span>}
      </div>

      {/* Liquidity Sweep */}
      {item.liquiditySweep && (
        <div style={{ marginTop: 8, background: item.liquiditySweep.side === "bull" ? C.bullDim : C.bearDim, borderRadius: 6, padding: "6px 10px", fontSize: 11, color: item.liquiditySweep.side === "bull" ? C.bull : C.bear, fontWeight: 600 }}>
          ⚡ {item.liquiditySweep.label}
        </div>
      )}

      {/* PA Patterns */}
      {item.paPatterns?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowPA(p => !p)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, cursor: "pointer", padding: 0 }}>
            {showPA ? "▲" : "▼"} PA Patterns ({item.paPatterns.length})
          </button>
          {showPA && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {item.paPatterns.map((p, i) => (
                <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: p.side === "bull" ? C.bullDim : p.side === "bear" ? C.bearDim : C.surface, color: p.side === "bull" ? C.bull : p.side === "bear" ? C.bear : C.sub }}>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All factors */}
      <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 8, background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", padding: 0 }}>
        {expanded ? "▲ Hide" : "▼ Show"} all factors ({item.factors.length})
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {item.factors.map((f, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: f.side === "bull" ? C.bullDim : f.side === "bear" ? C.bearDim : C.surface, color: f.side === "bull" ? C.bull : f.side === "bear" ? C.bear : C.sub }}>
              {f.side === "bull" ? "✓" : f.side === "bear" ? "✗" : "—"} {f.label}
            </div>
          ))}
        </div>
      )}

      {/* AI Analysis */}
      {item.signal !== "WAIT" && (
        <div style={{ marginTop: 10 }}>
          {!aiData && !aiLoading && (
            <button onClick={() => onAnalyze(item)} style={{ background: C.accentDim, border: `1px solid ${C.accent}44`, color: C.accent, borderRadius: 6, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", width: "100%" }}>
              ✦ Get AI Analysis
            </button>
          )}
          {aiLoading && <div style={{ color: C.sub, fontSize: 12, textAlign: "center", padding: 10 }}>Analyzing…</div>}
          {aiData && (
            <div style={{ background: C.surface, border: `1px solid ${C.accent}33`, borderRadius: 8, padding: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: C.accent, fontWeight: 700, marginBottom: 6 }}>✦ AI ANALYSIS — {tf}</div>
              <div style={{ fontSize: 13, color: C.text, fontWeight: 600, marginBottom: 10, lineHeight: 1.4 }}>{aiData.verdict}</div>
              {[{ l: "Edge", v: aiData.edge }, { l: "Risk", v: aiData.risk }, { l: "Action", v: aiData.action }].map(({ l, v }) => (
                <div key={l} style={{ marginBottom: 6 }}>
                  <span style={{ fontSize: 11, color: C.sub }}>{l}: </span>
                  <span style={{ fontSize: 12, color: C.text }}>{v}</span>
                </div>
              ))}
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: aiData.bias === "BULLISH" ? C.bullDim : aiData.bias === "BEARISH" ? C.bearDim : C.warnDim, color: aiData.bias === "BULLISH" ? C.bull : aiData.bias === "BEARISH" ? C.bear : C.warn }}>
                  {aiData.bias}
                </span>
                <span style={{ fontSize: 11, color: C.sub }}>Win prob: <strong style={{ color: C.accent }}>{aiData.winProbability}%</strong></span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("forex");
  const [tf,           setTf]           = useState("1h");
  const [signals,      setSignals]      = useState({});
  const [aiMap,        setAiMap]        = useState({});
  const [aiLoading,    setAiLoading]    = useState({});
  const [scanning,     setScanning]     = useState(false);
  const [lastScan,     setLastScan]     = useState(null);
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [stats,        setStats]        = useState({ total: 0, buys: 0, sells: 0, waits: 0 });
  const [liveCount,    setLiveCount]    = useState(0);
  const [countdown,    setCountdown]    = useState(REFRESH_SECONDS);
  const [fetchErrors,  setFetchErrors]  = useState([]);
  const countRef = useRef(REFRESH_SECONDS);
  const tfRef    = useRef(tf);
  tfRef.current  = tf;

  const processMarket = useCallback(async (market, activeTf) => {
    const tfCfg = TIMEFRAMES[activeTf];
    try {
      // Sequential fetches per market to avoid WS overload
      const candles    = await fetchCandles(market.deriv, tfCfg.granularity, tfCfg.candles);
      const htfCandles = await fetchCandles(market.deriv, tfCfg.htfGran, 100);
      const livePrice  = await fetchLivePrice(market.deriv);

      return buildSignal(market, candles, htfCandles, livePrice);
    } catch (e) {
      return { symbol: market.symbol, error: e.message };
    }
  }, []);

  const runScan = useCallback(async (activeTf) => {
    const useTf = activeTf || tfRef.current;
    setScanning(true);
    countRef.current = REFRESH_SECONDS;
    setCountdown(REFRESH_SECONDS);

    const allMarkets = [...FOREX, ...SYNTHETICS];
    // Process in batches of 3 to avoid Deriv WS connection limits
    const batchSize = 3;
    const results = [];
    for (let i = 0; i < allMarkets.length; i += batchSize) {
      const batch = allMarkets.slice(i, i + batchSize);
      const batchResults = await Promise.allSettled(batch.map(m => processMarket(m, useTf)));
      results.push(...batchResults);
    }

    const newSignals = {};
    const errs = [];
    let live = 0;

    results.forEach((r, i) => {
      const m   = allMarkets[i];
      const val = r.status === "fulfilled" ? r.value : { symbol: m.symbol, error: r.reason?.message || "Error" };
      newSignals[m.symbol] = val;
      if (val.error) errs.push(m.symbol);
      else live++;
    });

    setSignals(newSignals);
    setAiMap({});
    setLiveCount(live);
    setFetchErrors(errs);

    const valid = Object.values(newSignals).filter(s => !s.error);
    setStats({ total: valid.length, buys: valid.filter(s => s.signal === "BUY").length, sells: valid.filter(s => s.signal === "SELL").length, waits: valid.filter(s => s.signal === "WAIT").length });
    setLastScan(new Date());
    setScanning(false);
  }, [processMarket]);

  useEffect(() => { runScan(tf); }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) runScan();
    }, 1000);
    return () => clearInterval(tick);
  }, [runScan]);

  const handleTfChange = (newTf) => {
    setTf(newTf);
    setSignals({});
    runScan(newTf);
  };

  const handleAnalyze = async item => {
    setAiLoading(p => ({ ...p, [item.symbol]: true }));
    try {
      const result = await fetchAIAnalysis(item, tf);
      setAiMap(p => ({ ...p, [item.symbol]: result }));
    } catch {
      setAiMap(p => ({ ...p, [item.symbol]: { verdict: "AI unavailable.", edge: "—", risk: "—", action: "—", bias: "NEUTRAL", winProbability: 50 } }));
    }
    setAiLoading(p => ({ ...p, [item.symbol]: false }));
  };

  const currentList = tab === "forex" ? FOREX : SYNTHETICS;
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = `${mins}:${String(secs).padStart(2, "0")}`;

  const visibleSignals = currentList
    .map(m => signals[m.symbol])
    .filter(Boolean)
    .filter(s => s.error || filterSignal === "ALL" || s.signal === filterSignal)
    .sort((a, b) => {
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      return (b.confidence || 0) - (a.confidence || 0);
    });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.text, maxWidth: 480, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900 }}><span style={{ color: C.gold }}>◈</span> MT5 Signal Pro</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
              {lastScan ? `${fmtTime(lastScan)} · next ${countdownStr}` : "Connecting to Deriv…"}
              {liveCount > 0 && <span style={{ color: C.bull, marginLeft: 6 }}>● {liveCount} live</span>}
              {fetchErrors.length > 0 && <span style={{ color: C.error, marginLeft: 6 }}>⚠ {fetchErrors.length} err</span>}
            </div>
          </div>
          <button onClick={() => runScan()} disabled={scanning} style={{ background: scanning ? C.muted : C.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: scanning ? "not-allowed" : "pointer" }}>
            {scanning ? "…" : "↻ Scan"}
          </button>
        </div>

        {/* Timeframe selector */}
        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
          {Object.keys(TIMEFRAMES).map(t => (
            <button key={t} onClick={() => handleTfChange(t)} style={{ flex: 1, background: tf === t ? C.accent : C.card, color: tf === t ? "#000" : C.sub, border: `1px solid ${tf === t ? C.accent : C.border}`, borderRadius: 6, padding: "5px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>

        {/* Stats */}
        {stats.total > 0 && (
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[{ l: "LIVE", v: stats.total, c: C.sub }, { l: "BUY", v: stats.buys, c: C.bull }, { l: "SELL", v: stats.sells, c: C.bear }, { l: "WAIT", v: stats.waits, c: C.warn }].map(({ l, v, c }) => (
              <div key={l} style={{ flex: 1, background: C.card, borderRadius: 6, padding: "5px 6px", textAlign: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
                <div style={{ fontSize: 9, color: C.muted, letterSpacing: 0.5 }}>{l}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
        {["forex", "synthetic"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === t ? C.accent : C.sub, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t === "forex" ? `Forex (${FOREX.length})` : `Synthetic (${SYNTHETICS.length})`}
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div style={{ display: "flex", gap: 6, padding: "10px 16px" }}>
        {["ALL", "BUY", "SELL", "WAIT"].map(f => (
          <button key={f} onClick={() => setFilterSignal(f)} style={{ flex: 1, background: filterSignal === f ? C.accent : C.card, color: filterSignal === f ? "#000" : C.sub, border: `1px solid ${filterSignal === f ? C.accent : C.border}`, borderRadius: 20, padding: "5px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {f}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div style={{ padding: "0 16px 80px" }}>
        {scanning && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14 }}>Scanning {tf} + HTF candles…</div>
            <div style={{ fontSize: 11, marginTop: 6, color: C.muted }}>250 candles · MTF confirmation · Deriv WebSocket</div>
          </div>
        )}
        {!scanning && visibleSignals.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>No signals match this filter</div>
        )}
        {!scanning && visibleSignals.map(item => (
          <SignalCard key={item.symbol} item={item} tf={tf} onAnalyze={handleAnalyze} aiData={aiMap[item.symbol]} aiLoading={aiLoading[item.symbol]} />
        ))}
      </div>

      {/* Footer */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, padding: "8px 16px", textAlign: "center", fontSize: 10, color: C.muted }}>
        Educational only · Trading involves risk · Use proper risk management
      </div>

      <style>{`* { box-sizing: border-box; } button { -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }`}</style>
    </div>
  );
                                                    }
