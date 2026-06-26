import C from "../constants/colors.js";
import { TIMEFRAMES } from "../constants/timeframes.js";

export default function TimeframeSelector({ tf, onChange }) {
  return (
    <div style={{ display: "flex", gap: 5, padding: "10px 16px", background: C.surface, borderBottom: `1px solid ${C.border}` }}>
      {Object.keys(TIMEFRAMES).map(t => (
        <button
          key={t}
          onClick={() => onChange(t)}
          style={{ flex: 1, background: tf === t ? C.accent : C.card, color: tf === t ? "#000" : C.sub, border: `1px solid ${tf === t ? C.accent : C.border}`, borderRadius: 6, padding: "5px 0", fontSize: 12, fontWeight: 700 }}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
