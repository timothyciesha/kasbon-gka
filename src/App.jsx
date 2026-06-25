import { useState, useEffect } from "react";

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
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "DELETE", headers,
    });
    if (!res.ok) throw await res.json();
  },
};

const ADMIN_FEE = 50000;
const WAITING_DAYS = 30;
const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
const fmtDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};
const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};
const today = () => new Date().toISOString().slice(0, 10);

export default function App() {
  const [drivers, setDrivers] = useState([]);
  const [kasbons, setKasbons] = useState([]);
  const [cicilans, setCicilans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("dashboard");
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  const [kForm, setKForm] = useState({ nominal: "", tanggal: today() });
  const [cForm, setCForm] = useState({ nominal: "", tanggal: today() });
  const [showCForm, setShowCForm] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [confirmHapus, setConfirmHapus] = useState(null);
  const [showDeleteDriver, setShowDeleteDriver] = useState(false);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── fetch all data ──
  const fetchAll = async () => {
    try {
      const [d, k, c] = await Promise.all([
        db.get("drivers", "order=created_at.asc"),
        db.get("kasbons", "order=created_at.asc"),
        db.get("cicilans", "order=created_at.asc"),
      ]);
      setDrivers(d);
      setKasbons(k);
      setCicilans(c);
    } catch (e) {
      showToast("Gagal load data", "err");
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // ── helpers ──
  const getActive = (driverName) =>
    kasbons.find(k => k.driver_name === driverName && k.is_active) || null;

  const getHistory = (driverName) =>
    kasbons.filter(k => k.driver_name === driverName && !k.is_active);

  const getCicilans = (kasbonId) =>
    cicilans.filter(c => c.kasbon_id === kasbonId);

  const getSisaBayar = (kasbon) => {
    const paid = getCicilans(kasbon.id).reduce((s, c) => s + c.nominal, 0);
    return Math.max(0, kasbon.total_potong - paid);
  };

  const getLastLunas = (driverName) => {
    const hist = getHistory(driverName);
    if (!hist.length) return null;
    return hist[hist.length - 1].tanggal_lunas;
  };

  const getStatus = (driverName) => {
    const active = getActive(driverName);
    if (active) return "aktif";
    const hist = getHistory(driverName);
    if (!hist.length) return "bersih";
    const days = daysSince(getLastLunas(driverName));
    if (days < WAITING_DAYS) return "tunggu";
    return "bisa";
  };

  const getSisaHari = (driverName) => {
    const last = getLastLunas(driverName);
    if (!last) return 0;
    return Math.max(0, WAITING_DAYS - daysSince(last));
  };

  const getFee = (driverName) => {
    const last = getLastLunas(driverName);
    if (!last) return 0;
    return daysSince(last) < WAITING_DAYS ? ADMIN_FEE : 0;
  };

  // ── actions ──
  const addDriver = async () => {
    const name = newDriverName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (drivers.find(d => d.name === name)) return showToast("Nama sudah ada", "err");
    try {
      const [created] = await db.post("drivers", { name });
      setDrivers(prev => [...prev, created]);
      setNewDriverName("");
      setShowAddDriver(false);
      showToast(`${name} berhasil ditambahkan`);
    } catch { showToast("Gagal tambah karyawan", "err"); }
  };

  const deleteDriver = async (driverName) => {
    if (getActive(driverName)) return showToast("Lunaskan kasbon aktif dulu", "err");
    try {
      await db.delete("drivers", `name=eq.${encodeURIComponent(driverName)}`);
      setDrivers(prev => prev.filter(d => d.name !== driverName));
      setKasbons(prev => prev.filter(k => k.driver_name !== driverName));
      setShowDeleteDriver(false);
      setView("dashboard");
      showToast(`${driverName} dihapus`);
    } catch { showToast("Gagal hapus karyawan", "err"); }
  };

  const submitKasbon = async () => {
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1000) return showToast("Nominal tidak valid", "err");
    const fee = getFee(sel);
    try {
      const [created] = await db.post("kasbons", {
        driver_name: sel, nominal, fee,
        total_potong: nominal + fee,
        tanggal_kasbon: kForm.tanggal,
        is_active: true,
      });
      setKasbons(prev => [...prev, created]);
      setKForm({ nominal: "", tanggal: today() });
      setView("detail");
      showToast("Kasbon dicatat");
    } catch { showToast("Gagal simpan kasbon", "err"); }
  };

  const submitCicilan = async () => {
    const nominal = parseInt(cForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1) return showToast("Nominal tidak valid", "err");
    const active = getActive(sel);
    const sisa = getSisaBayar(active);
    if (nominal > sisa) return showToast(`Melebihi sisa ${fmt(sisa)}`, "err");
    try {
      const [created] = await db.post("cicilans", {
        kasbon_id: active.id, nominal, tanggal: cForm.tanggal,
      });
      const newCicilans = [...getCicilans(active.id), created];
      const totalBayar = newCicilans.reduce((s, c) => s + c.nominal, 0);
      const lunas = totalBayar >= active.total_potong;
      setCicilans(prev => [...prev, created]);
      if (lunas) {
        await db.patch("kasbons", active.id, { is_active: false, tanggal_lunas: cForm.tanggal });
        setKasbons(prev => prev.map(k => k.id === active.id ? { ...k, is_active: false, tanggal_lunas: cForm.tanggal } : k));
        showToast("Lunas! 🎉");
      } else {
        showToast("Pembayaran dicatat");
      }
      setCForm({ nominal: "", tanggal: today() });
      setShowCForm(false);
    } catch { showToast("Gagal simpan cicilan", "err"); }
  };

  const hapusCicilan = async (cicilanId) => {
    try {
      await db.delete("cicilans", `id=eq.${cicilanId}`);
      setCicilans(prev => prev.filter(c => c.id !== cicilanId));
      setConfirmHapus(null);
      showToast("Cicilan dihapus");
    } catch { showToast("Gagal hapus cicilan", "err"); }
  };

  const statusColor = (s) => ({
    aktif: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
    tunggu: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
    bisa: { color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)" },
    bersih: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
  }[s]);

  const statusLabel = (s, driver) => ({
    aktif: "Ada Kasbon",
    tunggu: `Tunggu ${getSisaHari(driver)}h`,
    bisa: "Bisa Kasbon",
    bersih: "Belum ada",
  }[s]);

  // ════════════════════════════════════════════════════
  // LOADING
  // ════════════════════════════════════════════════════
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#475569", fontSize: 14 }}>Memuat data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // ════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════
  if (view === "dashboard") {
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
            <input autoFocus type="text" placeholder="Nama lengkap" value={newDriverName}
              onChange={e => setNewDriverName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addDriver()}
              style={inputStyle} />
            <div style={rowStyle}>
              <button onClick={() => { setShowAddDriver(false); setNewDriverName(""); }} style={btnSecondary}>Batal</button>
              <button onClick={addDriver} style={btnPrimary}>Tambah</button>
            </div>
          </Modal>
        )}

        <div style={containerStyle}>
          <div style={{ paddingTop: 48, paddingBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>GKA Kasbon</h1>
              </div>
              <button onClick={() => setShowAddDriver(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                <span style={{ fontSize: 16 }}>+</span> Karyawan
              </button>
            </div>
          </div>

          {activeDrivers.length > 0 && (
            <div style={{ borderRadius: 20, padding: 20, marginBottom: 16, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}>
              <p style={eyebrowStyle}>Ringkasan Aktif</p>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Total dipinjam</p>
                  <p style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(totalPinjam)}</p>
                </div>
                <div style={{ width: 1, background: "#334155" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Belum terbayar</p>
                  <p style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(totalSisa)}</p>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {drivers.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada karyawan</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Karyawan" untuk menambahkan</p>
              </div>
            )}
            {drivers.map(driver => {
              const status = getStatus(driver.name);
              const sc = statusColor(status);
              const active = getActive(driver.name);
              const sisa = active ? getSisaBayar(active) : 0;
              const progress = active ? Math.round(((active.total_potong - sisa) / active.total_potong) * 100) : 0;
              return (
                <button key={driver.id} onClick={() => { setSel(driver.name); setView("detail"); }}
                  style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: active ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: 15 }}>
                        {driver.name[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{driver.name}</p>
                        <p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{getHistory(driver.name).length} kasbon selesai</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>
                      {statusLabel(status, driver.name)}
                    </span>
                  </div>
                  {active && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                        <span style={{ color: "#475569" }}>Terbayar {fmt(active.total_potong - sisa)}</span>
                        <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
                      </div>
                      <div style={{ height: 4, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 99 }} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 20, background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16 }}>
            <p style={eyebrowStyle}>Aturan Kasbon</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["✅", "Kasbon ≥30 hari setelah lunas", "Gratis"],
                ["⚡", "Kasbon <30 hari setelah lunas", "+Rp50.000 admin"],
                ["🚫", "Masih ada kasbon aktif", "Tidak bisa kasbon"],
              ].map(([icon, text, sub], i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>{icon} {text}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // DETAIL
  // ════════════════════════════════════════════════════
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

        {confirmHapus !== null && (
          <Modal onClose={() => setConfirmHapus(null)}>
            <p style={modalTitle}>Hapus cicilan?</p>
            <p style={modalSub}>Tindakan ini tidak bisa dibatalkan.</p>
            <div style={rowStyle}>
              <button onClick={() => setConfirmHapus(null)} style={btnSecondary}>Batal</button>
              <button onClick={() => hapusCicilan(confirmHapus)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button>
            </div>
          </Modal>
        )}

        {showDeleteDriver && (
          <Modal onClose={() => setShowDeleteDriver(false)}>
            <p style={modalTitle}>Hapus {sel}?</p>
            <p style={modalSub}>Semua riwayat kasbon akan ikut terhapus permanen.</p>
            <div style={rowStyle}>
              <button onClick={() => setShowDeleteDriver(false)} style={btnSecondary}>Batal</button>
              <button onClick={() => deleteDriver(sel)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button>
            </div>
          </Modal>
        )}

        {showCForm && (
          <Modal onClose={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }}>
            <p style={modalTitle}>Catat Pembayaran</p>
            <p style={modalSub}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(sisa)}</strong></p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={labelStyle}>Nominal Bayar</label>
                <input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 500000"
                  value={cForm.nominal} onChange={e => setCForm({ ...cForm, nominal: e.target.value })}
                  style={inputStyle} />
                {parseInt(cForm.nominal.replace(/\D/g,""),10) > 0 &&
                  <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(cForm.nominal.replace(/\D/g,""),10))}</p>}
              </div>
              <div>
                <label style={labelStyle}>Tanggal Bayar</label>
                <input type="date" value={cForm.tanggal} onChange={e => setCForm({ ...cForm, tanggal: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={rowStyle}>
              <button onClick={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }} style={btnSecondary}>Batal</button>
              <button onClick={submitCicilan} style={btnPrimary}>Simpan</button>
            </div>
          </Modal>
        )}

        <div style={containerStyle}>
          <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setView("dashboard"); setShowCForm(false); }} style={backBtn}>←</button>
              <div>
                <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{sel}</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>
                  {statusLabel(status, sel)}
                </span>
              </div>
            </div>
            <button onClick={() => setShowDeleteDriver(true)} style={{ ...backBtn, color: "#475569" }} title="Hapus karyawan">🗑</button>
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
                    {activeCicilans.map((c, i) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", borderRadius: 12, padding: "10px 14px" }}>
                        <div>
                          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(c.nominal)}</p>
                          <p style={{ color: "#475569", fontSize: 12 }}>{fmtDate(c.tanggal)}</p>
                        </div>
                        <button onClick={() => setConfirmHapus(c.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 20, padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => { setCForm({ nominal: "", tanggal: today() }); setShowCForm(true); }}
                style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>
                + Catat Pembayaran
              </button>
            </div>
          )}

          {!active && (
            <div style={{ marginBottom: 12 }}>
              {canKasbon && (
                <button onClick={() => setView("form")} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px 20px", borderRadius: 16, fontSize: 15 }}>
                  + Catat Kasbon Baru
                  {getFee(sel) === 0 && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6, fontWeight: 400 }}>· Gratis</span>}
                </button>
              )}
              {status === "tunggu" && (
                <div style={{ background: "#0d1a2e", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
                  <p style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Masa tunggu: {getSisaHari(sel)} hari lagi</p>
                  <p style={{ color: "#3b82f6", fontSize: 13, marginBottom: 12 }}>atau kasbon sekarang dengan biaya admin Rp50.000</p>
                  <button onClick={() => setView("form")} style={{ background: "#1d4ed8", border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                    Kasbon Sekarang (+Rp50.000)
                  </button>
                </div>
              )}
            </div>
          )}

          <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <p style={{ ...eyebrowStyle, padding: "16px 18px 10px" }}>Riwayat ({history.length})</p>
            {history.length === 0 ? (
              <p style={{ color: "#334155", fontSize: 14, padding: "0 18px 18px" }}>Belum ada riwayat.</p>
            ) : (
              [...history].reverse().map(h => (
                <HistoryItem key={h.id} h={h} cicilans={getCicilans(h.id)} fmt={fmt} fmtDate={fmtDate} />
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════
  // FORM KASBON BARU
  // ════════════════════════════════════════════════════
  if (view === "form" && sel) {
    const fee = getFee(sel);
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10) || 0;
    const total = nominal + fee;

    return (
      <div style={pageStyle}>
        {toast && <Toast toast={toast} />}
        <div style={containerStyle}>
          <div style={{ paddingTop: 40, paddingBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("detail")} style={backBtn}>←</button>
            <div>
              <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>Kasbon Baru</h2>
              <p style={{ color: "#475569", fontSize: 13 }}>{sel}</p>
            </div>
          </div>

          {fee > 0 && (
            <div style={{ background: "#2d1a00", border: "1px solid #78350f", borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, color: "#fbbf24" }}>
              ⚡ Dalam masa tunggu — biaya admin <strong>Rp50.000</strong> ditambahkan.
            </div>
          )}

          <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nominal Kasbon</label>
              <input type="text" inputMode="numeric" placeholder="Contoh: 500000"
                value={kForm.nominal} onChange={e => setKForm({ ...kForm, nominal: e.target.value })}
                style={{ ...inputStyle, fontSize: 24, fontWeight: 800 }} />
              {nominal > 0 && <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{fmt(nominal)}</p>}
            </div>
            <div>
              <label style={labelStyle}>Tanggal Kasbon</label>
              <input type="date" value={kForm.tanggal} onChange={e => setKForm({ ...kForm, tanggal: e.target.value })} style={inputStyle} />
            </div>
            {nominal > 0 && (
              <div style={{ background: "#0f1117", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <InfoRow label="Nominal" val={fmt(nominal)} />
                {fee > 0 && <InfoRow label="Biaya admin" val={`+ ${fmt(fee)}`} accent="#ef4444" />}
                <div style={{ height: 1, background: "#1e293b" }} />
                <InfoRow label="Total potong gaji" val={fmt(total)} bold />
              </div>
            )}
            <button onClick={submitKasbon} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px", borderRadius: 14, fontSize: 15 }}>
              Simpan Kasbon
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── shared styles ─────────────────────────────────────
const pageStyle = { minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" };
const containerStyle = { maxWidth: 420, margin: "0 auto", padding: "0 16px 80px" };
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
          {cicilans.map((c) => (
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
