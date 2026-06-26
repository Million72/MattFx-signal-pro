import { ema } from "../indicators/ema.js";
import { rsiCalc } from "../indicators/rsi.js";
import { macdHistogram } from "../indicators/macd.js";
import { bollingerBands } from "../indicators/bollinger.js";
import { atrCalc } from "../indicators/atr.js";
import { marketStructure, supportResistance, htfTrend, isVolatilityHealthy } from "../analysis/marketStructure.js";
import { liquiditySweep } from "../analysis/liquiditySweep.js";
import { priceActionPatterns } from "../analysis/priceActionPatterns.js";
import { detectChartPatterns } from "../analysis/chartPatterns.js";
import { SYNTHETICS } from "../constants/markets.js";

export function buildSignal(market, candles, htfCandles, livePrice) {
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

  if (!volOk)          add("Low volatility — reduced quality", "neutral", 0);
  if (htf === "BULL")  add("HTF Trend: BULLISH", "bull", 3);
  else if (htf === "BEAR") add("HTF Trend: BEARISH", "bear", 3);
  else                 add("HTF Trend: NEUTRAL", "neutral", 0);

  if (ema9 > ema21 && ema21 > ema50)      add("EMA Stack Bullish 9>21>50", "bull", 3);
  else if (ema9 < ema21 && ema21 < ema50) add("EMA Stack Bearish 9<21<50", "bear", 3);
  else                                     add("EMA Stack Mixed",            "neutral", 0);

  if (price > ema21) add("Price above EMA21", "bull", 1);
  else               add("Price below EMA21", "bear", 1);

  if (ema200) {
    if (price > ema200) add("Above EMA200 — long-term bullish", "bull", 1);
    else                add("Below EMA200 — long-term bearish", "bear", 1);
  }

  if      (RSI > 55 && RSI < 70) add(`RSI ${RSI.toFixed(1)} — Bullish momentum`, "bull", 2);
  else if (RSI < 45 && RSI > 30) add(`RSI ${RSI.toFixed(1)} — Bearish momentum`, "bear", 2);
  else if (RSI >= 70)             add(`RSI ${RSI.toFixed(1)} — Overbought`,        "bear", 1);
  else if (RSI <= 30)             add(`RSI ${RSI.toFixed(1)} — Oversold`,          "bull", 1);
  else                            add(`RSI ${RSI.toFixed(1)} — Neutral`,           "neutral", 0);

  if (macdH > 0)      add("MACD Histogram positive", "bull", 2);
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
