import C from "../constants/colors.js";

export default function StatsBar({ stats }) {
  if (!stats.total) return null;
  return (
    <div style={{ display: "flex", gap: 6, padding: "8px 16px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
      {[{ l: "LIVE", v: stats.total, c: C.sub }, { l: "BUY", v: stats.buys, c: C.bull }, { l: "SELL", v: stats.sells, c: C.bear }, { l: "WAIT", v: stats.waits, c: C.warn }].map(({ l, v, c }) => (
        <div key={l} style={{ flex: 1, background: C.card, borderRadius: 6, padding: "5px 6px", textAlign: "center" }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: c }}>{v}</div>
          <div style={{ fontSize: 9, color: C.muted, letterSpacing: 0.5 }}>{l}</div>
        </div>
      ))}
    </div>
  );
}
