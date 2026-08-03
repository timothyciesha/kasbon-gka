export const SUPABASE_URL = "https://qvwohfqpkkqawemchzkk.supabase.co";
export const SUPABASE_KEY = "sb_publishable_zUgWGgPOIKuTC9R9tqEHJg_ImIFftcC";
export const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

export const ADMIN_FEE = 50000;
export const WAITING_DAYS = 30;
export const TUNJANGAN_PER_HARI = 70000;
export const DEFAULT_GAJI = 4000000;

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
