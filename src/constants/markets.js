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
  { symbol: "Volatility 10",  name: "V10",   deriv: "R_10"      },
  { symbol: "Volatility 25",  name: "V25",   deriv: "R_25"      },
  { symbol: "Volatility 50",  name: "V50",   deriv: "R_50"      },
  { symbol: "Volatility 75",  name: "V75",   deriv: "R_75"      },
  { symbol: "Volatility 100", name: "V100",  deriv: "R_100"     },
  { symbol: "Volatility 10 (1s)",  name: "1Hz10", deriv: "1HZ10V"    },
  { symbol: "Step Index",     name: "Step",  deriv: "stpRNG"    },
  { symbol: "Jump 10",        name: "Jmp10", deriv: "JD10"      },
  //{ symbol: "Boom 300",       name: "B300",  deriv: "BOOM300N"  },
  //{ symbol: "Boom 500",       name: "B500",  deriv: "BOOM500"   },
  //{ symbol: "Crash 300",      name: "C300",  deriv: "CRASH300N" },
  //{ symbol: "Crash 500",      name: "C500",  deriv: "CRASH500"  },

  // --- Newly added ---
  { symbol: "Volatility 5",   name: "V5",    deriv: "R_5"       },
  //{ symbol: "Volatility 15",  name: "V15",   deriv: "R_15"      },
  //{ symbol: "Volatility 30",  name: "V30",   deriv: "R_30"      },
  //{ symbol: "Volatility 90",  name: "V90",   deriv: "R_90"      },

  { symbol: "Volatility 5 (1s)",   name: "1Hz5",   deriv: "1HZ5V"   },
  { symbol: "Volatility 15 (1s)",  name: "1Hz15",  deriv: "1HZ15V"  },
  { symbol: "Volatility 25 (1s)",  name: "1Hz25",  deriv: "1HZ25V"  },
  { symbol: "Volatility 30 (1s)",  name: "1Hz30",  deriv: "1HZ30V"  },
  { symbol: "Volatility 50 (1s)",  name: "1Hz50",  deriv: "1HZ50V"  },
  { symbol: "Volatility 75 (1s)",  name: "1Hz75",  deriv: "1HZ75V"  },
  { symbol: "Volatility 90 (1s)",  name: "1Hz90",  deriv: "1HZ90V"  },
  { symbol: "Volatility 100 (1s)", name: "1Hz100", deriv: "1HZ100V" },
  { symbol: "Volatility 150 (1s)", name: "1Hz150", deriv: "1HZ150V" },

  //{ symbol: "Boom 600",   name: "B600",   deriv: "BOOM600"   },
  //{ symbol: "Boom 1000",  name: "B1000",  deriv: "BOOM1000"  },
  //{ symbol: "Crash 600",  name: "C600",   deriv: "CRASH600"  },
  //{ symbol: "Crash 1000", name: "C1000",  deriv: "CRASH1000" },
];
    
