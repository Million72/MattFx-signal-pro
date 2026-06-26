const DERIV_APP_ID = "1089";

export function derivWS(request, timeoutMs = 30000) {
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

export async function fetchCandles(derivSymbol, granularity, count = 250) {
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
