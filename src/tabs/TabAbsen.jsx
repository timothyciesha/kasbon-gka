import { useState } from "react";
import { db } from "../lib/db";
import { fmt, fmtDate, fmtDateLong, today, monthName, getNextGajian, daysSince } from "../lib/utils";
import { pageStyle, containerStyle, cardStyle, eyebrowStyle, labelStyle, inputStyle, btnPrimary, btnSecondary, rowStyle, modalTitle, modalSub, GKAHeader, Modal, Toast } from "../components/UI";

export default function TabAbsen({ drivers, absens, setAbsens, gajianList, setGajianList, toast, showToast }) {
  const [showAbsenForm, setShowAbsenForm] = useState(false);
  const [absenForm, setAbsenForm] = useState({ driver_name: "", tanggal: today() });
  const [showGajianForm, setShowGajianForm] = useState(false);
  const [gajianTanggal, setGajianTanggal] = useState(today());
  const [showConfirmReset, setShowConfirmReset] = useState(false);

  const lastGajian = gajianList[0] || null;
  const nextGajian = lastGajian ? getNextGajian(lastGajian.tanggal) : null;
  const daysUntilGajian = nextGajian ? Math.ceil((new Date(nextGajian).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000*60*60*24)) : null;

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

  const submitGajian = async () => {
    try {
      const [created] = await db.post("gajian", { tanggal: gajianTanggal });
      setGajianList(prev => [created, ...prev]);
      setShowGajianForm(false);
      showToast("Tanggal gajian dicatat");
    } catch { showToast("Gagal simpan gajian", "err"); }
  };

  const resetAbsen = async () => {
    try {
      await db.delete("absens", "id=neq.00000000-0000-0000-0000-000000000000");
      setAbsens([]);
      setShowConfirmReset(false);
      showToast("Absen direset ✓");
    } catch { showToast("Gagal reset absen", "err"); }
  };

  const grouped = {};
  absens.forEach(a => {
    const bulan = a.tanggal.slice(0, 7);
    if (!grouped[bulan]) grouped[bulan] = [];
    grouped[bulan].push(a);
  });
  const bulanList = Object.keys(grouped).sort().reverse();
  const bulanIni = today().slice(0, 7);
  const absenBulanIni = absens.filter(a => a.tanggal.startsWith(bulanIni));
  const perDriver = {};
  absenBulanIni.forEach(a => { perDriver[a.driver_name] = (perDriver[a.driver_name] || 0) + 1; });

  return (
    <div style={pageStyle}>
      <Toast toast={toast} />

      {showAbsenForm && (
        <Modal onClose={() => setShowAbsenForm(false)}>
          <p style={modalTitle}>Catat Absen</p>
          <p style={modalSub}>Pilih karyawan dan tanggal</p>
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

      {showGajianForm && (
        <Modal onClose={() => setShowGajianForm(false)}>
          <p style={modalTitle}>Catat Gajian</p>
          <p style={modalSub}>Tanggal gajian dilakukan</p>
          <input type="date" value={gajianTanggal} onChange={e => setGajianTanggal(e.target.value)} style={inputStyle} />
          <div style={rowStyle}>
            <button onClick={() => setShowGajianForm(false)} style={btnSecondary}>Batal</button>
            <button onClick={submitGajian} style={btnPrimary}>Simpan</button>
          </div>
        </Modal>
      )}

      {showConfirmReset && (
        <Modal onClose={() => setShowConfirmReset(false)}>
          <p style={modalTitle}>Reset semua absen?</p>
          <p style={modalSub}>Data lama tetap tersimpan di database sebagai arsip.</p>
          <div style={rowStyle}>
            <button onClick={() => setShowConfirmReset(false)} style={btnSecondary}>Batal</button>
            <button onClick={resetAbsen} style={{ ...btnPrimary, background: "#ef4444" }}>Reset</button>
          </div>
        </Modal>
      )}

      <div style={containerStyle}>
        <GKAHeader title="Absensi" action={
          <button onClick={() => setShowAbsenForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <span>+</span> Absen
          </button>
        } />

        {/* Info gajian */}
        <div style={{ ...cardStyle, marginBottom: 16 }}>
          <p style={eyebrowStyle}>Info Gajian</p>
          <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
            <div style={{ flex: 1 }}>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Gajian terakhir</p>
              <p style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 15 }}>{lastGajian ? fmtDateLong(lastGajian.tanggal) : "-"}</p>
            </div>
            {nextGajian && (
              <>
                <div style={{ width: 1, background: "#1e293b" }} />
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Gajian berikutnya</p>
                  <p style={{ color: daysUntilGajian <= 3 ? "#f59e0b" : "#34d399", fontWeight: 800, fontSize: 15 }}>{fmtDateLong(nextGajian)}</p>
                  <p style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>{daysUntilGajian > 0 ? `${daysUntilGajian} hari lagi` : daysUntilGajian === 0 ? "Hari ini!" : `${Math.abs(daysUntilGajian)} hari lalu`}</p>
                </div>
              </>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowGajianForm(true)} style={{ ...btnSecondary, flex: 1, fontSize: 13, padding: "10px" }}>+ Catat Gajian</button>
            <button onClick={() => setShowConfirmReset(true)} style={{ ...btnPrimary, background: "transparent", border: "1px solid #ef4444", color: "#ef4444", flex: 1, fontSize: 13, padding: "10px" }}>🔄 Reset Absen</button>
          </div>
        </div>

        {/* Rekap bulan ini */}
        {absenBulanIni.length > 0 && (
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <p style={eyebrowStyle}>Rekap {monthName(bulanIni)}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {drivers.map(d => (
                <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#94a3b8", fontSize: 14 }}>{d.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 20, background: perDriver[d.name] ? "rgba(239,68,68,0.1)" : "rgba(52,211,153,0.1)", color: perDriver[d.name] ? "#ef4444" : "#34d399", border: `1px solid ${perDriver[d.name] ? "rgba(239,68,68,0.2)" : "rgba(52,211,153,0.2)"}` }}>
                    {perDriver[d.name] ? `${perDriver[d.name]}x absen` : "Hadir semua"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* List absen by bulan */}
        {absens.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada catatan absen</p>
          </div>
        ) : bulanList.map(bulan => (
          <div key={bulan} style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
            <p style={{ ...eyebrowStyle, padding: "14px 16px 10px" }}>{monthName(bulan)} <span style={{ color: "#475569" }}>({grouped[bulan].length} absen)</span></p>
            {grouped[bulan].sort((a, b) => b.tanggal.localeCompare(a.tanggal)).map((a, i) => (
              <div key={a.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #1e293b" }}>
                <div>
                  <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 14 }}>{a.driver_name}</p>
                  <p style={{ color: "#475569", fontSize: 12 }}>{fmtDateLong(a.tanggal)}</p>
                </div>
                <button onClick={() => hapusAbsen(a.id)} style={{ background: "transparent", border: "none", color: "#334155", cursor: "pointer", fontSize: 18 }}>×</button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
