import { useState, useEffect, useCallback, useRef } from "react";
import C from "./constants/colors.js";
import { FOREX, SYNTHETICS } from "./constants/markets.js";
import { TIMEFRAMES, REFRESH_SECONDS } from "./constants/timeframes.js";
import { fetchCandles } from "./services/deriv.js";
import { buildSignal } from "./engine/buildSignal.js";
import Header from "./components/Header.jsx";
import TimeframeSelector from "./components/TimeframeSelector.jsx";
import StatsBar from "./components/StatsBar.jsx";
import MarketTabs from "./components/MarketTabs.jsx";
import FilterBar from "./components/FilterBar.jsx";
import SignalCard from "./components/SignalCard.jsx";

export default function App() {
  const [tab,          setTab]          = useState("forex");
  const [tf,           setTf]           = useState("1h");
  const [signals,      setSignals]      = useState({});
  const [scanning,     setScanning]     = useState(false);
  const [lastScan,     setLastScan]     = useState(null);
  const [filterSignal, setFilterSignal] = useState("ALL");
  const [stats,        setStats]        = useState({ total: 0, buys: 0, sells: 0, waits: 0 });
  const [liveCount,    setLiveCount]    = useState(0);
  const [countdown,    setCountdown]    = useState(REFRESH_SECONDS);
  const [fetchErrors,  setFetchErrors]  = useState([]);
  const countRef = useRef(REFRESH_SECONDS);
  const tfRef    = useRef(tf);
  tfRef.current  = tf;

  const processMarket = useCallback(async (market, activeTf) => {
    const cfg = TIMEFRAMES[activeTf];
    try {
      const { candles, livePrice } = await fetchCandles(market.deriv, cfg.granularity, cfg.candles);
      const { candles: htfCandles } = await fetchCandles(market.deriv, cfg.htfGran, 100);
      return buildSignal(market, candles, htfCandles, livePrice);
    } catch (e) {
      return { symbol: market.symbol, error: e.message };
    }
  }, []);

  const runScan = useCallback(async (activeTf) => {
    const useTf = activeTf || tfRef.current;
    setScanning(true);
    countRef.current = REFRESH_SECONDS;
    setCountdown(REFRESH_SECONDS);

    const all = [...FOREX, ...SYNTHETICS];
    const results = [];
    const delay = ms => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < all.length; i += 3) {
      const batch = all.slice(i, i + 3);
      const res = await Promise.allSettled(batch.map(m => processMarket(m, useTf)));
      results.push(...res);
      if (i + 3 < all.length) await delay(600);
    }

    const newSignals = {};
    const errs = [];
    let live = 0;
    results.forEach((r, i) => {
      const m   = all[i];
      const val = r.status === "fulfilled" ? r.value : { symbol: m.symbol, error: r.reason?.message || "Error" };
      newSignals[m.symbol] = val;
      if (val.error) errs.push(m.symbol);
      else live++;
    });

    setSignals(newSignals);
    setLiveCount(live);
    setFetchErrors(errs);

    const valid = Object.values(newSignals).filter(s => !s.error);
    setStats({ total: valid.length, buys: valid.filter(s => s.signal === "BUY").length, sells: valid.filter(s => s.signal === "SELL").length, waits: valid.filter(s => s.signal === "WAIT").length });
    setLastScan(new Date());
    setScanning(false);
  }, [processMarket]);

  useEffect(() => { runScan("1h"); }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      countRef.current -= 1;
      setCountdown(countRef.current);
      if (countRef.current <= 0) runScan();
    }, 1000);
    return () => clearInterval(tick);
  }, [runScan]);

  const handleTfChange = (newTf) => {
    setTf(newTf);
    setSignals({});
    runScan(newTf);
  };

  const currentList = tab === "forex" ? FOREX : SYNTHETICS;
  const visibleSignals = currentList
    .map(m => signals[m.symbol])
    .filter(Boolean)
    .filter(s => s.error || filterSignal === "ALL" || s.signal === filterSignal)
    .sort((a, b) => {
      if (a.error && !b.error) return 1;
      if (!a.error && b.error) return -1;
      return (b.confidence || 0) - (a.confidence || 0);
    });

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: C.text, maxWidth: 480, margin: "0 auto" }}>
      <Header lastScan={lastScan} countdown={countdown} liveCount={liveCount} errorCount={fetchErrors.length} onScan={() => runScan()} scanning={scanning} />
      <TimeframeSelector tf={tf} onChange={handleTfChange} />
      <StatsBar stats={stats} />
      <MarketTabs tab={tab} onChange={setTab} />
      <FilterBar filter={filterSignal} onChange={setFilterSignal} />

      <div style={{ padding: "0 16px 80px" }}>
        {scanning && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
            <div style={{ fontSize: 14 }}>Scanning {tf} + HTF candles…</div>
            <div style={{ fontSize: 11, marginTop: 6, color: C.muted }}>250 candles · MTF · Deriv WebSocket</div>
          </div>
        )}
        {!scanning && visibleSignals.length === 0 && (
          <div style={{ textAlign: "center", padding: 50, color: C.sub }}>No signals match this filter</div>
        )}
        {!scanning && visibleSignals.map(item => (
          <SignalCard key={item.symbol} item={item} />
        ))}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: C.surface, borderTop: `1px solid ${C.border}`, padding: "8px 16px", textAlign: "center", fontSize: 10, color: C.muted }}>
        Educational only · Trading involves risk · Use proper risk management
      </div>
    </div>
  );
  }
              
