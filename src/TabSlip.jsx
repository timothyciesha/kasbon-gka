import { useState } from "react";
import { S, fmt, fmtDateLong, today, monthName } from "./shared.jsx";
import { TUNJANGAN_PER_HARI, DEFAULT_GAJI } from "./shared.jsx";

function SlipRow({ label, val, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span style={{ color: "#64748b", fontSize: 13, flex: 1 }}>{label}</span>
      <span style={{ color: color || "#0f172a", fontWeight: 700, fontSize: 14 }}>{val}</span>
    </div>
  );
}

export default function TabSlip({ drivers, absens, BottomNav }) {
  const [selDriver, setSelDriver] = useState("");
  const [form, setForm] = useState({ periode: today().slice(0, 7), gaji_pokok: DEFAULT_GAJI, hari_hadir: "", potongan_pinjaman: "" });
  const [slipData, setSlipData] = useState(null);

  const getAbsenBulan = (name, periode) => absens.filter(a => a.driver_name === name && a.tanggal.startsWith(periode));

  const generate = () => {
    if (!selDriver) return alert("Pilih karyawan dulu");
    const hari = parseInt(form.hari_hadir, 10);
    if (!hari || hari < 0) return alert("Masukkan hari hadir");
    const gajiPokok = parseInt(String(form.gaji_pokok).replace(/\D/g, ""), 10) || DEFAULT_GAJI;
    const tunjangan = hari * TUNJANGAN_PER_HARI;
    const potongan = parseInt(String(form.potongan_pinjaman || "0").replace(/\D/g, ""), 10) || 0;
    const driverData = drivers.find(d => d.name === selDriver);
    setSlipData({
      driver: selDriver,
      jabatan: driverData?.jabatan || "Sopir",
      periode: form.periode,
      gajiPokok,
      hariHadir: hari,
      tunjangan,
      absenCount: getAbsenBulan(selDriver, form.periode).length,
      potongan,
      total: gajiPokok + tunjangan - potongan,
    });
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        <div style={{ paddingTop: 48, paddingBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}><div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} /><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" }}>GKA Group</span></div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: "#f1f5f9", letterSpacing: "-0.02em" }}>Slip Gaji</h1>
        </div>

        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={S.label}>Karyawan</label>
            <select value={selDriver} onChange={e => {
              const name = e.target.value;
              const d = drivers.find(dr => dr.name === name);
              setSelDriver(name);
              setForm(prev => ({ ...prev, gaji_pokok: d?.gaji_pokok || DEFAULT_GAJI }));
              setSlipData(null);
            }} style={{ ...S.input, appearance: "none" }}>
              <option value="">-- Pilih karyawan --</option>
              {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Periode</label>
            <input type="month" value={form.periode} onChange={e => { setForm({ ...form, periode: e.target.value }); setSlipData(null); }} style={S.input} />
          </div>
          <div>
            <label style={S.label}>Gaji Pokok</label>
            <input type="text" inputMode="numeric" placeholder="Gaji pokok" value={form.gaji_pokok} onChange={e => { setForm({ ...form, gaji_pokok: e.target.value }); setSlipData(null); }} style={S.input} />
            <p style={{ color: "#334155", fontSize: 11, marginTop: 5 }}>Auto-load dari data karyawan · bisa diubah manual</p>
          </div>
          <div>
            <label style={S.label}>Hari Hadir</label>
            <input type="number" min="0" max="31" placeholder="Contoh: 23" value={form.hari_hadir} onChange={e => { setForm({ ...form, hari_hadir: e.target.value }); setSlipData(null); }} style={S.input} />
            {selDriver && form.periode && (() => {
              const ab = getAbsenBulan(selDriver, form.periode);
              return ab.length > 0 ? <p style={{ color: "#f59e0b", fontSize: 12, marginTop: 6 }}>⚠ {ab.length}x absen tercatat bulan ini</p> : null;
            })()}
          </div>
          <div>
            <label style={S.label}>Potongan Pinjaman</label>
            <input type="text" inputMode="numeric" placeholder="Kosongkan jika tidak ada" value={form.potongan_pinjaman} onChange={e => { setForm({ ...form, potongan_pinjaman: e.target.value }); setSlipData(null); }} style={S.input} />
            {parseInt(String(form.potongan_pinjaman || "").replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(String(form.potongan_pinjaman).replace(/\D/g,""),10))}</p>}
          </div>
          <button onClick={generate} style={{ ...S.btnPrimary, width: "100%", padding: "14px", borderRadius: 14, fontSize: 15 }}>Generate Slip Gaji</button>
        </div>

        {slipData && (
          <div style={{ background: "#fff", borderRadius: 20, overflow: "hidden", marginTop: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
            {/* Header */}
            <div style={{ background: "#1a1a2e", padding: "24px 24px 20px", textAlign: "center" }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 36, height: 36, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14, color: "#1a1a2e" }}>GKA</div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ color: "#fff", fontWeight: 800, fontSize: 16 }}>PT Gratia Karunia Agung</p>
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
                  <p style={{ color: "#94a3b8", fontSize: 12 }}>{slipData.jabatan} · GKA Group</p>
                </div>
                <div style={{ textAlign: "right" }}>
                  <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Kehadiran</p>
                  <p style={{ color: "#0f172a", fontWeight: 800, fontSize: 24 }}>{slipData.hariHadir}</p>
                  <p style={{ color: "#94a3b8", fontSize: 12 }}>hari hadir</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "20px 24px" }}>
              <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Penerimaan</p>
              <SlipRow label="Gaji Pokok" val={fmt(slipData.gajiPokok)} />
              <SlipRow label={`Tunjangan Hadir (${slipData.hariHadir} hari × Rp70.000)`} val={fmt(slipData.tunjangan)} />

              {slipData.potongan > 0 && (
                <>
                  <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12, marginTop: 16 }}>Potongan</p>
                  <SlipRow label="Potongan Pinjaman" val={`- ${fmt(slipData.potongan)}`} color="#ef4444" />
                </>
              )}

              {slipData.absenCount > 0 && (
                <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", marginBottom: 16, marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>⚠️</span><p style={{ color: "#92400e", fontSize: 13 }}>{slipData.absenCount}x tidak hadir — sudah dikurangi dari tunjangan hadir</p>
                </div>
              )}

              <div style={{ height: 1, background: "#e2e8f0", margin: "16px 0" }} />

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0f9ff", borderRadius: 14, padding: "14px 18px" }}>
                <p style={{ color: "#0369a1", fontWeight: 700, fontSize: 15 }}>Total Diterima</p>
                <p style={{ color: "#0369a1", fontWeight: 900, fontSize: 22 }}>{fmt(slipData.total)}</p>
              </div>

              <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "center" }}>
                  <p style={{ color: "#94a3b8", fontSize: 12, marginBottom: 48 }}>Direktur</p>
                  <div style={{ width: 120, height: 1, background: "#cbd5e1", marginBottom: 4 }} />
                  <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 13 }}>Timothy Ciesha</p>
                  <p style={{ color: "#94a3b8", fontSize: 11 }}>PT Gratia Karunia Agung</p>
                </div>
              </div>
              <p style={{ color: "#cbd5e1", fontSize: 10, textAlign: "center", marginTop: 20 }}>Dicetak pada {fmtDateLong(today())} · GKA App</p>
            </div>
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
