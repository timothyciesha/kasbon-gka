import { useState } from "react";

// ── Constants ─────────────────────────────────────────
export const ADMIN_FEE = 50000;
export const WAITING_DAYS = 30;
export const TUNJANGAN_PER_HARI = 70000;
export const DEFAULT_GAJI = 4000000;

// ── Formatters ────────────────────────────────────────
export const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
export const fmtDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
export const fmtDateLong = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
export const today = () => new Date().toISOString().slice(0, 10);
export const monthName = (iso) => new Date(iso + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
export const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

// ── Shared Styles ─────────────────────────────────────
export const S = {
  page:      { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" },
  container: { maxWidth: 420, margin: "0 auto", padding: "0 16px 100px" },
  card:      { background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, padding: 18, marginBottom: 12 },
  eyebrow:   { color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 },
  label:     { display: "block", color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 },
  input:     { width: "100%", background: "#0f1117", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" },
  btnPrimary:   { background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", flex: 1, justifyContent: "center" },
  btnSecondary: { flex: 1, background: "transparent", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 20px", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" },
  backBtn:   { background: "#1e293b", border: "1px solid #334155", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 18, fontFamily: "inherit" },
  rowBtns:   { display: "flex", gap: 8, marginTop: 16 },
  modalTitle:{ color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 },
  modalSub:  { color: "#64748b", fontSize: 13, marginBottom: 16 },
};

// ── Shared Components ─────────────────────────────────
export function PageHeader({ title }) {
  return (
    <div style={{ paddingTop: 48, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span>
      </div>
      <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>{title}</h1>
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

export function Avatar({ name, size = 40 }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: size * 0.35 }}>
      {name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

export function ProgressBar({ progress, color = "linear-gradient(90deg, #f59e0b, #fbbf24)" }) {
  return (
    <div style={{ height: 5, background: "#0f1117", borderRadius: 99, overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${progress}%`, background: color, borderRadius: 99 }} />
    </div>
  );
}

export function StatusBadge({ color, bg, border, label }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${border}`, color, background: bg }}>
      {label}
    </span>
  );
}

export function HistoryItem({ h, cicilans, fmt, fmtDate }) {
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
      {open && cicilans?.length > 0 && (
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
