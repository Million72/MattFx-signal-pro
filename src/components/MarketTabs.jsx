import C from "../constants/colors.js";
import { FOREX, SYNTHETICS } from "../constants/markets.js";

export default function MarketTabs({ tab, onChange }) {
  return (
    <div style={{ display: "flex", background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "0 16px" }}>
      {["forex", "synthetic"].map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{ background: "none", border: "none", borderBottom: tab === t ? `2px solid ${C.accent}` : "2px solid transparent", color: tab === t ? C.accent : C.sub, padding: "10px 16px", fontSize: 13, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}
        >
          {t === "forex" ? `Forex (${FOREX.length})` : `Synthetic (${SYNTHETICS.length})`}
        </button>
      ))}
    </div>
  );
}
