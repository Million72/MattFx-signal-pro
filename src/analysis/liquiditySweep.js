export function liquiditySweep(candles, dec) {
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
