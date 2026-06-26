import C from "../constants/colors.js";
import { fmtTime } from "../utils/formatters.js";

export default function Header({ lastScan, countdown, liveCount, errorCount, onScan, scanning }) {
  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;
  const countdownStr = `${mins}:${String(secs).padStart(2, "0")}`;

  return (
    <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, padding: "12px 16px", position: "sticky", top: 0, zIndex: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 900 }}>
            <span style={{ color: C.gold }}>◈</span> MT5 Signal Pro
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>
            {lastScan ? `${fmtTime(lastScan)} · next ${countdownStr}` : "Connecting…"}
            {liveCount > 0 && <span style={{ color: C.bull, marginLeft: 6 }}>● {liveCount} live</span>}
            {errorCount > 0 && <span style={{ color: C.error, marginLeft: 6 }}>⚠ {errorCount} err</span>}
          </div>
        </div>
        <button
          onClick={onScan}
          disabled={scanning}
          style={{ background: scanning ? C.muted : C.accent, color: "#000", border: "none", borderRadius: 6, padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: scanning ? "not-allowed" : "pointer" }}
        >
          {scanning ? "…" : "↻ Scan"}
        </button>
      </div>
    </div>
  );
}

