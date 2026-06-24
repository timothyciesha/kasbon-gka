import { useState, useEffect } from "react";

const ADMIN_FEE = 50000;
const WAITING_DAYS = 30;
const STORAGE_KEY = "kasbon_v4";

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
const uid = () => Math.random().toString(36).slice(2, 9);

const DEFAULT_DRIVERS = ["Sahrul", "Ajat", "Deden", "Agus"];

const loadData = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  const d = { drivers: DEFAULT_DRIVERS, records: {} };
  DEFAULT_DRIVERS.forEach((name) => { d.records[name] = { active: null, history: [] }; });
  return d;
};

export default function App() {
  const [data, setData] = useState(loadData);
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
  }, [data]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // helpers
  const rec = (driver) => data.records[driver] || { active: null, history: [] };
  const getSisaBayar = (kasbon) => {
    const paid = (kasbon.cicilan || []).reduce((s, c) => s + c.nominal, 0);
    return Math.max(0, kasbon.totalPotong - paid);
  };
  const getStatus = (driver) => {
    const d = rec(driver);
    if (d.active) return "aktif";
    if (!d.history.length) return "bersih";
    const last = d.history[d.history.length - 1]?.tanggalLunas;
    const days = daysSince(last);
    if (days < WAITING_DAYS) return "tunggu";
    return "bisa";
  };
  const getSisaHari = (driver) => {
    const last = rec(driver).history.slice(-1)[0]?.tanggalLunas;
    if (!last) return 0;
    return Math.max(0, WAITING_DAYS - daysSince(last));
  };
  const getFee = (driver) => {
    const last = rec(driver).history.slice(-1)[0]?.tanggalLunas;
    if (!last) return 0;
    return daysSince(last) < WAITING_DAYS ? ADMIN_FEE : 0;
  };

  // actions
  const addDriver = () => {
    const name = newDriverName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (data.drivers.includes(name)) return showToast("Nama sudah ada", "err");
    setData(prev => ({
      drivers: [...prev.drivers, name],
      records: { ...prev.records, [name]: { active: null, history: [] } }
    }));
    setNewDriverName("");
    setShowAddDriver(false);
    showToast(`${name} berhasil ditambahkan`);
  };

  const deleteDriver = (driver) => {
    if (rec(driver).active) return showToast("Lunaskan kasbon aktif dulu", "err");
    setData(prev => {
      const records = { ...prev.records };
      delete records[driver];
      return { drivers: prev.drivers.filter(d => d !== driver), records };
    });
    setShowDeleteDriver(false);
    if (sel === driver) { setSel(null); setView("dashboard"); }
    showToast(`${driver} dihapus`);
  };

  const submitKasbon = () => {
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1000) return showToast("Nominal tidak valid", "err");
    const fee = getFee(sel);
    setData(prev => ({
      ...prev,
      records: {
        ...prev.records,
        [sel]: { ...rec(sel), active: { nominal, fee, totalPotong: nominal + fee, tanggalKasbon: kForm.tanggal, cicilan: [] } }
      }
    }));
    setKForm({ nominal: "", tanggal: today() });
    setView("detail");
    showToast("Kasbon dicatat");
  };

  const submitCicilan = () => {
    const nominal = parseInt(cForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1) return showToast("Nominal tidak valid", "err");
    const active = rec(sel).active;
    const sisa = getSisaBayar(active);
    if (nominal > sisa) return showToast(`Melebihi sisa ${fmt(sisa)}`, "err");
    const newCicilan = [...(active.cicilan || []), { id: uid(), nominal, tanggal: cForm.tanggal }];
    const totalBayar = newCicilan.reduce((s, c) => s + c.nominal, 0);
    const lunas = totalBayar >= active.totalPotong;
    setData(prev => {
      const updated = { ...active, cicilan: newCicilan };
      if (lunas) {
        return { ...prev, records: { ...prev.records, [sel]: { active: null, history: [...rec(sel).history, { ...updated, tanggalLunas: cForm.tanggal }] } } };
      }
      return { ...prev, records: { ...prev.records, [sel]: { ...rec(sel), active: updated } } };
    });
    setCForm({ nominal: "", tanggal: today() });
    setShowCForm(false);
    showToast(lunas ? "Lunas! 🎉" : "Pembayaran dicatat");
  };

  const hapusCicilan = (idx) => {
    const cicilan = [...(rec(sel).active.cicilan || [])];
    cicilan.splice(idx, 1);
    setData(prev => ({ ...prev, records: { ...prev.records, [sel]: { ...rec(sel), active: { ...rec(sel).active, cicilan } } } }));
    setConfirmHapus(null);
    showToast("Cicilan dihapus");
  };

  const statusColor = (s) => ({
    aktif: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    tunggu: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    bisa: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
    bersih: "text-slate-400 bg-slate-400/10 border-slate-400/20",
  }[s]);

  const statusLabel = (s, driver) => ({
    aktif: "Ada Kasbon",
    tunggu: `Tunggu ${getSisaHari(driver)}h`,
    bisa: "Bisa Kasbon",
    bersih: "Belum ada",
  }[s]);

  // ═══════════════════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════════════════
  if (view === "dashboard") {
    const activeDrivers = data.drivers.filter(d => rec(d).active);
    const totalSisa = activeDrivers.reduce((s, d) => s + getSisaBayar(rec(d).active), 0);
    const totalPinjam = activeDrivers.reduce((s, d) => s + rec(d).active.nominal, 0);

    return (
      <div className="min-h-screen" style={{ background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
        {toast && <Toast toast={toast} />}
        {showAddDriver && (
          <Modal onClose={() => { setShowAddDriver(false); setNewDriverName(""); }}>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Tambah Karyawan</p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Nama karyawan baru</p>
            <input
              autoFocus
              type="text"
              placeholder="Nama lengkap"
              value={newDriverName}
              onChange={e => setNewDriverName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addDriver()}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setShowAddDriver(false); setNewDriverName(""); }} style={btnSecondary}>Batal</button>
              <button onClick={addDriver} style={btnPrimary}>Tambah</button>
            </div>
          </Modal>
        )}

        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 80px" }}>
          {/* Header */}
          <div style={{ paddingTop: 48, paddingBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span>
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>GKA Kasbon</h1>
              </div>
              <button
                onClick={() => setShowAddDriver(true)}
                style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                <span style={{ fontSize: 16 }}>+</span> Karyawan
              </button>
            </div>
          </div>

          {/* Summary */}
          {activeDrivers.length > 0 && (
            <div style={{ borderRadius: 20, padding: 20, marginBottom: 20, background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155" }}>
              <p style={{ color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>Ringkasan Aktif</p>
              <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Total dipinjam</p>
                  <p style={{ color: "#f1f5f9", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(totalPinjam)}</p>
                </div>
                <div style={{ width: 1, background: "#1e293b" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Belum terbayar</p>
                  <p style={{ color: "#f59e0b", fontSize: 20, fontWeight: 800, letterSpacing: "-0.02em" }}>{fmt(totalSisa)}</p>
                </div>
              </div>
            </div>
          )}

          {/* Driver list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.drivers.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
                <p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada karyawan</p>
                <p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Karyawan" untuk menambahkan</p>
              </div>
            )}
            {data.drivers.map(driver => {
              const status = getStatus(driver);
              const active = rec(driver).active;
              const sisa = active ? getSisaBayar(active) : 0;
              const progress = active ? Math.round(((active.totalPotong - sisa) / active.totalPotong) * 100) : 0;

              return (
                <button
                  key={driver}
                  onClick={() => { setSel(driver); setView("detail"); }}
                  style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", transition: "border-color 0.15s", width: "100%" }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = "#334155"}
                  onMouseLeave={e => e.currentTarget.style.borderColor = "#1e293b"}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: active ? 12 : 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: 15 }}>
                        {driver[0].toUpperCase()}
                      </div>
                      <div>
                        <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{driver}</p>
                        <p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{rec(driver).history.length} kasbon selesai</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: "1px solid", ...splitStyle(statusColor(status)) }}>
                      {statusLabel(status, driver)}
                    </span>
                  </div>
                  {active && (
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
                        <span style={{ color: "#475569" }}>Terbayar {fmt(active.totalPotong - sisa)}</span>
                        <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
                      </div>
                      <div style={{ height: 4, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 99, transition: "width 0.4s ease" }} />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rules */}
          <div style={{ marginTop: 24, background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16 }}>
            <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Aturan Kasbon</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { icon: "✅", text: "Kasbon ≥30 hari setelah lunas", sub: "Gratis" },
                { icon: "⚡", text: "Kasbon <30 hari setelah lunas", sub: "+Rp50.000 admin" },
                { icon: "🚫", text: "Masih ada kasbon aktif", sub: "Tidak bisa kasbon" },
              ].map((r, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 13, color: "#475569" }}>{r.icon} {r.text}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#64748b" }}>{r.sub}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // DETAIL
  // ═══════════════════════════════════════════════════════
  if (view === "detail" && sel) {
    const d = rec(sel);
    const status = getStatus(sel);
    const active = d.active;
    const sisa = active ? getSisaBayar(active) : 0;
    const totalBayar = active ? active.totalPotong - sisa : 0;
    const progress = active ? Math.round((totalBayar / active.totalPotong) * 100) : 0;
    const canKasbon = status === "bisa" || status === "bersih";

    return (
      <div className="min-h-screen" style={{ background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
        {toast && <Toast toast={toast} />}

        {/* Hapus cicilan confirm */}
        {confirmHapus !== null && (
          <Modal onClose={() => setConfirmHapus(null)}>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Hapus cicilan?</p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Tindakan ini tidak bisa dibatalkan.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setConfirmHapus(null)} style={btnSecondary}>Batal</button>
              <button onClick={() => hapusCicilan(confirmHapus)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button>
            </div>
          </Modal>
        )}

        {/* Delete driver confirm */}
        {showDeleteDriver && (
          <Modal onClose={() => setShowDeleteDriver(false)}>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Hapus {sel}?</p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 20 }}>Semua riwayat kasbon akan ikut terhapus.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowDeleteDriver(false)} style={btnSecondary}>Batal</button>
              <button onClick={() => deleteDriver(sel)} style={{ ...btnPrimary, background: "#ef4444" }}>Hapus</button>
            </div>
          </Modal>
        )}

        {/* Cicilan form sheet */}
        {showCForm && (
          <Modal onClose={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }}>
            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Catat Pembayaran</p>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(sisa)}</strong></p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nominal Bayar</label>
                <input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 500000" value={cForm.nominal} onChange={e => setCForm({ ...cForm, nominal: e.target.value })} style={inputStyle} />
                {parseInt(cForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(cForm.nominal.replace(/\D/g,""),10))}</p>}
              </div>
              <div>
                <label style={labelStyle}>Tanggal Bayar</label>
                <input type="date" value={cForm.tanggal} onChange={e => setCForm({ ...cForm, tanggal: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }} style={btnSecondary}>Batal</button>
              <button onClick={submitCicilan} style={btnPrimary}>Simpan</button>
            </div>
          </Modal>
        )}

        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 80px" }}>
          {/* Header */}
          <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setView("dashboard"); setShowCForm(false); }} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>←</button>
              <div>
                <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22, letterSpacing: "-0.02em" }}>{sel}</h2>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 20, border: "1px solid", ...splitStyle(statusColor(status)) }}>
                  {statusLabel(status, sel)}
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowDeleteDriver(true)}
              style={{ background: "transparent", border: "1px solid #1e293b", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#334155", fontSize: 16 }}
              title="Hapus karyawan"
            >🗑</button>
          </div>

          {/* Active kasbon */}
          {active && (
            <div style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, padding: 18, marginBottom: 12 }}>
              <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Kasbon Aktif</p>

              {/* Progress */}
              <div style={{ marginBottom: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 8 }}>
                  <span style={{ color: "#475569" }}>Terbayar <strong style={{ color: "#94a3b8" }}>{fmt(totalBayar)}</strong></span>
                  <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
                </div>
                <div style={{ height: 6, background: "#0f1117", borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "linear-gradient(90deg, #f59e0b, #fbbf24)", borderRadius: 99 }} />
                </div>
                <p style={{ textAlign: "right", fontSize: 11, color: "#334155", marginTop: 4 }}>{progress}% terbayar</p>
              </div>

              {/* Info */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                <InfoRow label="Nominal kasbon" val={fmt(active.nominal)} />
                {active.fee > 0 && <InfoRow label="Biaya admin" val={`+ ${fmt(active.fee)}`} accent="#ef4444" />}
                <div style={{ height: 1, background: "#1e293b" }} />
                <InfoRow label="Total harus bayar" val={fmt(active.totalPotong)} bold />
                <InfoRow label="Tanggal kasbon" val={fmtDate(active.tanggalKasbon)} />
              </div>

              {/* Cicilan list */}
              {active.cicilan && active.cicilan.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>Rincian Pembayaran</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {active.cicilan.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0f1117", borderRadius: 12, padding: "10px 14px" }}>
                        <div>
                          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(c.nominal)}</p>
                          <p style={{ color: "#475569", fontSize: 12 }}>{fmtDate(c.tanggal)}</p>
                        </div>
                        <button onClick={() => setConfirmHapus(i)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 20, padding: "0 4px" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button onClick={() => { setCForm({ nominal: "", tanggal: today() }); setShowCForm(true); }} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>
                + Catat Pembayaran
              </button>
            </div>
          )}

          {/* New kasbon */}
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
                  <button onClick={() => setView("form")} style={{ background: "#1d4ed8", border: "none", borderRadius: 12, padding: "10px 16px", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Kasbon Sekarang (+Rp50.000)
                  </button>
                </div>
              )}
            </div>
          )}

          {/* History */}
          <div style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, overflow: "hidden" }}>
            <p style={{ color: "#334155", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "16px 18px 10px" }}>
              Riwayat ({d.history.length})
            </p>
            {d.history.length === 0 ? (
              <p style={{ color: "#334155", fontSize: 14, padding: "0 18px 18px" }}>Belum ada riwayat.</p>
            ) : (
              [...d.history].reverse().map((h, i) => <HistoryItem key={i} h={h} fmt={fmt} fmtDate={fmtDate} />)
            )}
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════
  // FORM KASBON BARU
  // ═══════════════════════════════════════════════════════
  if (view === "form" && sel) {
    const fee = getFee(sel);
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10) || 0;
    const total = nominal + fee;

    return (
      <div className="min-h-screen" style={{ background: "#0f1117", color: "#e2e8f0", fontFamily: "'Inter', sans-serif" }}>
        {toast && <Toast toast={toast} />}
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "0 16px 80px" }}>
          <div style={{ paddingTop: 40, paddingBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
            <button onClick={() => setView("detail")} style={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 10, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#94a3b8", fontSize: 18 }}>←</button>
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

          <div style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 20, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={labelStyle}>Nominal Kasbon</label>
              <input type="text" inputMode="numeric" placeholder="Contoh: 500000" value={kForm.nominal} onChange={e => setKForm({ ...kForm, nominal: e.target.value })} style={{ ...inputStyle, fontSize: 24, fontWeight: 800 }} />
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

// ── helpers & sub-components ─────────────────────────────

const splitStyle = (cls) => {
  // parse tailwind-like string into inline style
  const colorMap = {
    "text-amber-400": { color: "#fbbf24" },
    "bg-amber-400/10": { backgroundColor: "rgba(251,191,36,0.1)" },
    "border-amber-400/20": { borderColor: "rgba(251,191,36,0.2)" },
    "text-blue-400": { color: "#60a5fa" },
    "bg-blue-400/10": { backgroundColor: "rgba(96,165,250,0.1)" },
    "border-blue-400/20": { borderColor: "rgba(96,165,250,0.2)" },
    "text-emerald-400": { color: "#34d399" },
    "bg-emerald-400/10": { backgroundColor: "rgba(52,211,153,0.1)" },
    "border-emerald-400/20": { borderColor: "rgba(52,211,153,0.2)" },
    "text-slate-400": { color: "#94a3b8" },
    "bg-slate-400/10": { backgroundColor: "rgba(148,163,184,0.1)" },
    "border-slate-400/20": { borderColor: "rgba(148,163,184,0.2)" },
  };
  return Object.assign({}, ...cls.split(" ").map(c => colorMap[c] || {}));
};

const inputStyle = {
  width: "100%", background: "#0f1117", border: "1px solid #1e293b", borderRadius: 12,
  padding: "12px 14px", color: "#f1f5f9", fontSize: 15, fontFamily: "inherit",
  outline: "none", boxSizing: "border-box",
};
const labelStyle = { display: "block", color: "#475569", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 };
const btnPrimary = { background: "#3b82f6", border: "none", borderRadius: 12, padding: "12px 20px", color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnSecondary = { flex: 1, background: "transparent", border: "1px solid #1e293b", borderRadius: 12, padding: "12px 20px", color: "#64748b", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };

function InfoRow({ label, val, bold, accent }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14 }}>
      <span style={{ color: "#475569" }}>{label}</span>
      <span style={{ fontWeight: bold ? 800 : 600, color: accent || (bold ? "#f1f5f9" : "#94a3b8") }}>{val}</span>
    </div>
  );
}

function HistoryItem({ h, fmt, fmtDate }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid #1e293b" }}>
      <button onClick={() => setOpen(!open)} style={{ width: "100%", padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div>
          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{fmt(h.nominal)}</p>
          <p style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>
            {fmtDate(h.tanggalKasbon)} → Lunas {fmtDate(h.tanggalLunas)}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {h.fee > 0 && <span style={{ fontSize: 11, color: "#ef4444" }}>+admin</span>}
          <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✓ Lunas</span>
          <span style={{ color: "#334155", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
        </div>
      </button>
      {open && h.cicilan && h.cicilan.length > 0 && (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {h.cicilan.map((c, j) => (
            <div key={j} style={{ display: "flex", justifyContent: "space-between", background: "#0f1117", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
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
    <div style={{ position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)", zIndex: 100, padding: "10px 20px", borderRadius: 12, fontSize: 14, fontWeight: 600, fontFamily: "inherit", background: toast.type === "err" ? "#ef4444" : "#1e293b", color: toast.type === "err" ? "#fff" : "#f1f5f9", border: `1px solid ${toast.type === "err" ? "#dc2626" : "#334155"}`, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", whiteSpace: "nowrap" }}>
      {toast.msg}
    </div>
  );
}
