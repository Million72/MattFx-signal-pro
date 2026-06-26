export function rsiCalc(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  const d = closes.slice(1).map((c, i) => c - closes[i]);
  let ag = 0, al = 0;
  d.slice(0, period).forEach(x => { if (x > 0) ag += x; else al -= x; });
  ag /= period; al /= period;
  for (let i = period; i < d.length; i++) {
    ag = (ag * (period - 1) + Math.max(d[i], 0)) / period;
    al = (al * (period - 1) + Math.max(-d[i], 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}
