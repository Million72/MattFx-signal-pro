import C from "../constants/colors.js";

export default function FilterBar({ filter, onChange }) {
  return (
    <div style={{ display: "flex", gap: 6, padding: "10px 16px" }}>
      {["ALL", "BUY", "SELL", "WAIT"].map(f => (
        <button
          key={f}
          onClick={() => onChange(f)}
          style={{ flex: 1, background: filter === f ? C.accent : C.card, color: filter === f ? "#000" : C.sub, border: `1px solid ${filter === f ? C.accent : C.border}`, borderRadius: 20, padding: "5px 0", fontSize: 12, fontWeight: 600 }}
        >
          {f}
        </button>
      ))}
    </div>
  );
}
