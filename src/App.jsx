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

const TIMEFRAMES = {
  "1m":  { granularity: 60,    htfGran: 300,   candles: 250 },
  "5m":  { granularity: 300,   htfGran: 3600,  candles: 250 },
  "15m": { granularity: 900,   htfGran: 3600,  candles: 250 },
  "1h":  { granularity: 3600,  htfGran: 14400, candles: 250 },
  "4h":  { granularity: 14400, htfGran: 86400, candles: 250 },
};

const REFRESH_SECONDS = 300;
const DERIV_APP_ID   = "1089";

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
function derivWS(request, timeoutMs = 30000) {
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
    ticks_history: derivSymbol, adjust_start_time: 1,
    count, end: "latest", granularity, style: "candles",
  });
  const candles = (d.candles || []).map(c => ({
    open: +c.open, high: +c.high, low: +c.low, close: +c.close, time: c.epoch * 1000,
  }));
  const livePrice = candles.length ? candles[candles.length - 1].close : null;
  return { candles, livePrice };
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
  const macdLine = e12 - e26;
  const series = [];
  for (let i = 26; i <= closes.length; i++) {
    const a = ema(closes.slice(0, i), 12), b = ema(closes.slice(0, i), 26);
    if (a && b) series.push(a - b);
  }
  return macdLine - (ema(series, 9) ?? macdLine);
}

function bollingerBands(closes, p = 20) {
  if (closes.length < p) return {};
  const s = closes.slice(-p);
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

function htfTrend(htfCandles) {
  if (!htfCandles || htfCandles.length < 50) return "NEUTRAL";
  const closes = htfCandles.map(c => c.close);
  const e9 = ema(closes, 9), e21 = ema(closes, 21), e50 = ema(closes, 50);
  if (!e9 || !e21 || !e50) return "NEUTRAL";
  if (e9 > e21 && e21 > e50) return "BULL";
  if (e9 < e21 && e21 < e50) return "BEAR";
  return "NEUTRAL";
}

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

function liquiditySweep(candles, dec) {
  if (candles.length < 20) return null;
  const look = candles.slice(-20, -1);
  const last = candles[candles.length - 1];
  const hi = Math.max(...look.map(c => c.high));
  const lo = Math.min(...look.map(c => c.low));
  if (last.low < lo && last.close > lo)
    return { side: "bull", label: `Liq. Sweep below ${lo.toFixed(dec)} → Bullish` };
  if (last.high > hi && last.close < hi)
    return { side: "bear", label: `Liq. Sweep above ${hi.toFixed(dec)} → Bearish` };
  return null;
}

function supportResistance(candles) {
  if (candles.length < 10) return {};
  const s = candles.slice(-20);
  const resistance = Math.max(...s.map(c => c.high));
  const support    = Math.min(...s.map(c => c.low));
  const price = candles[candles.length - 1].close;
  const rng   = resistance - support || 1;
  return {
    support, resistance,
    nearSupport:    (price - support)    < rng * 0.08,
    nearResistance: (resistance - price) < rng * 0.08,
  };
}

function isVolatilityHealthy(candles, atrValue) {
  if (!atrValue || candles.length < 20) return true;
  const avg = candles.slice(-20).reduce((a, c) => a + (c.high - c.low), 0) / 20;
  return atrValue >= avg * 0.3;
}

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
    pats.push({ name: "Doji", side: "neutral", strength: 1 });
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

  const hasStrong = pats.some(p => p.strength >= 3);
  if (hasStrong) return pats.filter(p => p.name !== "Doji" && p.name !== "Inside Bar");
  const hasBull = pats.some(p => p.side === "bull" && p.strength >= 2);
  const hasBear = pats.some(p => p.side === "bear" && p.strength >= 2);
  if (hasBull && hasBear) {
    const bs = pats.filter(p => p.side === "bull").reduce((a, p) => a + p.strength, 0);
    const rs = pats.filter(p => p.side === "bear").reduce((a, p) => a + p.strength, 0);
    if (bs > rs) return pats.filter(p => p.side !== "bear" || p.strength < 2);
    if (rs > bs) return pats.filter(p => p.side !== "bull" || p.strength < 2);
  }
  return pats;
}

