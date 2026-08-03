import React, { useState, useEffect, useRef } from "react";

// --- DUMMY UTILS & HELPERS (Sesuaikan import ini dengan file utils milikmu) ---
const fmt = (num) => Number(num || 0).toLocaleString("id-ID");
const DEFAULT_GAJI = 3000000;

// Helper kalkulasi slip sederhana (dapat disesuaikan dengan rumus bisnis milikmu)
const calculateSlip = (driverName, drivers, getAbsenBulan, slipForm) => {
  const gPokok = parseInt(String(slipForm.gaji_pokok).replace(/\D/g, ""), 10) || 0;
  const pot = parseInt(String(slipForm.potongan_pinjaman).replace(/\D/g, ""), 10) || 0;
  const hari = parseInt(slipForm.hari_hadir, 10) || 0;
  
  // Contoh kalkulasi: Gaji Pokok - Potongan
  const takeHomePay = gPokok - pot;

  return {
    name: driverName,
    periode: slipForm.periode,
    gaji_pokok: gPokok,
    hari_hadir: hari,
    potongan_pinjaman: pot,
    total_pendapatan: gPokok,
    total_potongan: pot,
    take_home_pay: takeHomePay,
  };
};

// --- STYLES INLINE (Sesuai tema dark/modern milikmu) ---
const pageStyle = { minHeight: "100vh", background: "#0f1117", color: "#f1f5f9", fontFamily: "sans-serif", paddingBottom: 80 };
const containerStyle = { maxWidth: 500, margin: "0 auto", padding: "0 16px" };
const cardStyle = { background: "#1e293b", borderRadius: 16, padding: 16, border: "1px solid #334155" };
const inputStyle = { width: "100%", padding: "12px", borderRadius: 10, background: "#0f1117", border: "1px solid #334155", color: "#fff", marginTop: 6, boxSizing: "border-box" };
const labelStyle = { fontSize: 12, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" };
const btnPrimary = { background: "#2563eb", color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center" };

export default function App() {
  // --- 1. GLOBAL STATE & DATA ---
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("kasbon"); // "kasbon" | "absen" | "gajian" | "supplier"
  const [toast, setToast] = useState(null);

  // Data State
  const [drivers, setDrivers] = useState([
    { id: 1, name: "Budi Santoso", gaji_pokok: 3500000 },
    { id: 2, name: "Joko Susilo", gaji_pokok: 3200000 },
    { id: 3, name: "Ahmad Dani", gaji_pokok: 3000000 },
  ]);
  const [absens, setAbsens] = useState([]);

  // --- 2. STATE KHUSUS GAJIAN & SLIP (FIXED & COMBINED) ---
  const [viewGajian, setViewGajian] = useState("list"); // "list" | "form-slip" | "result-slip"
  const [slipDriver, setSlipDriver] = useState(""); 
  const [slipForm, setSlipForm] = useState({
    periode: new Date().toISOString().slice(0, 7),
    gaji_pokok: "",
    hari_hadir: "",
    potongan_pinjaman: "",
  });
  const [slipData, setSlipData] = useState(null);
  const slipRef = useRef(null);

  // Helper Toast
  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Helper Absen dummy
  const getAbsenBulan = (driverName, periode) => {
    return absens.filter(a => a.driver === driverName && a.date?.startsWith(periode));
  };

  // --- 3. LOGIC HANDLER SLIP GAJI ---
  const handleBukaSlip = (driverName, gajiPokok) => {
    setSlipDriver(driverName);
    
    // Auto fill data karyawan ke form
    setSlipForm({
      periode: new Date().toISOString().slice(0, 7),
      gaji_pokok: gajiPokok || DEFAULT_GAJI,
      hari_hadir: "",
      potongan_pinjaman: "",
    });
    setSlipData(null);
    setViewGajian("form-slip");
  };

  const handleGenerateSlip = () => {
    if (!slipDriver) return showToast("Karyawan belum dipilih", "err");
    if (!slipForm.hari_hadir) return showToast("Masukkan jumlah hari hadir", "err");

    const data = calculateSlip(slipDriver, drivers, getAbsenBulan, slipForm);
    setSlipData(data);
    setViewGajian("result-slip");
  };

  // --- 4. NAVIGATION BAR (4 TAB) ---
  const BottomNav = () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#1e293b", borderTop: "1px solid #334155", display: "flex", justifyContent: "space-around", padding: "12px 0", zIndex: 50 }}>
      {[
        { id: "kasbon", label: "Kasbon" },
        { id: "absen", label: "Absen" },
        { id: "gajian", label: "Gajian & Slip" },
        { id: "supplier", label: "Supplier" },
      ].map((t) => (
        <button
          key={t.id}
          onClick={() => {
            setTab(t.id);
            if (t.id === "gajian") setViewGajian("list"); // Reset view gajian saat klik tab
          }}
          style={{ background: "none", border: "none", color: tab === t.id ? "#38bdf8" : "#64748b", fontWeight: tab === t.id ? 700 : 500, fontSize: 13, cursor: "pointer" }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (loading) {
    return (
      <div style={{ ...pageStyle, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p>Memuat Data...</p>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      {toast && (
        <div style={{ position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", background: toast.type === "err" ? "#ef4444" : "#22c55e", color: "#fff", padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 600, zIndex: 100 }}>
          {toast.msg}
        </div>
      )}

      <div style={containerStyle}>
        
        {/* ==================== TAB KASBON ==================== */}
        {tab === "kasbon" && (
          <div style={{ paddingTop: 48 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Dashboard Kasbon</h1>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Kelola pinjaman dan cicilan tim</p>
            <div style={{ ...cardStyle, marginTop: 20 }}>
              <p style={{ textAlign: "center", color: "#64748b" }}>Konten Tab Kasbon Kamu</p>
            </div>
          </div>
        )}

        {/* ==================== TAB ABSEN ==================== */}
        {tab === "absen" && (
          <div style={{ paddingTop: 48 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Rekap Absensi</h1>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Catatan kehadiran driver & staf</p>
            <div style={{ ...cardStyle, marginTop: 20 }}>
              <p style={{ textAlign: "center", color: "#64748b" }}>Konten Tab Absen Kamu</p>
            </div>
          </div>
        )}

        {/* ==================== TAB GAJIAN & SLIP (GABUNGAN) ==================== */}
        {tab === "gajian" && (
          <div>
            {/* VIEW 1: DAFTAR KARYAWAN */}
            {viewGajian === "list" && (
              <div style={{ paddingTop: 48 }}>
                <h1 style={{ fontSize: 24, fontWeight: 800 }}>Gajian & Slip</h1>
                <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 20 }}>Pilih karyawan untuk cetak slip gaji</p>

                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {drivers.map((d) => (
                    <div key={d.id} style={{ ...cardStyle, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <h3 style={{ fontWeight: 700, color: "#f8fafc", fontSize: 16, margin: 0 }}>{d.name}</h3>
                        <p style={{ fontSize: 13, color: "#94a3b8", margin: "4px 0 0 0" }}>Gapok: Rp {fmt(d.gaji_pokok)}</p>
                      </div>
                      <button onClick={() => handleBukaSlip(d.name, d.gaji_pokok)} style={btnPrimary}>
                        Buat Slip
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* VIEW 2: FORM SLIP GAJI */}
            {viewGajian === "form-slip" && (
              <div style={{ paddingTop: 48 }}>
                <button onClick={() => setViewGajian("list")} style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", padding: 0, marginBottom: 12, fontWeight: 600 }}>
                  ← Kembali ke Daftar
                </button>
                <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>Slip Gaji: {slipDriver}</h1>

                <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <label style={labelStyle}>Periode Bulan</label>
                    <input type="month" value={slipForm.periode} onChange={(e) => setSlipForm({ ...slipForm, periode: e.target.value })} style={inputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Gaji Pokok (Rp)</label>
                    <input type="text" inputMode="numeric" value={slipForm.gaji_pokok} onChange={(e) => setSlipForm({ ...slipForm, gaji_pokok: e.target.value })} style={inputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Jumlah Hari Hadir</label>
                    <input type="number" min="0" max="31" placeholder="Contoh: 24" value={slipForm.hari_hadir} onChange={(e) => setSlipForm({ ...slipForm, hari_hadir: e.target.value })} style={inputStyle} />
                  </div>

                  <div>
                    <label style={labelStyle}>Potongan Pinjaman / Lain (Rp)</label>
                    <input type="text" inputMode="numeric" placeholder="Kosongkan jika tidak ada" value={slipForm.potongan_pinjaman} onChange={(e) => setSlipForm({ ...slipForm, potongan_pinjaman: e.target.value })} style={inputStyle} />
                  </div>

                  <button onClick={handleGenerateSlip} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px", marginTop: 8, borderRadius: 12 }}>
                    Generate Slip Gaji
                  </button>
                </div>
              </div>
            )}

            {/* VIEW 3: HASIL SLIP GAJI (SIAP CETAK / SCREENSHOT) */}
            {viewGajian === "result-slip" && slipData && (
              <div style={{ paddingTop: 48 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                  <button onClick={() => setViewGajian("form-slip")} style={{ background: "none", border: "none", color: "#38bdf8", cursor: "pointer", fontWeight: 600 }}>
                    ← Edit Form
                  </button>
                  <button onClick={() => setViewGajian("list")} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontWeight: 600 }}>
                    Selesai / Tutup ✕
                  </button>
                </div>

                <div ref={slipRef} style={{ background: "#ffffff", borderRadius: 16, padding: 24, color: "#0f172a", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)" }}>
                  <div style={{ textAlign: "center", borderBottom: "2px solid #e2e8f0", paddingBottom: 12, marginBottom: 16 }}>
                    <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>SLIP GAJI KARYAWAN</h2>
                    <p style={{ margin: "4px 0 0 0", fontSize: 12, color: "#64748b" }}>Periode: {slipData.periode}</p>
                  </div>

                  <div style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Nama Karyawan</span>
                      <strong>{slipData.name}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "#64748b" }}>Hari Hadir</span>
                      <strong>{slipData.hari_hadir} Hari</strong>
                    </div>
                    
                    <hr style={{ border: "none", borderTop: "1px dashed #cbd5e1", margin: "8px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Gaji Pokok</span>
                      <span>Rp {fmt(slipData.gaji_pokok)}</span>
                    </div>

                    {slipData.potongan_pinjaman > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#dc2626" }}>
                        <span>Potongan Pinjaman</span>
                        <span>- Rp {fmt(slipData.potongan_pinjaman)}</span>
                      </div>
                    )}

                    <hr style={{ border: "none", borderTop: "2px solid #0f172a", margin: "12px 0 8px 0" }} />

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800, color: "#16a34a" }}>
                      <span>TAKE HOME PAY</span>
                      <span>Rp {fmt(slipData.take_home_pay)}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================== TAB SUPPLIER ==================== */}
        {tab === "supplier" && (
          <div style={{ paddingTop: 48 }}>
            <h1 style={{ fontSize: 24, fontWeight: 800 }}>Tagihan Supplier</h1>
            <p style={{ color: "#94a3b8", fontSize: 14 }}>Kelola pembayaran & pembelian</p>
            <div style={{ ...cardStyle, marginTop: 20 }}>
              <p style={{ textAlign: "center", color: "#64748b" }}>Konten Tab Supplier Kamu</p>
            </div>
          </div>
        )}

      </div>

      {/* BOTTOM NAVIGATION */}
      <BottomNav />
    </div>
  );
}