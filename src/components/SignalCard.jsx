import { useState } from "react";
import C from "../constants/colors.js";
import { fmtTime } from "../utils/formatters.js";

function SignalBadge({ signal }) {
  const cfg = {
    BUY:  { bg: C.bullDim, color: C.bull, label: "▲ BUY"  },
    SELL: { bg: C.bearDim, color: C.bear, label: "▼ SELL" },
    WAIT: { bg: C.warnDim, color: C.warn, label: "◆ WAIT" },
  }[signal] || {};
  return (
    <span style={{ background: cfg.bg, color: cfg.color, padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 1 }}>
      {cfg.label}
    </span>
  );
}

function Pill({ label, color }) {
  return (
    <span style={{ fontSize: 10, color, fontWeight: 600, background: C.surface, padding: "2px 7px", borderRadius: 10 }}>
      {label}
    </span>
  );
}

function ConfBar({ value, signal }) {
  const color = signal === "BUY" ? C.bull : signal === "SELL" ? C.bear : C.warn;
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: C.sub }}>Confluence</span>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}%</span>
      </div>
      <div style={{ height: 5, background: C.border, borderRadius: 3 }}>
        <div style={{ width: `${value}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.6s ease" }} />
      </div>
    </div>
  );
}

export default function SignalCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [showPA,   setShowPA]   = useState(false);
  const [showCP,   setShowCP]   = useState(false);
  const borderColor = item.signal === "BUY" ? C.bull : item.signal === "SELL" ? C.bear : C.border;

  if (item.error) {
    return (
      <div style={{ background: C.card, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.error}`, borderRadius: 10, padding: "12px 16px", marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 800, fontSize: 14 }}>{item.symbol}</span>
          <span style={{ fontSize: 10, color: C.error }}>● ERROR</span>
        </div>
        <div style={{ fontSize: 12, color: C.muted, marginTop: 4 }}>{item.error}</div>
      </div>
    );
  }

  const trendColor = item.trend === "UP" ? C.bull : item.trend === "DOWN" ? C.bear : C.sub;
  const htfColor   = item.htfTrend === "BULL" ? C.bull : item.htfTrend === "BEAR" ? C.bear : C.muted;
  const msColor    = item.marketStructure === "BULLISH" ? C.bull : item.marketStructure === "BEARISH" ? C.bear : C.muted;

  return (
    <div style={{ background: C.card, border: `1px solid ${borderColor}22`, borderLeft: `3px solid ${borderColor}`, borderRadius: 10, padding: "14px 16px", marginBottom: 10 }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.bull, display: "inline-block" }} />
            <span style={{ fontWeight: 800, fontSize: 15 }}>{item.symbol}</span>
            <SignalBadge signal={item.signal} />
          </div>
          <div style={{ marginTop: 5, display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
            <Pill label={`${item.trend === "UP" ? "↑" : item.trend === "DOWN" ? "↓" : "→"} ${item.trend}`} color={trendColor} />
            <Pill label={`HTF ${item.htfTrend}`} color={htfColor} />
            <Pill label={item.marketStructure === "BULLISH" ? "HH/HL" : item.marketStructure === "BEARISH" ? "LH/LL" : "Range"} color={msColor} />
            <span style={{ fontSize: 10, color: C.muted }}>{fmtTime(item.timestamp)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 900, fontFamily: "monospace", color: item.signal === "BUY" ? C.bull : item.signal === "SELL" ? C.bear : C.text }}>
            {item.price}
          </div>
          {item.rr && <div style={{ fontSize: 11, color: C.accent, fontWeight: 700 }}>R:R {item.rr}</div>}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
        <div style={{ flex: 1, background: C.bullDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bull, fontWeight: 700, textAlign: "center" }}>▲ {item.bull} bull</div>
        <div style={{ flex: 1, background: C.bearDim, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.bear, fontWeight: 700, textAlign: "center" }}>▼ {item.bear} bear</div>
        <div style={{ background: C.surface, borderRadius: 4, padding: "3px 8px", fontSize: 11, color: C.muted, textAlign: "center" }}>/{item.MAX}</div>
      </div>

      {item.tp1 && (
        <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
          {[{ l: "TP1", v: item.tp1, c: C.bull }, { l: "TP2", v: item.tp2, c: C.accent }, { l: "SL", v: item.sl, c: C.bear }, { l: "PIPS", v: item.pips, c: C.warn }].map(({ l, v, c }) => (
            <div key={l} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 5, padding: "4px 10px", fontSize: 12 }}>
              <span style={{ color: C.sub, marginRight: 4 }}>{l}</span>
              <span style={{ color: c, fontWeight: 700, fontFamily: "monospace" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      <ConfBar value={item.confidence} signal={item.signal} />

      <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: C.muted }}>RSI: <span style={{ color: item.rsi > 70 ? C.bear : item.rsi < 30 ? C.bull : C.sub, fontWeight: 700 }}>{item.rsi}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>ATR: <span style={{ color: C.sub, fontWeight: 700 }}>{item.atr ?? "—"}</span></span>
        <span style={{ fontSize: 11, color: C.muted }}>MACD: <span style={{ color: item.macdH > 0 ? C.bull : C.bear, fontWeight: 700 }}>{item.macdH > 0 ? "▲" : "▼"}</span></span>
        {!item.volOk && <span style={{ fontSize: 11, color: C.warn, fontWeight: 600 }}>⚠ Low vol</span>}
      </div>

      {item.liquiditySweep && (
        <div style={{ marginTop: 8, background: item.liquiditySweep.side === "bull" ? C.bullDim : C.bearDim, borderRadius: 6, padding: "6px 10px", fontSize: 11, color: item.liquiditySweep.side === "bull" ? C.bull : C.bear, fontWeight: 600 }}>
          ⚡ {item.liquiditySweep.label}
        </div>
      )}

      {item.paPatterns?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowPA(p => !p)} style={{ background: "none", border: "none", color: C.gold, fontSize: 12, padding: 0 }}>
            {showPA ? "▲" : "▼"} PA Patterns ({item.paPatterns.length})
          </button>
          {showPA && (
            <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 5 }}>
              {item.paPatterns.map((p, i) => (
                <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 20, fontWeight: 600, background: p.side === "bull" ? C.bullDim : p.side === "bear" ? C.bearDim : C.surface, color: p.side === "bull" ? C.bull : p.side === "bear" ? C.bear : C.sub }}>
                  {p.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {item.chartPatterns?.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <button onClick={() => setShowCP(p => !p)} style={{ background: "none", border: "none", color: C.accent, fontSize: 12, padding: 0 }}>
            {showCP ? "▲" : "▼"} 📊 Chart Patterns ({item.chartPatterns.length})
          </button>
          {showCP && (
            <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 5 }}>
              {item.chartPatterns.map((p, i) => (
                <div key={i} style={{ background: p.side === "bull" ? C.bullDim : C.bearDim, border: `1px solid ${p.side === "bull" ? C.bull : C.bear}33`, borderRadius: 6, padding: "6px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: p.side === "bull" ? C.bull : C.bear }}>{p.name}</div>
                  {p.desc && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{p.desc}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={() => setExpanded(e => !e)} style={{ marginTop: 8, background: "none", border: "none", color: C.accent, fontSize: 12, padding: 0 }}>
        {expanded ? "▲ Hide" : "▼ Show"} all factors ({item.factors.length})
      </button>
      {expanded && (
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
          {item.factors.map((f, i) => (
            <div key={i} style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: f.side === "bull" ? C.bullDim : f.side === "bear" ? C.bearDim : C.surface, color: f.side === "bull" ? C.bull : f.side === "bear" ? C.bear : C.sub }}>
              {f.side === "bull" ? "✓" : f.side === "bear" ? "✗" : "—"} {f.label}
            </div>
          ))}
        </div>
      )}

    </div>
  );
}
  
