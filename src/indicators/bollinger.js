export function bollingerBands(closes, period = 20) {
  if (closes.length < period) return {};
  const s = closes.slice(-period);
  const mid = s.reduce((a, b) => a + b, 0) / period;
  const std = Math.sqrt(s.map(x => (x - mid) ** 2).reduce((a, b) => a + b, 0) / period);
  return { upper: mid + 2 * std, lower: mid - 2 * std, mid };
}
