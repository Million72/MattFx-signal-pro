export const TIMEFRAMES = {
  "1m":  { granularity: 60,    htfGran: 300,   candles: 250 },
  "5m":  { granularity: 300,   htfGran: 3600,  candles: 250 },
  "15m": { granularity: 900,   htfGran: 3600,  candles: 250 },
  "1h":  { granularity: 3600,  htfGran: 14400, candles: 250 },
  "4h":  { granularity: 14400, htfGran: 86400, candles: 250 },
};

export const REFRESH_SECONDS = 600;
