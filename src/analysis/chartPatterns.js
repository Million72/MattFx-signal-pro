export function detectChartPatterns(candles, dec) {
  if (candles.length < 30) return [];
  const pats = [];
  const slice = candles.slice(-60);
  const n = slice.length;
  const tol = 0.015;

  const isLow  = (i, w=3) => slice.slice(Math.max(0,i-w), i+w+1).every(c => c.low  >= slice[i].low);
  const isHigh = (i, w=3) => slice.slice(Math.max(0,i-w), i+w+1).every(c => c.high <= slice[i].high);

  const swingLows = [], swingHighs = [];
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

  // Inverse H&S
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
