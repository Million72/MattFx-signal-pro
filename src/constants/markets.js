export const FOREX = [
  { symbol: "XAUUSD", name: "Gold",    deriv: "frxXAUUSD", isJPY: false, isGold: true  },
  { symbol: "EURUSD", name: "EUR/USD", deriv: "frxEURUSD", isJPY: false, isGold: false },
  { symbol: "GBPUSD", name: "GBP/USD", deriv: "frxGBPUSD", isJPY: false, isGold: false },
  { symbol: "USDJPY", name: "USD/JPY", deriv: "frxUSDJPY", isJPY: true,  isGold: false },
  { symbol: "AUDUSD", name: "AUD/USD", deriv: "frxAUDUSD", isJPY: false, isGold: false },
  { symbol: "USDCAD", name: "USD/CAD", deriv: "frxUSDCAD", isJPY: false, isGold: false },
  { symbol: "USDCHF", name: "USD/CHF", deriv: "frxUSDCHF", isJPY: false, isGold: false },
  { symbol: "EURJPY", name: "EUR/JPY", deriv: "frxEURJPY", isJPY: true,  isGold: false },
  { symbol: "GBPJPY", name: "GBP/JPY", deriv: "frxGBPJPY", isJPY: true,  isGold: false },
  { symbol: "EURGBP", name: "EUR/GBP", deriv: "frxEURGBP", isJPY: false, isGold: false },
];

export const SYNTHETICS = [
  { symbol: "Volatility 10",  name: "V10",   deriv: "R_10",      isJPY: false, isGold: false },
  { symbol: "Volatility 25",  name: "V25",   deriv: "R_25",      isJPY: false, isGold: false },
  { symbol: "Volatility 50",  name: "V50",   deriv: "R_50",      isJPY: false, isGold: false },
  { symbol: "Volatility 75",  name: "V75",   deriv: "R_75",      isJPY: false, isGold: false },
  { symbol: "Volatility 100", name: "V100",  deriv: "R_100",     isJPY: false, isGold: false },
  { symbol: "1HZ10V",         name: "1Hz10", deriv: "1HZ10V",    isJPY: false, isGold: false },
  { symbol: "Step Index",     name: "Step",  deriv: "stpRNG",    isJPY: false, isGold: false },
  { symbol: "Jump 10",        name: "Jmp10", deriv: "JD10",      isJPY: false, isGold: false },
];
