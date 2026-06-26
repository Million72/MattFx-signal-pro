import { ema } from "./ema.js";

export function macdHistogram(closes) {
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
