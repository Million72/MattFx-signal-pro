export function priceActionPatterns(candles) {
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

  // Conflict resolution
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
