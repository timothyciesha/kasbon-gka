import { useState } from "react";
import { fmt, fmtDate } from "../lib/utils";

export const pageStyle = { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" };
export const containerStyle = { maxWidth: 420, margin: "0 auto", padding: "0 16px 100px" };
export const cardStyle = { background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, padding: 18, marginBottom: 12 };
export const eyebrowStyle = { color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 };
export const labelStyle = { display: "block", color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 };
export const inputStyle = { width: "100%", background: "#0f1117", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
export const btnPrimary = { background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", flex: 1, justifyContent: "center" };
export const btnSecondary = { flex: 1, background: "transparent", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 20px", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
export const backBtn = { background: "#1e293b", border: "1px solid #334155", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 18, fontFamily: "inherit" };
export const rowStyle = { display: "flex", gap: 8, marginTop: 16 };
export const modalTitle = { color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 };
export const modalSub = { color: "#64748b", fontSize: 13, marginBottom: 16 };

export function GKAHeader({ title, action }) {
  return (
    <div style={{ paddingTop: 48, paddingBottom: 24, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span>
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#161b27", borderRadius: "24px 24px 0 0", padding: 24, width: "100%", maxWidth: 420, border: "1px solid #1e293b", borderBottom: "none" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", background: toast.type === "err" ? "#ef4444" : "#1e293b", color: "#f1f5f9", border: `1px solid ${toast.type === "err" ? "#dc2626" : "#334155"}`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}

export function InfoRow({ label, val, bold, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span style={{ color: "#475569" }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: accent || (bold ? "#f1f5f9" : "#94a3b8") }}>{val}</span>
    </div>
  );
}

export function HistoryItem({ h, cicilans }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid #1e293b" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <div>
          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(h.nominal)}</p>
          <p style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{fmtDate(h.tanggal_kasbon)} → Lunas {fmtDate(h.tanggal_lunas)}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {h.fee > 0 && <span style={{ fontSize: 11, color: "#ef4444" }}>+admin</span>}
          <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✓ Lunas</span>
          <span style={{ color: "#334155", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {cicilans.map(c => (
            <div key={c.id} style={{ display: "flex", justifyContent: "space-between", background: "#0f1117", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
              <span style={{ color: "#475569" }}>{fmtDate(c.tanggal)}</span>
              <span style={{ fontWeight: 700, color: "#94a3b8" }}>{fmt(c.nominal)}</span>
            </div>
          ))}
          {h.fee > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13 }}>
              <span style={{ color: "#ef4444" }}>Biaya admin</span>
              <span style={{ fontWeight: 700, color: "#ef4444" }}>{fmt(h.fee)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TagihanCard({ t, sisa, bayaran, statusStyle, statusLabel, onBayar }) {
  const [open, setOpen] = useState(false);
  const status = statusLabel(t).toLowerCase().includes("overdue") ? "overdue"
    : statusLabel(t).toLowerCase().includes("h-") ? "warning" : "aktif";
  const sc = statusStyle(status);
  const progress = Math.round(((t.nominal - sisa) / t.nominal) * 100);
  const borderColor = status === "overdue" ? "rgba(239,68,68,0.3)" : status === "warning" ? "rgba(245,158,11,0.3)" : "#1e293b";
  return (
    <div style={{ background: "#161b27", border: `1px solid ${borderColor}`, borderRadius: 18, overflow: "hidden" }}>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <div>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{t.keterangan || "Tagihan"}</p>
            <p style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>JT: {fmtDate(t.jatuh_tempo)}</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>
            {statusLabel(t)}
          </span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
          <span style={{ color: "#475569" }}>Terbayar {fmt(t.nominal - sisa)}</span>
          <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
        </div>
        <div style={{ height: 4, background: "#0f1117", borderRadius: 99, overflow: "hidden", marginBottom: 12 }}>
          <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: 99 }} />
        </div>
        {bayaran.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
              {open ? "▲" : "▼"} {bayaran.length} pembayaran
            </button>
            {open && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {bayaran.map(b => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", background: "#0f1117", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                    <span style={{ color: "#475569" }}>{fmtDate(b.tanggal)}</span>
                    <span style={{ color: "#94a3b8", fontWeight: 700 }}>{fmt(b.nominal)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={() => onBayar(t)} style={{ background: "#3b82f6", border: "none", borderRadius: 12, padding: "10px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
          + Catat Pembayaran
        </button>
      </div>
    </div>
  );
}