function detectChartPatterns(candles, dec) {
  if (candles.length < 30) return [];
  const pats = [];
  const slice = candles.slice(-60);
  const n = slice.length;
  const tol = 0.015;

  const isLow  = (i, w=3) => slice.slice(Math.max(0,i-w), i+w+1).every(c => c.low  >= slice[i].low);
  const isHigh = (i, w=3) => slice.slice(Math.max(0,i-w), i+w+1).every(c => c.high <= slice[i].high);

  const swingLows  = [];
  const swingHighs = [];
  for (let i = 3; i < n - 3; i++) {
    if (isLow(i))  swingLows.push({ i, price: slice[i].low });
    if (isHigh(i)) swingHighs.push({ i, price: slice[i].high });
  }

  // Double Bottom
  for (let a = 0; a < swingLows.length - 1; a++) {
    for (let b = a + 1; b < swingLows.length; b++) {
      const l1 = swingLows[a], l2 = swingLows[b];
      if (l2.i - l1.i < 5) continue;
      if (Math.abs(l1.price - l2.price) / l1.price < tol) {
        const peakBetween = swingHighs.some(h => h.i > l1.i && h.i < l2.i);
        if (peakBetween) {
          const curr = slice[n-1].close;
          const neck = swingHighs.filter(h => h.i > l1.i && h.i < l2.i).sort((a,b) => b.price - a.price)[0];
          const broke = neck && curr > neck.price;
          pats.push({ name: broke ? "Double Bottom — Breakout ✓" : "Double Bottom Forming", side: "bull", strength: broke ? 4 : 2, desc: `Lows ~${l1.price.toFixed(dec)}` });
          break;
        }
      }
    }
    if (pats.some(p => p.name.includes("Double Bottom"))) break;
  }

  // Double Top
  for (let a = 0; a < swingHighs.length - 1; a++) {
    for (let b = a + 1; b < swingHighs.length; b++) {
      const h1 = swingHighs[a], h2 = swingHighs[b];
      if (h2.i - h1.i < 5) continue;
      if (Math.abs(h1.price - h2.price) / h1.price < tol) {
        const troughBetween = swingLows.some(l => l.i > h1.i && l.i < h2.i);
        if (troughBetween) {
          const curr = slice[n-1].close;
          const neck = swingLows.filter(l => l.i > h1.i && l.i < h2.i).sort((a,b) => a.price - b.price)[0];
          const broke = neck && curr < neck.price;
          pats.push({ name: broke ? "Double Top — Breakdown ✓" : "Double Top Forming", side: "bear", strength: broke ? 4 : 2, desc: `Highs ~${h1.price.toFixed(dec)}` });
          break;
        }
      }
    }
    if (pats.some(p => p.name.includes("Double Top"))) break;
  }

  // Head & Shoulders
  for (let i = 0; i < swingHighs.length - 2; i++) {
    const L = swingHighs[i], H = swingHighs[i+1], R = swingHighs[i+2];
    if (H.price > L.price && H.price > R.price && Math.abs(L.price - R.price) / L.price < tol * 2) {
      const lt = swingLows.find(l => l.i > L.i && l.i < H.i);
      const rt = swingLows.find(l => l.i > H.i && l.i < R.i);
      if (lt && rt) {
        const neck = (lt.price + rt.price) / 2;
        const broke = slice[n-1].close < neck;
        pats.push({ name: broke ? "H&S — Neckline Broken ✓" : "Head & Shoulders Forming", side: "bear", strength: broke ? 5 : 3, desc: `Head ${H.price.toFixed(dec)}, neck ${neck.toFixed(dec)}` });
      }
    }
  }

  // Inverse Head & Shoulders
  for (let i = 0; i < swingLows.length - 2; i++) {
    const L = swingLows[i], H = swingLows[i+1], R = swingLows[i+2];
    if (H.price < L.price && H.price < R.price && Math.abs(L.price - R.price) / L.price < tol * 2) {
      const lp = swingHighs.find(h => h.i > L.i && h.i < H.i);
      const rp = swingHighs.find(h => h.i > H.i && h.i < R.i);
      if (lp && rp) {
        const neck = (lp.price + rp.price) / 2;
        const broke = slice[n-1].close > neck;
        pats.push({ name: broke ? "Inv H&S — Breakout ✓" : "Inv Head & Shoulders Forming", side: "bull", strength: broke ? 5 : 3, desc: `Head ${H.price.toFixed(dec)}, neck ${neck.toFixed(dec)}` });
      }
    }
  }

  // Rising Wedge (bearish)
  if (swingHighs.length >= 3 && swingLows.length >= 3) {
    const rh = swingHighs.slice(-3), rl = swingLows.slice(-3);
    if (rh[2].price > rh[1].price && rh[1].price > rh[0].price &&
        rl[2].price > rl[1].price && rl[1].price > rl[0].price) {
      const hs = (rh[2].price - rh[0].price) / (rh[2].i - rh[0].i);
      const ls = (rl[2].price - rl[0].price) / (rl[2].i - rl[0].i);
      if (ls > hs * 0.8) pats.push({ name: "Rising Wedge — Bearish", side: "bear", strength: 3, desc: "Converging highs & lows trending up" });
    }
  }

  // Falling Wedge (bullish)
  if (swingHighs.length >= 3 && swingLows.length >= 3) {
    const rh = swingHighs.slice(-3), rl = swingLows.slice(-3);
    if (rh[2].price < rh[1].price && rh[1].price < rh[0].price &&
        rl[2].price < rl[1].price && rl[1].price < rl[0].price) {
      const hs = (rh[0].price - rh[2].price) / (rh[2].i - rh[0].i);
      const ls = (rl[0].price - rl[2].price) / (rl[2].i - rl[0].i);
      if (hs > ls * 0.8) pats.push({ name: "Falling Wedge — Bullish", side: "bull", strength: 3, desc: "Converging highs & lows trending down" });
    }
  }

  // BOS
  if (swingHighs.length && swingLows.length) {
    const lastHigh = swingHighs[swingHighs.length - 1];
    const lastLow  = swingLows[swingLows.length - 1];
    const curr = slice[n-1].close;
    if (curr > lastHigh.price)
      pats.push({ name: `BOS Bullish — broke ${lastHigh.price.toFixed(dec)}`, side: "bull", strength: 3, desc: "Closed above last swing high" });
    else if (curr < lastLow.price)
      pats.push({ name: `BOS Bearish — broke ${lastLow.price.toFixed(dec)}`, side: "bear", strength: 3, desc: "Closed below last swing low" });
  }

  return pats;
}

