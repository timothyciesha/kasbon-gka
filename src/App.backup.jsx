import { useState, useEffect, useRef } from "react";

const SUPABASE_URL = "https://qvwohfqpkkqawemchzkk.supabase.co";
const SUPABASE_KEY = "sb_publishable_zUgWGgPOIKuTC9R9tqEHJg_ImIFftcC";
const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};
const db = {
  async get(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async post(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST", headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async patch(table, id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH", headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async delete(table, params) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { method: "DELETE", headers });
    if (!res.ok) throw await res.json();
  },
};

const ADMIN_FEE = 50000;
const WAITING_DAYS = 30;
const TUNJANGAN_PER_HARI = 70000;
const DEFAULT_GAJI = 4000000;

const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const fmtDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
const fmtDateLong = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};
const today = () => new Date().toISOString().slice(0, 10);
const monthName = (iso) => new Date(iso + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

// shared styles
const pageStyle = { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" };
const containerStyle = { maxWidth: 420, margin: "0 auto", padding: "0 16px 100px" };
const cardStyle = { background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, padding: 18, marginBottom: 12 };
const eyebrowStyle = { color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 };
const labelStyle = { display: "block", color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 };
const inputStyle = { width: "100%", background: "#0f1117", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 14px", color: "#f1f5f9", fontSize: 15, fontFamily: "inherit", outline: "none", boxSizing: "border-box" };
const btnPrimary = { background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", flex: 1, justifyContent: "center" };
const btnSecondary = { flex: 1, background: "transparent", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 20px", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const backBtn = { background: "#1e293b", border: "1px solid #334155", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 18, fontFamily: "inherit" };
const rowStyle = { display: "flex", gap: 8, marginTop: 16 };
const modalTitle = { color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 };
const modalSub = { color: "#64748b", fontSize: 13, marginBottom: 16 };

export default function App() {
  const [drivers, setDrivers] = useState([]);
  const [kasbons, setKasbons] = useState([]);
  const [cicilans, setCicilans] = useState([]);
  const [absens, setAbsens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("kasbon"); // kasbon | absen | slip
  const [view, setView] = useState("dashboard");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  // kasbon forms
  const [kForm, setKForm] = useState({ nominal: "", tanggal: today() });
  const [cForm, setCForm] = useState({ nominal: "", tanggal: today() });
  const [showCForm, setShowCForm] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverJabatan, setNewDriverJabatan] = useState("Sopir");
  const [confirmHapus, setConfirmHapus] = useState(null);
  const [showDeleteDriver, setShowDeleteDriver] = useState(false);

  // absen
  const [absenForm, setAbsenForm] = useState({ driver_name: "", tanggal: today() });
  const [showAbsenForm, setShowAbsenForm] = useState(false);

  // slip
  const [slipDriver, setSlipDriver] = useState("");
  const [slipForm, setSlipForm] = useState({
    periode: today().slice(0, 7),
    gaji_pokok: DEFAULT_GAJI,
    hari_hadir: "",
    potongan_pinjaman: "",
  });
  const [slipData, setSlipData] = useState(null);
  const slipRef = useRef(null);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = async () => {
    try {
      const [d, k, c, a] = await Promise.all([
        db.get("drivers", "order=created_at.asc"),
        db.get("kasbons", "order=created_at.asc"),
        db.get("cicilans", "order=created_at.asc"),
        db.get("absens", "order=tanggal.desc"),
      ]);
      setDrivers(d); setKasbons(k); setCicilans(c); setAbsens(a);
    } catch { showToast("Gagal load data", "err"); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, []);

  // helpers
  const getActive = (n) => kasbons.find(k => k.driver_name === n && k.is_active) || null;
  const getHistory = (n) => kasbons.filter(k => k.driver_name === n && !k.is_active);
  const getCicilans = (id) => cicilans.filter(c => c.kasbon_id === id);
  const getSisaBayar = (k) => Math.max(0, k.total_potong - getCicilans(k.id).reduce((s, c) => s + c.nominal, 0));
  const getLastLunas = (n) => { const h = getHistory(n); return h.length ? h[h.length - 1].tanggal_lunas : null; };
  const getStatus = (n) => {
    if (getActive(n)) return "aktif";
    const h = getHistory(n);
    if (!h.length) return "bersih";
    return daysSince(getLastLunas(n)) < WAITING_DAYS ? "tunggu" : "bisa";
  };
  const getSisaHari = (n) => { const l = getLastLunas(n); return l ? Math.max(0, WAITING_DAYS - daysSince(l)) : 0; };
  const getFee = (n) => { const l = getLastLunas(n); return l && daysSince(l) < WAITING_DAYS ? ADMIN_FEE : 0; };
  const statusColor = (s) => ({
    aktif: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
    tunggu: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
    bisa: { color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)" },
    bersih: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
  }[s]);
  const statusLabel = (s, n) => ({ aktif: "Ada Kasbon", tunggu: `Tunggu ${getSisaHari(n)}h`, bisa: "Bisa Kasbon", bersih: "Belum ada" }[s]);
  const getAbsenBulan = (n, bulan) => absens.filter(a => a.driver_name === n && a.tanggal.startsWith(bulan));

  // actions
  const addDriver = async () => {
    const name = newDriverName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (drivers.find(d => d.name === name)) return showToast("Nama sudah ada", "err");
    try {
      const [created] = await db.post("drivers", { name, jabatan: newDriverJabatan || "Sopir" });
      setDrivers(prev => [...prev, created]);
      setNewDriverName(""); setNewDriverJabatan("Sopir"); setShowAddDriver(false);
      showToast(`${name} berhasil ditambahkan`);
    } catch { showToast("Gagal tambah karyawan", "err"); }
  };

  const deleteDriver = async (n) => {
    if (getActive(n)) return showToast("Lunaskan kasbon aktif dulu", "err");
    try {
      await db.delete("drivers", `name=eq.${encodeURIComponent(n)}`);
      setDrivers(prev => prev.filter(d => d.name !== n));
      setKasbons(prev => prev.filter(k => k.driver_name !== n));
      setAbsens(prev => prev.filter(a => a.driver_name !== n));
      setShowDeleteDriver(false); setView("dashboard");
      showToast(`${n} dihapus`);
    } catch { showToast("Gagal hapus karyawan", "err"); }
  };

  const submitKasbon = async () => {
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1000) return showToast("Nominal tidak valid", "err");
    const fee = getFee(sel);
    try {
      const [created] = await db.post("kasbons", { driver_name: sel, nominal, fee, total_potong: nominal + fee, tanggal_kasbon: kForm.tanggal, is_active: true });
      setKasbons(prev => [...prev, created]);
      setKForm({ nominal: "", tanggal: today() }); setView("detail");
      showToast("Kasbon dicatat");
    } catch { showToast("Gagal simpan kasbon", "err"); }
  };

  const submitCicilan = async () => {
    const nominal = parseInt(cForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    const active = getActive(sel);
    const sisa = getSisaBayar(active);
    if (nominal > sisa) return showToast(`Melebihi sisa ${fmt(sisa)}`, "err");
    try {
      const [created] = await db.post("cicilans", { kasbon_id: active.id, nominal, tanggal: cForm.tanggal });
      const newC = [...getCicilans(active.id), created];
      const lunas = newC.reduce((s, c) => s + c.nominal, 0) >= active.total_potong;
      setCicilans(prev => [...prev, created]);
      if (lunas) {
        await db.patch("kasbons", active.id, { is_active: false, tanggal_lunas: cForm.tanggal });
        setKasbons(prev => prev.map(k => k.id === active.id ? { ...k, is_active: false, tanggal_lunas: cForm.tanggal } : k));
        showToast("Lunas! 🎉");
      } else { showToast("Pembayaran dicatat"); }
      setCForm({ nominal: "", tanggal: today() }); setShowCForm(false);
    } catch { showToast("Gagal simpan cicilan", "err"); }
  };

  const hapusCicilan = async (id) => {
    try {
      await db.delete("cicilans", `id=eq.${id}`);
      setCicilans(prev => prev.filter(c => c.id !== id));
      setConfirmHapus(null); showToast("Cicilan dihapus");
    } catch { showToast("Gagal hapus", "err"); }
  };

  const submitAbsen = async () => {
    if (!absenForm.driver_name) return showToast("Pilih karyawan dulu", "err");
    const exists = absens.find(a => a.driver_name === absenForm.driver_name && a.tanggal === absenForm.tanggal);
    if (exists) return showToast("Sudah tercatat absen di tanggal ini", "err");
    try {
      const [created] = await db.post("absens", { driver_name: absenForm.driver_name, tanggal: absenForm.tanggal });
      setAbsens(prev => [created, ...prev]);
      setShowAbsenForm(false); setAbsenForm({ driver_name: "", tanggal: today() });
      showToast("Absen dicatat");
    } catch { showToast("Gagal simpan absen", "err"); }
  };

  const hapusAbsen = async (id) => {
    try {
      await db.delete("absens", `id=eq.${id}`);
      setAbsens(prev => prev.filter(a => a.id !== id));
      showToast("Absen dihapus");
    } catch { showToast("Gagal hapus", "err"); }
  };

  const generateSlip = () => {
    if (!slipDriver) return showToast("Pilih karyawan dulu", "err");
    const hari = parseInt(slipForm.hari_hadir, 10);
    if (!hari || hari < 0) return showToast("Masukkan hari hadir", "err");
    const gajiPokok = parseInt(String(slipForm.gaji_pokok).replace(/\D/g, ""), 10) || DEFAULT_GAJI;
    const tunjanganHadir = hari * TUNJANGAN_PER_HARI;
    const absenBulan = getAbsenBulan(slipDriver, slipForm.periode);
    const potonganKasbon = parseInt(String(slipForm.potongan_pinjaman).replace(/\D/g, ""), 10) || 0;
    const total = gajiPokok + tunjanganHadir - potonganKasbon;
    setSlipData({
      driver: slipDriver,
      periode: slipForm.periode,
      gajiPokok,
      hariHadir: hari,
      tunjanganHadir,
      absenCount: absenBulan.length,
      potonganKasbon,
      total,
    });
  };

  // ══════════════════════════════════════════════════════
  // LOADING
  // ══════════════════════════════════════════════════════
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#475569", fontSize: 14 }}>Memuat data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════
  // BOTTOM NAV
  // ══════════════════════════════════════════════════════
  const BottomNav = () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f1117", borderTop: "1px solid #1e293b", display: "flex", zIndex: 30 }}>
      {[
        { key: "kasbon", icon: "💳", label: "Kasbon" },
        { key: "absen", icon: "📋", label: "Absen" },
        { key: "slip", icon: "🧾", label: "Slip Gaji" },
      ].map(t => (
        <button key={t.key} onClick={() => { setTab(t.key); setView("dashboard"); }}
          style={{ flex: 1, padding: "12px 0 16px", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4, fontFamily: "inherit" }}>
          <span style={{ fontSize: 20 }}>{t.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: tab === t.key ? "#3b82f6" : "#334155" }}>{t.label}</span>
          {tab === t.key && <div style={{ width: 20, height: 2, background: "#3b82f6", borderRadius: 99, marginTop: 2 }} />}
        </button>
      ))}
    </div>
  );

  // ══════════════════════════════════════════════════════
  // TAB: KASBON
  // ══════════════════════════════════════════════════════
  if (tab === "kasbon") {
    // KASBON DETAIL
    if (view === "detail" && sel) {
      const status = getStatus(sel);
      const sc = statusColor(status);
      const active = getActive(sel);
      const history = getHistory(sel);
      const sisa = active ? getSisaBayar(active) : 0;
      const totalBayar = active ? active.total_potong - sisa : 0;
      const progress = active ? Math.round((totalBayar / active.total_potong) * 100) : 0;
      const canKasbon = status === "bisa" || status === "bersih";
      const activeCicilans = active ? getCicilans(active.id) : [];

      return (
        <div style={pageStyle}>
          {toast && <Toast toast={toast} />}
          {confirmHapus !== null && <Modal onClose={() => setConfirmHapus(null)}><p style={modalTitle}>Hapus cicilan?</p><p style={modalSub}>Tidak bisa dibatalkan.</p><div style={rowStyle}><button onClick={() => setConfirmHapus(null)} style={btnSecondary}>Batal</button><button onClick={() => hapusCicilan(confirmHapus)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button></div></Modal>}
          {showDeleteDriver && <Modal onClose={() => setShowDeleteDriver(false)}><p style={modalTitle}>Hapus {sel}?</p><p style={modalSub}>Semua data akan terhapus permanen.</p><div style={rowStyle}><button onClick={() => setShowDeleteDriver(false)} style={btnSecondary}>Batal</button><button onClick={() => deleteDriver(sel)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button></div></Modal>}
          {showCForm && (
            <Modal onClose={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }}>
              <p style={modalTitle}>Catat Pembayaran</p>
              <p style={modalSub}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(sisa)}</strong></p>
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 0 }}>
                <div><label style={labelStyle}>Nominal Bayar</label><input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 500000" value={cForm.nominal} onChange={e => setCForm({ ...cForm, nominal: e.target.value })} style={inputStyle} />{parseInt(cForm.nominal.replace(/\D/g, ""), 10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(cForm.nominal.replace(/\D/g, ""), 10))}</p>}</div>
                <div><label style={labelStyle}>Tanggal Bayar</label><input type="date" value={cForm.tanggal} onChange={e => setCForm({ ...cForm, tanggal: e.target.value })} style={inputStyle} /></div>
              </div>
              <div style={rowStyle}><button onClick={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }} style={btnSecondary}>Batal</button><button onClick={submitCicilan} style={btnPrimary}>Simpan</button></div>
            </Modal>
          )}
          <div style={containerStyle}>
            <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button onClick={() => setView("dashboard")} style={backBtn}>←</button>
                <div>
                  <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{sel}</h2>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>{statusLabel(status, sel)}</span>
                </div>
              </div>
              <button onClick={() => setShowDeleteDriver(true)} style={{ ...backBtn, color: "#475569" }}>🗑</button>
            </div>
            {active && (
              <div style={cardStyle}>
                <p style={eyebrowStyle}>Kasbon Aktif</p>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                    <span style={{ color: "#475569" }}>Terbayar <strong style={{ color: "#94a3b8" }}>{fmt(totalBayar)}</strong></span>
                    <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
                  </div>
                  <div style={{ height: 6, background: "#0f1117", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 99 }} />
                  </div>
                  <p style={{ textAlign: "right", fontSize: 11, color: "#334155", marginTop: 4 }}>{progress}% terbayar</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                  <InfoRow label="Nominal kasbon" val={fmt(active.nominal)} />
                  {active.fee > 0 && <InfoRow label="Biaya admin" val={`+ ${fmt(active.fee)}`} accent="#ef4444" />}
                  <div style={{ height: 1, background: "#1e293b" }} />
                  <InfoRow label="Total harus bayar" val={fmt(active.total_potong)} bold />
                  <InfoRow label="Tanggal kasbon" val={fmtDate(active.tanggal_kasbon)} />
                </div>
                {activeCicilans.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={eyebrowStyle}>Rincian Pembayaran</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
                      {activeCicilans.map(c => (
                        <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", borderRadius: 12, padding: "10px 14px" }}>
                          <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(c.nominal)}</p><p style={{ color: "#475569", fontSize: 12 }}>{fmtDate(c.tanggal)}</p></div>
                          <button onClick={() => setConfirmHapus(c.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 20, padding: "0 4px" }}>×</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => { setCForm({ nominal: "", tanggal: today() }); setShowCForm(true); }} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>+ Catat Pembayaran</button>
              </div>
            )}
            {!active && (
              <div style={{ marginBottom: 12 }}>
                {canKasbon && <button onClick={() => setView("form")} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px 20px", borderRadius: 16, fontSize: 15 }}>+ Catat Kasbon Baru{getFee(sel) === 0 && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6, fontWeight: 400 }}>· Gratis</span>}</button>}
                {status === "tunggu" && (
                  <div style={{ background: "#0d1a2e", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
                    <p style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Masa tunggu: {getSisaHari(sel)} hari lagi</p>
                    <p style={{ color: "#3b82f6", fontSize: 13, marginBottom: 12 }}>atau kasbon sekarang dengan biaya admin Rp50.000</p>
                    <button onClick={() => setView("form")} style={{ background: "#1d4ed8", border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Kasbon Sekarang (+Rp50.000)</button>
                  </div>
                )}
              </div>
            )}
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <p style={{ ...eyebrowStyle, padding: "16px 18px 10px" }}>Riwayat ({history.length})</p>
              {history.length === 0 ? <p style={{ color: "#334155", fontSize: 14, padding: "0 18px 18px" }}>Belum ada riwayat.</p>
                : [...history].reverse().map(h => <HistoryItem key={h.id} h={h} cicilans={getCicilans(h.id)} fmt={fmt} fmtDate={fmtDate} />)}
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }

    // KASBON FORM
    if (view === "form" && sel) {
      const fee = getFee(sel);
      const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10) || 0;
      return (
        <div style={pageStyle}>
          {toast && <Toast toast={toast} />}
          <div style={containerStyle}>
            <div style={{ paddingTop: 40, paddingBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setView("detail")} style={backBtn}>←</button>
              <div><h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22 }}>Kasbon Baru</h2><p style={{ color: "#475569", fontSize: 13 }}>{sel}</p></div>
            </div>
            {fee > 0 && <div style={{ background: "#2d1a00", border: "1px solid #78350f", borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, color: "#fbbf24" }}>⚡ Dalam masa tunggu — biaya admin <strong>Rp50.000</strong> ditambahkan.</div>}
            <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={labelStyle}>Nominal Kasbon</label><input type="text" inputMode="numeric" placeholder="Contoh: 500000" value={kForm.nominal} onChange={e => setKForm({ ...kForm, nominal: e.target.value })} style={{ ...inputStyle, fontSize: 24, fontWeight: 800 }} />{nominal > 0 && <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{fmt(nominal)}</p>}</div>
              <div><label style={labelStyle}>Tanggal Kasbon</label><input type="date" value={kForm.tanggal} onChange={e => setKForm({ ...kForm, tanggal: e.target.value })} style={inputStyle} /></div>
              {nominal > 0 && <div style={{ background: "#0f1117", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}><InfoRow label="Nominal" val={fmt(nominal)} />{fee > 0 && <InfoRow label="Biaya admin" val={`+ ${fmt(fee)}`} accent="#ef4444" />}<div style={{ height: 1, background: "#1e293b" }} /><InfoRow label="Total potong gaji" val={fmt(nominal + fee)} bold /></div>}
              <button onClick={submitKasbon} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px", borderRadius: 14, fontSize: 15 }}>Simpan Kasbon</button>
            </div>
          </div>
          <BottomNav />
        </div>
      );
    }

    // KASBON DASHBOARD
    const activeDrivers = drivers.filter(d => getActive(d.name));
    const totalSisa = activeDrivers.reduce((s, d) => s + getSisaBayar(getActive(d.name)), 0);
    const totalPinjam = activeDrivers.reduce((s, d) => s + getActive(d.name).nominal, 0);
    return (
      <div style={pageStyle}>
        {toast && <Toast toast={toast} />}
        {showAddDriver && (
          <Modal onClose={() => { setShowAddDriver(false); setNewDriverName(""); }}>
            <p style={modalTitle}>Tambah Karyawan</p>
            <p style={modalSub}>Masukkan nama karyawan baru</p>
            <input autoFocus type="text" placeholder="Nama lengkap" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} onKeyDown={e => e.key === "Enter" && addDriver()} style={inputStyle} />
            <div style={rowStyle}><button onClick={() => { setShowAddDriver(false); setNewDriverName(""); }} style={btnSecondary}>Batal</button><button onClick={addDriver} style={btnPrimary}>Tambah</button></div>
          </Modal>
        )}
        <div style={containerStyle}>
          <div style={{ paddingTop: 48, paddingBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span></div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>GKA Kasbon</h1>
            </div>
            <button onClick={() => setShowAddDriver(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><span style={{ fontSize: 16 }}>+</span> Karyawan</button>
          </div>
          {activeDrivers.length > 0 && (
            <div style={{ borderRadius: 20, padding: 20, marginBottom: 16, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}>
              <p style={eyebrowStyle}>Ringkasan Aktif</p>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}><p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Total dipinjam</p><p style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800 }}>{fmt(totalPinjam)}</p></div>
                <div style={{ width: 1, background: "#334155" }} />
                <div style={{ flex: 1 }}><p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Belum terbayar</p><p style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800 }}>{fmt(totalSisa)}</p></div>
              </div>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {drivers.length === 0 && <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 12 }}>👤</div><p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada karyawan</p><p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Karyawan" untuk menambahkan</p></div>}
            {drivers.map(driver => {
              const status = getStatus(driver.name);
              const sc = statusColor(status);
              const active = getActive(driver.name);
              const sisa = active ? getSisaBayar(active) : 0;
              const progress = active ? Math.round(((active.total_potong - sisa) / active.total_potong) * 100) : 0;
              return (
                <button key={driver.id} onClick={() => { setSel(driver.name); setView("detail"); }} style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: active ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: 15 }}>{driver.name[0].toUpperCase()}</div>
                      <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{driver.name}</p><p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{getHistory(driver.name).length} kasbon selesai</p></div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>{statusLabel(status, driver.name)}</span>
                  </div>
                  {active && (<div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}><span style={{ color: "#475569" }}>Terbayar {fmt(active.total_potong - sisa)}</span><span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span></div><div style={{ height: 4, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}><div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 99 }} /></div></div>)}
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 20, background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16 }}>
            <p style={eyebrowStyle}>Aturan Kasbon</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[["✅", "Kasbon ≥30 hari setelah lunas", "Gratis"], ["⚡", "Kasbon <30 hari setelah lunas", "+Rp50.000 admin"], ["🚫", "Masih ada kasbon aktif", "Tidak bisa kasbon"]].map(([icon, text, sub], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontSize: 13, color: "#475569" }}>{icon} {text}</span><span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{sub}</span></div>
              ))}
            </div>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // TAB: ABSEN
  // ══════════════════════════════════════════════════════
  if (tab === "absen") {
    const grouped = {};
    absens.forEach(a => {
      const bulan = a.tanggal.slice(0, 7);
      if (!grouped[bulan]) grouped[bulan] = [];
      grouped[bulan].push(a);
    });
    const bulanList = Object.keys(grouped).sort().reverse();

    return (
      <div style={pageStyle}>
        {toast && <Toast toast={toast} />}
        {showAbsenForm && (
          <Modal onClose={() => setShowAbsenForm(false)}>
            <p style={modalTitle}>Catat Absen</p>
            <p style={modalSub}>Pilih karyawan dan tanggal absen</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Karyawan</label>
                <select value={absenForm.driver_name} onChange={e => setAbsenForm({ ...absenForm, driver_name: e.target.value })} style={{ ...inputStyle, appearance: "none" }}>
                  <option value="">-- Pilih karyawan --</option>
                  {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Tanggal Absen</label>
                <input type="date" value={absenForm.tanggal} onChange={e => setAbsenForm({ ...absenForm, tanggal: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={rowStyle}>
              <button onClick={() => setShowAbsenForm(false)} style={btnSecondary}>Batal</button>
              <button onClick={submitAbsen} style={btnPrimary}>Simpan</button>
            </div>
          </Modal>
        )}
        <div style={containerStyle}>
          <div style={{ paddingTop: 48, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span></div>
              <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Absensi</h1>
            </div>
            <button onClick={() => setShowAbsenForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}><span style={{ fontSize: 16 }}>+</span> Absen</button>
          </div>

          {/* Rekap per driver bulan ini */}
          {(() => {
            const bulanIni = today().slice(0, 7);
            const absenBulanIni = absens.filter(a => a.tanggal.startsWith(bulanIni));
            if (!absenBulanIni.length) return null;
            const perDriver = {};
            absenBulanIni.forEach(a => { perDriver[a.driver_name] = (perDriver[a.driver_name] || 0) + 1; });
            return (
              <div style={{ ...cardStyle, marginBottom: 16 }}>
                <p style={eyebrowStyle}>Rekap Bulan Ini — {monthName(bulanIni)}</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {drivers.map(d => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: "#94a3b8", fontSize: 14 }}>{d.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: perDriver[d.name] ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)", color: perDriver[d.name] ? "#ef4444" : "#34d399", border: `1px solid ${perDriver[d.name] ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                        {perDriver[d.name] ? `${perDriver[d.name]}x absen` : "Hadir semua"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* List absen by bulan */}
          {absens.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada catatan absen</p>
              <p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Absen" untuk menambahkan</p>
            </div>
          ) : bulanList.map(bulan => (
            <div key={bulan} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <p style={{ ...eyebrowStyle, padding: "14px 16px 10px" }}>{monthName(bulan)} <span style={{ color: "#475569" }}>({grouped[bulan].length} absen)</span></p>
              <div style={{ display: "flex", flexDirection: "column" }}>
                {grouped[bulan].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((a, i) => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #1e293b" }}>
                    <div>
                      <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{a.driver_name}</p>
                      <p style={{ color: "#475569", fontSize: 12 }}>{fmtDateLong(a.tanggal)}</p>
                    </div>
                    <button onClick={() => hapusAbsen(a.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 18, padding: "0 4px" }}>×</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════
  // TAB: SLIP GAJI
  // ══════════════════════════════════════════════════════
  if (tab === "slip") {
    return (
      <div style={pageStyle}>
        {toast && <Toast toast={toast} />}
        <div style={containerStyle}>
          <div style={{ paddingTop: 48, paddingBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span></div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Slip Gaji</h1>
          </div>

          {/* Form input */}
          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>Karyawan</label>
              <select value={slipDriver} onChange={e => { setSlipDriver(e.target.value); setSlipData(null); }} style={{ ...inputStyle, appearance: "none" }}>
                <option value="">-- Pilih karyawan --</option>
                {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Periode</label>
              <input type="month" value={slipForm.periode} onChange={e => { setSlipForm({ ...slipForm, periode: e.target.value }); setSlipData(null); }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Gaji Pokok</label>
              <input type="text" inputMode="numeric" placeholder="Default: Rp4.000.000" value={slipForm.gaji_pokok} onChange={e => { setSlipForm({ ...slipForm, gaji_pokok: e.target.value }); setSlipData(null); }} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Hari Hadir</label>
              <input type="number" min="0" max="31" placeholder="Contoh: 23" value={slipForm.hari_hadir} onChange={e => { setSlipForm({ ...slipForm, hari_hadir: e.target.value }); setSlipData(null); }} style={inputStyle} />
              {slipDriver && slipForm.periode && (() => {
                const ab = getAbsenBulan(slipDriver, slipForm.periode);
                if (!ab.length) return null;
                return <p style={{ color: "#f59e0b", fontSize: 12, marginTop: 6 }}>⚠ {ab.length}x absen tercatat bulan ini</p>;
              })()}
            </div>
            <div>
              <label style={labelStyle}>Potongan Pinjaman</label>
              <input type="text" inputMode="numeric" placeholder="Kosongkan jika tidak ada" value={slipForm.potongan_pinjaman} onChange={e => { setSlipForm({ ...slipForm, potongan_pinjaman: e.target.value }); setSlipData(null); }} style={inputStyle} />
              {parseInt(String(slipForm.potongan_pinjaman).replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(String(slipForm.potongan_pinjaman).replace(/\D/g,""),10))}</p>}
            </div>
            <button onClick={generateSlip} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px", borderRadius: 14, fontSize: 15 }}>
              Generate Slip Gaji
            </button>
          </div>

          {/* Slip output */}
          {slipData && (
            <div ref={slipRef} style={{ background: "#fff", borderRadius: 20, overflow: "hidden", marginTop: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
              {/* Header slip */}
              <div style={{ background: "#1a1a2e", padding: "24px 24px 20px", textAlign: "center" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <div style={{ width: 36, height: 36, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#1a1a2e", letterSpacing: "-0.05em" }}>GKA</div>
                  <div style={{ textAlign: "left" }}>
                    <p style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: "-0.02em" }}>PT Gratia Karunia Agung</p>
                    <p style={{ color: "#64748b", fontSize: 11 }}>GKA Group · Tangerang</p>
                  </div>
                </div>
                <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "8px 16px", display: "inline-block" }}>
                  <p style={{ color: "#94a3b8", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Slip Gaji — {monthName(slipData.periode)}</p>
                </div>
              </div>

              {/* Info karyawan */}
              <div style={{ background: "#f8fafc", padding: "16px 24px", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Nama Karyawan</p>
                    <p style={{ color: "#0f172a", fontWeight: 800, fontSize: 18 }}>{slipData.driver}</p>
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>Sopir · GKA Group</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Kehadiran</p>
                    <p style={{ color: "#0f172a", fontWeight: 800, fontSize: 24 }}>{slipData.hariHadir}</p>
                    <p style={{ color: "#94a3b8", fontSize: 12 }}>hari hadir</p>
                  </div>
                </div>
              </div>

              {/* Body slip */}
              <div style={{ padding: "20px 24px" }}>
                {/* Penerimaan */}
                <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Penerimaan</p>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  <SlipRow label="Gaji Pokok" val={fmt(slipData.gajiPokok)} color="#0f172a" />
                  <SlipRow label={`Tunjangan Hadir (${slipData.hariHadir} hari × Rp70.000)`} val={fmt(slipData.tunjanganHadir)} color="#0f172a" />
                </div>

                {/* Potongan */}
                {slipData.potonganKasbon > 0 && (
                  <>
                    <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Potongan</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                      <SlipRow label="Potongan Kasbon" val={`- ${fmt(slipData.potonganKasbon)}`} color="#ef4444" />
                    </div>
                  </>
                )}

                {/* Info absen */}
                {slipData.absenCount > 0 && (
                  <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 14 }}>⚠️</span>
                    <p style={{ color: "#92400e", fontSize: 13 }}>{slipData.absenCount}x tidak hadir — sudah dikurangi dari tunjangan hadir</p>
                  </div>
                )}

                {/* Divider */}
                <div style={{ height: 1, background: "#e2e8f0", marginBottom: 16 }} />

                {/* Total */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0f9ff", borderRadius: 14, padding: "14px 18px" }}>
                  <p style={{ color: "#0369a1", fontWeight: 700, fontSize: 15 }}>Total Diterima</p>
                  <p style={{ color: "#0369a1", fontWeight: 900, fontSize: 22, letterSpacing: "-0.02em" }}>{fmt(slipData.total)}</p>
                </div>

                {/* TTD */}
                <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                  <div style={{ textAlign: "center" }}>
                    <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 48 }}>Direktur</p>
                    <div style={{ width: 120, height: 1, background: "#cbd5e1", marginBottom: 4 }} />
                    <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>Timothy Ciesha</p>
                    <p style={{ color: "#94a3b8", fontSize: 11 }}>PT Gratia Karunia Agung</p>
                  </div>
                </div>

                <p style={{ color: "#cbd5e1", fontSize: 10, textAlign: "center", marginTop: 20 }}>Dicetak pada {fmtDateLong(today())} · GKA Kasbon App</p>
              </div>
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  return null;
}

function SlipRow({ label, val, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ color: "#64748b", fontSize: 13, flex: 1 }}>{label}</span>
      <span style={{ color: color || "#0f172a", fontWeight: 700, fontSize: 14, marginLeft: 8 }}>{val}</span>
    </div>
  );
}

function InfoRow({ label, val, bold, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span style={{ color: "#475569" }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: accent || (bold ? "#f1f5f9" : "#94a3b8") }}>{val}</span>
    </div>
  );
}

function HistoryItem({ h, cicilans, fmt, fmtDate }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid #1e293b" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "inherit" }}>
        <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(h.nominal)}</p><p style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>{fmtDate(h.tanggal_kasbon)} → Lunas {fmtDate(h.tanggal_lunas)}</p></div>
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
          {h.fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 12px", fontSize: 13 }}><span style={{ color: "#ef4444" }}>Biaya admin</span><span style={{ fontWeight: 700, color: "#ef4444" }}>{fmt(h.fee)}</span></div>}
        </div>
      )}
    </div>
  );
}

function Modal({ children, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} onClick={onClose}>
      <div style={{ background: "#161b27", borderRadius: "24px 24px 0 0", padding: 24, width: "100%", maxWidth: 420, border: "1px solid #1e293b", borderBottom: "none" }} onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", background: toast.type === "err" ? "#ef4444" : "#1e293b", color: "#f1f5f9", border: `1px solid ${toast.type === "err" ? "#dc2626" : "#334155"}`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}
