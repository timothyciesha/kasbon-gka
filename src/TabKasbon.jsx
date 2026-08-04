import { useState } from "react";
import { db } from "./db.js";
import { S, fmt, fmtDate, today, daysSince, Modal, Toast, InfoRow, Avatar, ProgressBar, StatusBadge, HistoryItem, PageHeader } from "./shared.jsx";
import { ADMIN_FEE, WAITING_DAYS } from "./shared.jsx";

export default function TabKasbon({ drivers, setDrivers, kasbons, setKasbons, cicilans, setCicilans, BottomNav }) {
  const [view, setView] = useState("dashboard"); // dashboard | detail | form
  const [sel, setSel] = useState(null);
  const [toast, setToast] = useState(null);

  const [kForm, setKForm] = useState({ nominal: "", tanggal: today() });
  const [cForm, setCForm] = useState({ nominal: "", tanggal: today() });
  const [showCForm, setShowCForm] = useState(false);
  const [showAddDriver, setShowAddDriver] = useState(false);
  const [newDriverName, setNewDriverName] = useState("");
  const [newDriverJabatan, setNewDriverJabatan] = useState("");
  const [confirmHapus, setConfirmHapus] = useState(null);
  const [showDeleteDriver, setShowDeleteDriver] = useState(false);
  const [showEditJabatan, setShowEditJabatan] = useState(false);
  const [editJabatanVal, setEditJabatanVal] = useState("Sopir");
  const [showEditGaji, setShowEditGaji] = useState(false);
  const [editGajiVal, setEditGajiVal] = useState("");

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

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
  const statusInfo = (s, n) => ({
    aktif:  { color: "#fbbf24", bg: "rgba(251,191,36,0.1)",  border: "rgba(251,191,36,0.2)",  label: "Ada Kasbon" },
    tunggu: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)",  border: "rgba(96,165,250,0.2)",  label: `Tunggu ${getSisaHari(n)}h` },
    bisa:   { color: "#34d399", bg: "rgba(52,211,153,0.1)",  border: "rgba(52,211,153,0.2)",  label: "Bisa Kasbon" },
    bersih: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)", label: "Belum ada" },
  }[s]);

  // actions
  const addDriver = async () => {
    const name = newDriverName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (drivers.find(d => d.name === name)) return showToast("Nama sudah ada", "err");
    try {
      const jabatan = newDriverJabatan || "Sopir";
      const [created] = await db.post("drivers", { name, jabatan });
      setDrivers(prev => [...prev, created]);
      setNewDriverName(""); setNewDriverJabatan(""); setShowAddDriver(false);
      showToast(`${name} ditambahkan`);
    } catch { showToast("Gagal tambah karyawan", "err"); }
  };

  const deleteDriver = async (n) => {
    if (getActive(n)) return showToast("Lunaskan kasbon aktif dulu", "err");
    try {
      await db.delete("drivers", `name=eq.${encodeURIComponent(n)}`);
      setDrivers(prev => prev.filter(d => d.name !== n));
      setKasbons(prev => prev.filter(k => k.driver_name !== n));
      setShowDeleteDriver(false); setView("dashboard");
      showToast(`${n} dihapus`);
    } catch { showToast("Gagal hapus", "err"); }
  };

  const saveJabatan = async () => {
    const driver = drivers.find(d => d.name === sel);
    if (!driver) return;
    try {
      await db.patch("drivers", driver.id, { jabatan: editJabatanVal });
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, jabatan: editJabatanVal } : d));
      setShowEditJabatan(false); showToast("Jabatan diperbarui");
    } catch { showToast("Gagal update jabatan", "err"); }
  };

  const saveGaji = async () => {
    const nominal = parseInt(String(editGajiVal).replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    const driver = drivers.find(d => d.name === sel);
    if (!driver) return;
    try {
      await db.patch("drivers", driver.id, { gaji_pokok: nominal });
      setDrivers(prev => prev.map(d => d.id === driver.id ? { ...d, gaji_pokok: nominal } : d));
      setShowEditGaji(false); showToast("Gaji pokok diperbarui");
    } catch { showToast("Gagal update gaji", "err"); }
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
      const allCicilan = [...getCicilans(active.id), created];
      const lunas = allCicilan.reduce((s, c) => s + c.nominal, 0) >= active.total_potong;
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

  // ── FORM ─────────────────────────────────────────────
  if (view === "form" && sel) {
    const fee = getFee(sel);
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10) || 0;
    return (
      <div style={S.page}>
        <Toast toast={toast} />
        <div style={S.container}>
          <div style={{ paddingTop: 40, paddingBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("detail")} style={S.backBtn}>←</button>
            <div><h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22 }}>Kasbon Baru</h2><p style={{ color: "#475569", fontSize: 13 }}>{sel}</p></div>
          </div>
          {fee > 0 && <div style={{ background: "#2d1a00", border: "1px solid #78350f", borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 14, color: "#fbbf24" }}>⚡ Dalam masa tunggu — biaya admin <strong>Rp50.000</strong> ditambahkan.</div>}
          <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={S.label}>Nominal Kasbon</label>
              <input type="text" inputMode="numeric" placeholder="Contoh: 500000" value={kForm.nominal} onChange={e => setKForm({ ...kForm, nominal: e.target.value })} style={{ ...S.input, fontSize: 22, fontWeight: 800 }} />
              {nominal > 0 && <p style={{ color: "#475569", fontSize: 13, marginTop: 4 }}>{fmt(nominal)}</p>}
            </div>
            <div>
              <label style={S.label}>Tanggal Kasbon</label>
              <input type="date" value={kForm.tanggal} onChange={e => setKForm({ ...kForm, tanggal: e.target.value })} style={S.input} />
            </div>
            {nominal > 0 && (
              <div style={{ background: "#0f1117", borderRadius: 14, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <InfoRow label="Nominal" val={fmt(nominal)} />
                {fee > 0 && <InfoRow label="Biaya admin" val={`+ ${fmt(fee)}`} accent="#ef4444" />}
                <div style={{ height: 1, background: "#1e293b" }} />
                <InfoRow label="Total potong gaji" val={fmt(nominal + fee)} bold />
              </div>
            )}
            <button onClick={submitKasbon} style={{ ...S.btnPrimary, width: "100%", padding: "14px", borderRadius: 14, fontSize: 15 }}>Simpan Kasbon</button>
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── DETAIL ────────────────────────────────────────────
  if (view === "detail" && sel) {
    const status = getStatus(sel);
    const si = statusInfo(status, sel);
    const active = getActive(sel);
    const history = getHistory(sel);
    const sisa = active ? getSisaBayar(active) : 0;
    const totalBayar = active ? active.total_potong - sisa : 0;
    const progress = active ? Math.round((totalBayar / active.total_potong) * 100) : 0;
    const canKasbon = status === "bisa" || status === "bersih";
    const activeCicilans = active ? getCicilans(active.id) : [];
    const driverData = drivers.find(d => d.name === sel);

    return (
      <div style={S.page}>
        <Toast toast={toast} />
        {confirmHapus !== null && <Modal onClose={() => setConfirmHapus(null)}><p style={S.modalTitle}>Hapus cicilan?</p><p style={S.modalSub}>Tidak bisa dibatalkan.</p><div style={S.rowBtns}><button onClick={() => setConfirmHapus(null)} style={S.btnSecondary}>Batal</button><button onClick={() => hapusCicilan(confirmHapus)} style={{ ...S.btnPrimary, background: "#ef4444" }}>Hapus</button></div></Modal>}
        {showDeleteDriver && <Modal onClose={() => setShowDeleteDriver(false)}><p style={S.modalTitle}>Hapus {sel}?</p><p style={S.modalSub}>Semua data terhapus permanen.</p><div style={S.rowBtns}><button onClick={() => setShowDeleteDriver(false)} style={S.btnSecondary}>Batal</button><button onClick={() => deleteDriver(sel)} style={{ ...S.btnPrimary, background: "#ef4444" }}>Hapus</button></div></Modal>}
        {showEditJabatan && <Modal onClose={() => setShowEditJabatan(false)}><p style={S.modalTitle}>Edit Jabatan</p><p style={S.modalSub}>{sel}</p><select value={editJabatanVal} onChange={e => setEditJabatanVal(e.target.value)} style={{ ...S.input, appearance: "none" }}><option>Sopir</option><option>Sales</option><option>Admin</option><option>Kolektor</option></select><div style={S.rowBtns}><button onClick={() => setShowEditJabatan(false)} style={S.btnSecondary}>Batal</button><button onClick={saveJabatan} style={S.btnPrimary}>Simpan</button></div></Modal>}
        {showEditGaji && <Modal onClose={() => setShowEditGaji(false)}><p style={S.modalTitle}>Edit Gaji Pokok</p><p style={S.modalSub}>{sel}</p><input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 4000000" value={editGajiVal} onChange={e => setEditGajiVal(e.target.value)} style={{ ...S.input, fontSize: 20, fontWeight: 800 }} />{parseInt(String(editGajiVal).replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 6 }}>{fmt(parseInt(String(editGajiVal).replace(/\D/g,""),10))}</p>}<div style={S.rowBtns}><button onClick={() => setShowEditGaji(false)} style={S.btnSecondary}>Batal</button><button onClick={saveGaji} style={S.btnPrimary}>Simpan</button></div></Modal>}
        {showCForm && (
          <Modal onClose={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }}>
            <p style={S.modalTitle}>Catat Pembayaran</p>
            <p style={S.modalSub}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(sisa)}</strong></p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Nominal Bayar</label><input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 500000" value={cForm.nominal} onChange={e => setCForm({ ...cForm, nominal: e.target.value })} style={S.input} />{parseInt(cForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(cForm.nominal.replace(/\D/g,""),10))}</p>}</div>
              <div><label style={S.label}>Tanggal Bayar</label><input type="date" value={cForm.tanggal} onChange={e => setCForm({ ...cForm, tanggal: e.target.value })} style={S.input} /></div>
            </div>
            <div style={S.rowBtns}><button onClick={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }} style={S.btnSecondary}>Batal</button><button onClick={submitCicilan} style={S.btnPrimary}>Simpan</button></div>
          </Modal>
        )}
        <div style={S.container}>
          <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => setView("dashboard")} style={S.backBtn}>←</button>
              <div>
                <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22 }}>{sel}</h2>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                  <StatusBadge {...si} />
                  <button onClick={() => { setEditJabatanVal(driverData?.jabatan || "Sopir"); setShowEditJabatan(true); }} style={{ fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 20, border: "1px solid #1e293b", color: "#475569", background: "transparent", cursor: "pointer", fontFamily: "inherit" }}>
                    {driverData?.jabatan || "Sopir"} ✏️
                  </button>
                </div>
                <button onClick={() => { setEditGajiVal(driverData?.gaji_pokok || 4000000); setShowEditGaji(true); }} style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: "#475569", background: "transparent", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
                  Gaji pokok: <strong style={{ color: "#94a3b8" }}>{fmt(driverData?.gaji_pokok || 4000000)}</strong> ✏️
                </button>
              </div>
            </div>
            <button onClick={() => setShowDeleteDriver(true)} style={{ ...S.backBtn, color: "#475569" }}>🗑</button>
          </div>

          {active && (
            <div style={S.card}>
              <p style={S.eyebrow}>Kasbon Aktif</p>
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "#475569" }}>Terbayar <strong style={{ color: "#94a3b8" }}>{fmt(totalBayar)}</strong></span>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
                </div>
                <ProgressBar progress={progress} />
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
                  <p style={S.eyebrow}>Rincian Pembayaran</p>
                  {activeCicilans.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", borderRadius: 12, padding: "10px 14px", marginBottom: 6 }}>
                      <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(c.nominal)}</p><p style={{ color: "#475569", fontSize: 12 }}>{fmtDate(c.tanggal)}</p></div>
                      <button onClick={() => setConfirmHapus(c.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 20 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => { setCForm({ nominal: "", tanggal: today() }); setShowCForm(true); }} style={{ ...S.btnPrimary, width: "100%" }}>+ Catat Pembayaran</button>
            </div>
          )}

          {!active && (
            <div style={{ marginBottom: 12 }}>
              {canKasbon && <button onClick={() => setView("form")} style={{ ...S.btnPrimary, width: "100%", padding: "14px", borderRadius: 16, fontSize: 15, marginBottom: 8 }}>+ Catat Kasbon Baru{getFee(sel) === 0 && <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6, fontWeight: 400 }}>· Gratis</span>}</button>}
              {status === "tunggu" && (
                <div style={{ background: "#0d1a2e", border: "1px solid #1e3a5f", borderRadius: 18, padding: 16 }}>
                  <p style={{ color: "#60a5fa", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Masa tunggu: {getSisaHari(sel)} hari lagi</p>
                  <p style={{ color: "#3b82f6", fontSize: 13, marginBottom: 12 }}>atau kasbon sekarang dengan biaya admin Rp50.000</p>
                  <button onClick={() => setView("form")} style={{ background: "#1d4ed8", border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Kasbon Sekarang (+Rp50.000)</button>
                </div>
              )}
            </div>
          )}

          <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
            <p style={{ ...S.eyebrow, padding: "16px 18px 10px" }}>Riwayat ({history.length})</p>
            {history.length === 0 ? <p style={{ color: "#334155", fontSize: 14, padding: "0 18px 18px" }}>Belum ada riwayat.</p>
              : [...history].reverse().map(h => <HistoryItem key={h.id} h={h} cicilans={getCicilans(h.id)} fmt={fmt} fmtDate={fmtDate} />)}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── DASHBOARD ─────────────────────────────────────────
  const activeDrivers = drivers.filter(d => getActive(d.name));
  const totalSisa = activeDrivers.reduce((s, d) => s + getSisaBayar(getActive(d.name)), 0);
  const totalPinjam = activeDrivers.reduce((s, d) => s + getActive(d.name).nominal, 0);

  return (
    <div style={S.page}>
      <Toast toast={toast} />
      {showAddDriver && (
        <Modal onClose={() => { setShowAddDriver(false); setNewDriverName(""); setNewDriverJabatan(""); }}>
          <p style={S.modalTitle}>Tambah Karyawan</p>
          <p style={S.modalSub}>Isi nama dan jabatan</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={S.label}>Nama</label><input autoFocus type="text" placeholder="Nama lengkap" value={newDriverName} onChange={e => setNewDriverName(e.target.value)} onKeyDown={e => e.key === "Enter" && addDriver()} style={S.input} /></div>
            <div><label style={S.label}>Jabatan</label><select value={newDriverJabatan} onChange={e => setNewDriverJabatan(e.target.value)} style={{ ...S.input, appearance: "none" }}><option value="">-- Pilih jabatan --</option><option>Sopir</option><option>Sales</option><option>Admin</option><option>Kolektor</option></select></div>
          </div>
          <div style={S.rowBtns}><button onClick={() => { setShowAddDriver(false); setNewDriverName(""); setNewDriverJabatan(""); }} style={S.btnSecondary}>Batal</button><button onClick={addDriver} style={S.btnPrimary}>Tambah</button></div>
        </Modal>
      )}
      <div style={S.container}>
        <div style={{ paddingTop: 48, paddingBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <PageHeader title="GKA App" />
          <button onClick={() => setShowAddDriver(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Karyawan</button>
        </div>
        {activeDrivers.length > 0 && (
          <div style={{ borderRadius: 20, padding: 20, marginBottom: 16, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}>
            <p style={S.eyebrow}>Ringkasan Kasbon Aktif</p>
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
            const si = statusInfo(status, driver.name);
            const active = getActive(driver.name);
            const sisa = active ? getSisaBayar(active) : 0;
            const progress = active ? Math.round(((active.total_potong - sisa) / active.total_potong) * 100) : 0;
            return (
              <button key={driver.id} onClick={() => { setSel(driver.name); setView("detail"); }} style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: active ? 12 : 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <Avatar name={driver.name} />
                    <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{driver.name}</p><p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{getHistory(driver.name).length} kasbon selesai</p></div>
                  </div>
                  <StatusBadge {...si} />
                </div>
                {active && (<div><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}><span style={{ color: "#475569" }}>Terbayar {fmt(active.total_potong - sisa)}</span><span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span></div><ProgressBar progress={progress} /></div>)}
              </button>
            );
          })}
        </div>
        <div style={{ marginTop: 20, ...S.card }}>
          <p style={S.eyebrow}>Aturan Kasbon</p>
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