// ── Signal Engine ──────────────────────────────────────────────
function buildSignal(market, candles, htfCandles, livePrice) {
  const { symbol, isJPY = false, isGold = false } = market;
  const isSyn = SYNTHETICS.some(s => s.symbol === symbol);
  const lastClose = candles.length ? candles[candles.length-1].close : 0;
  const dec = isGold ? 2 : isJPY ? 3 : isSyn ? (lastClose > 999 ? 2 : 3) : 5;

  const closes = candles.map(c => c.close);
  const price  = livePrice ?? closes[closes.length - 1];

  const ema9   = ema(closes, 9)   ?? price;
  const ema21  = ema(closes, 21)  ?? price;
  const ema50  = ema(closes, 50)  ?? price;
  const ema200 = ema(closes, 200);
  const RSI    = rsiCalc(closes);
  const macdH  = macdHistogram(closes);
  const bb     = bollingerBands(closes);
  const ATR    = atrCalc(candles);
  const pa     = priceActionPatterns(candles);
  const cp     = detectChartPatterns(candles, dec);
  const sr     = supportResistance(candles);
  const ms     = marketStructure(candles);
  const sweep  = liquiditySweep(candles, dec);
  const volOk  = isVolatilityHealthy(candles, ATR);
  const htf    = htfTrend(htfCandles);
  const htfOk  = (side) => htf === "NEUTRAL" || (side === "bull" && htf === "BULL") || (side === "bear" && htf === "BEAR");

  let bull = 0, bear = 0;
  const factors = [];
  const add = (label, side, pts) => {
    if (side === "bull") bull += pts;
    else if (side === "bear") bear += pts;
    factors.push({ label, side });
  };

  if (!volOk) add("Low volatility — reduced quality", "neutral", 0);
  if (htf === "BULL")    add("HTF Trend: BULLISH",  "bull", 3);
  else if (htf === "BEAR") add("HTF Trend: BEARISH", "bear", 3);
  else                   add("HTF Trend: NEUTRAL",   "neutral", 0);

  if (ema9 > ema21 && ema21 > ema50)      add("EMA Stack Bullish 9>21>50", "bull", 3);
  else if (ema9 < ema21 && ema21 < ema50) add("EMA Stack Bearish 9<21<50", "bear", 3);
  else                                     add("EMA Stack Mixed",           "neutral", 0);

  if (price > ema21) add("Price above EMA21", "bull", 1);
  else               add("Price below EMA21", "bear", 1);

  if (ema200) {
    if (price > ema200) add("Above EMA200 — long-term bullish", "bull", 1);
    else                add("Below EMA200 — long-term bearish", "bear", 1);
  }

  if      (RSI > 55 && RSI < 70) add(`RSI ${RSI.toFixed(1)} — Bullish momentum`,   "bull", 2);
  else if (RSI < 45 && RSI > 30) add(`RSI ${RSI.toFixed(1)} — Bearish momentum`,   "bear", 2);
  else if (RSI >= 70)             add(`RSI ${RSI.toFixed(1)} — Overbought`,          "bear", 1);
  else if (RSI <= 30)             add(`RSI ${RSI.toFixed(1)} — Oversold`,            "bull", 1);
  else                            add(`RSI ${RSI.toFixed(1)} — Neutral`,             "neutral", 0);

  if (macdH > 0) add("MACD Histogram positive", "bull", 2);
  else if (macdH < 0) add("MACD Histogram negative", "bear", 2);

  if (bb.lower && price < bb.lower)      add("Below Lower Bollinger Band", "bull", 2);
  else if (bb.upper && price > bb.upper) add("Above Upper Bollinger Band", "bear", 2);
  else if (bb.mid) {
    if (price > bb.mid) add("Above BB midline", "bull", 1);
    else                add("Below BB midline", "bear", 1);
  }

  if (sr.nearSupport)    add(`Near Support ${sr.support?.toFixed(dec)}`,    "bull", 2);
  if (sr.nearResistance) add(`Near Resistance ${sr.resistance?.toFixed(dec)}`, "bear", 2);

  if (ms === "BULLISH")      add("Market Structure: HH/HL", "bull", 2);
  else if (ms === "BEARISH") add("Market Structure: LH/LL", "bear", 2);
  else                       add("Market Structure: Ranging", "neutral", 0);

  if (sweep) add(sweep.label, sweep.side, 3);

  pa.forEach(p => {
    if      (p.side === "bull") { bull += p.strength; factors.push({ label: `PA: ${p.name}`, side: "bull" }); }
    else if (p.side === "bear") { bear += p.strength; factors.push({ label: `PA: ${p.name}`, side: "bear" }); }
    else                        { factors.push({ label: `PA: ${p.name}`, side: "neutral" }); }
  });

  cp.forEach(p => {
    if      (p.side === "bull") { bull += p.strength; factors.push({ label: `📊 ${p.name}`, side: "bull" }); }
    else if (p.side === "bear") { bear += p.strength; factors.push({ label: `📊 ${p.name}`, side: "bear" }); }
  });

  const MAX = 30;
  const bullConf = Math.min(100, Math.round((bull / MAX) * 100));
  const bearConf = Math.min(100, Math.round((bear / MAX) * 100));
  const trend    = ema9 > ema21 ? "UP" : ema9 < ema21 ? "DOWN" : "FLAT";
  const minScore = 10, minMargin = 3;
  const macdOkBull = macdH >= 0 || bull - bear >= 5;
  const macdOkBear = macdH <= 0 || bear - bull >= 5;
  const bullValid  = volOk && bull >= minScore && bull > bear + minMargin && htfOk("bull") && macdOkBull;
  const bearValid  = volOk && bear >= minScore && bear > bull + minMargin && htfOk("bear") && macdOkBear;

  let signal, confidence, tp1, tp2, sl;
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
    timestamp: new Date(), rsi: +RSI.toFixed(1), macdH: +macdH.toFixed(6),
    trend, paPatterns: pa, chartPatterns: cp,
    marketStructure: ms, liquiditySweep: sweep, htfTrend: htf,
    ema9: +ema9.toFixed(dec), ema21: +ema21.toFixed(dec), ema50: +ema50.toFixed(dec),
    atr: ATR ? +ATR.toFixed(dec + 1) : null, volOk, source: "live",
  };
}

