export function marketStructure(candles) {
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

export function supportResistance(candles) {
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

export function htfTrend(htfCandles) {
  if (!htfCandles || htfCandles.length < 50) return "NEUTRAL";
  const closes = htfCandles.map(c => c.close);
  // inline ema to avoid circular import
  const calcEma = (prices, p) => {
    if (prices.length < p) return null;
    const k = 2 / (p + 1);
    let v = prices.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < prices.length; i++) v = prices[i] * k + v * (1 - k);
    return v;
  };
  const e9 = calcEma(closes, 9), e21 = calcEma(closes, 21), e50 = calcEma(closes, 50);
  if (!e9 || !e21 || !e50) return "NEUTRAL";
  if (e9 > e21 && e21 > e50) return "BULL";
  if (e9 < e21 && e21 < e50) return "BEAR";
  return "NEUTRAL";
}

export function isVolatilityHealthy(candles, atrValue) {
  if (!atrValue || candles.length < 20) return true;
  const avg = candles.slice(-20).reduce((a, c) => a + (c.high - c.low), 0) / 20;
  return atrValue >= avg * 0.3;
    }