// ── Utilities ──────────────────────────────────────────────────
const fmtTime = d => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

// ── UI Components ──────────────────────────────────────────────
function SignalBadge({ signal }) {
  const cfg = {
    BUY:  { bg: C.bullDim, color: C.bull, label: "▲ BUY"  },
    SELL: { bg: C.bearDim, color: C.bear, label: "▼ SELL" },
    WAIT: { bg: C.warnDim, color: C.warn, label: "◆ WAIT" },
  }[signal] || {};
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
      {cfg.label}
    </span>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{ fontSize: 10, color, fontWeight: 600, background: C.surface, padding: "2px 7px", borderRadius: 10 }}>
      {label}
    </span>
  );
}

function ConfBar({ value, signal }) {
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
}

// ── Signal Card ────────────────────────────────────────────────
function SignalCard({ item, tf }) {
  const [expanded, setExpanded] = useState(false);
  const [showPA,   setShowPA]   = useState(false);
  const [showCP,   setShowCP]   = useState(false);
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

  const trendColor = item.trend === "UP" ? C.bull : item.trend === "DOWN" ? C.bear : C.sub;
  const htfColor   = item.htfTrend === "BULL" ? C.bull : item.htfTrend === "BEAR" ? C.bear : C.muted;
  const msColor    = item.marketStructure === "BULLISH" ? C.bull : item.marketStructure === "BEARISH" ? C.bear : C.muted;

  return (
    <div style={{ background: C.card, border: `1px solid ${borderColor}22`, borderLeft: `3px solid ${borderColor}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>

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

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <div style={{ flex: 1, background: C.bullDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bull, fontWeight: 700, textAlign: "center" }}>▲ {item.bull} bull</div>
        <div style={{ flex: 1, background: C.bearDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bear, fontWeight: 700, textAlign: "center" }}>▼ {item.bear} bear</div>
        <div style={{ background: C.surface, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.muted, textAlign: "center" }}>/{item.MAX}</div>
      </div>

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

      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>RSI: <span style={{ color: item.rsi > 70 ? C.bear : item.rsi < 30 ? C.bull : C.sub, fontWeight: 700 }}>{item.rsi}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>ATR: <span style={{ color: C.sub, fontWeight: 700 }}>{item.atr ?? "—"}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>MACD: <span style={{ color: item.macdH > 0 ? C.bull : C.bear, fontWeight: 700 }}>{item.macdH > 0 ? "▲" : "▼"}</span></span>
        {!item.volOk && <span style={{ fontSize: 11, color: C.warn, fontWeight: 600 }}>⚠ Low vol</span>}
      </div>

      {item.liquiditySweep && (
        <div style={{ marginTop: 8, background: item.liquiditySweep.side === "bull" ? C.bullDim : C.bearDim, borderRadius: 6, padding: "6px 10px", fontSize: 11, color: item.liquiditySweep.side === "bull" ? C.bull : C.bear, fontWeight: 600 }}>
          ⚡ {item.liquiditySweep.label}
        </div>
      )}

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

      {item.chartPatterns?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowCP(p => !p)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, cursor: "pointer", padding: 0 }}>
            {showCP ? "▲" : "▼"} 📊 Chart Patterns ({item.chartPatterns.length})
          </button>
          {showCP && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
              {item.chartPatterns.map((p, i) => (
                <div key={i} style={{ background: p.side === "bull" ? C.bullDim : C.bearDim, border: `1px solid ${p.side === "bull" ? C.bull : C.bear}33`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.side === "bull" ? C.bull : C.bear }}>{p.name}</div>
                  {p.desc && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{p.desc}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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

    </div>
    </div>
  );
}

// ── Main App ───────────────────────────────────────────────────
export default function App() {
  const [tab,          setTab]          = useState("forex");
  const [tf,           setTf]           = useState("1h");
  const [signals,      setSignals]      = useState({});
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
    const cfg = TIMEFRAMES[activeTf];
    try {
      const { candles, livePrice } = await fetchCandles(market.deriv, cfg.granularity, cfg.candles);
      const { candles: htfCandles } = await fetchCandles(market.deriv, cfg.htfGran, 100);
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

    const all = [...FOREX, ...SYNTHETICS];
    const results = [];
    const delay = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < all.length; i += 3) {
      const batch = all.slice(i, i + 3);
      const res = await Promise.allSettled(batch.map(m => processMarket(m, useTf)));
      results.push(...res);
      if (i + 3 < all.length) await delay(600);
    }

    const newSignals = {};
    const errs = [];
    let live = 0;
    results.forEach((r, i) => {
      const m   = all[i];
      const val = r.status === "fulfilled" ? r.value : { symbol: m.symbol, error: r.reason?.message || "Error" };
      newSignals[m.symbol] = val;
      if (val.error) errs.push(m.symbol);
      else live++;
    });

    setSignals(newSignals);
    setLiveCount(live);
    setFetchErrors(errs);

    const valid = Object.values(newSignals).filter(s => !s.error);
    setStats({ total: valid.length, buys: valid.filter(s => s.signal === "BUY").length, sells: valid.filter(s => s.signal === "SELL").length, waits: valid.filter(s => s.signal === "WAIT").length });
    setLastScan(new Date());
    setScanning(false);
  }, [processMarket]);

  useEffect(() => { runScan("1h"); }, []);

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

      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 900 }}><span style={{ color: C.gold }}>◈</span> MT5 Signal Pro</div>
            <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
              {lastScan ? `${fmtTime(lastScan)} · next ${countdownStr}` : "Connecting…"}
              {liveCount > 0 && <span style={{ color: C.bull, marginLeft: 6 }}>● {liveCount} live</span>}
              {fetchErrors.length > 0 && <span style={{ color: C.error, marginLeft: 6 }}>⚠ {fetchErrors.length} err</span>}
            </div>
          </div>
          <button onClick={() => runScan()} disabled={scanning} style={{ background: scanning ? C.muted : C.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: scanning ? "not-allowed" : "pointer" }}>
            {scanning ? "…" : "↻ Scan"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 5, marginTop: 10 }}>
          {Object.keys(TIMEFRAMES).map(t => (
            <button key={t} onClick={() => handleTfChange(t)} style={{ flex: 1, background: tf === t ? C.accent : C.card, color: tf === t ? "#000" : C.sub, border: `1px solid ${tf === t ? C.accent : C.border}`, borderRadius: 6, padding: "5px 0", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              {t}
            </button>
          ))}
        </div>

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

      <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
        {["forex", "synthetic"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === t ? C.accent : C.sub, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", textTransform: "uppercase", letterSpacing: 0.5 }}>
            {t === "forex" ? `Forex (${FOREX.length})` : `Synthetic (${SYNTHETICS.length})`}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "10px 16px" }}>
        {["ALL", "BUY", "SELL", "WAIT"].map(f => (
          <button key={f} onClick={() => setFilterSignal(f)} style={{ flex: 1, background: filterSignal === f ? C.accent : C.card, color: filterSignal === f ? "#000" : C.sub, border: `1px solid ${filterSignal === f ? C.accent : C.border}`, borderRadius: 20, padding: "5px 0", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
            {f}
          </button>
        ))}
      </div>

      <div style={{ padding: "0 16px 80px" }}>
        {scanning && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14 }}>Scanning {tf} + HTF candles…</div>
            <div style={{ fontSize: 11, marginTop: 6, color: C.muted }}>250 candles · MTF · Deriv WebSocket</div>
          </div>
        )}
        {!scanning && visibleSignals.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>No signals match this filter</div>
        )}
        {!scanning && visibleSignals.map(item => (
          <SignalCard key={item.symbol} item={item} tf={tf} />
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, padding: "8px 16px", textAlign: "center", fontSize: 10, color: C.muted }}>
        Educational only · Trading involves risk · Use proper risk management
      </div>

      <style>{`* { box-sizing: border-box; } button { -webkit-tap-highlight-color: transparent; } ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 2px; }`}</style>
    </div>
  );
                         }
