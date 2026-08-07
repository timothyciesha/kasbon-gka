import { useState } from "react";
import { S, fmt, fmtDate, fmtDateLong, today, monthName, Modal, Toast, InfoRow, Avatar, PageHeader } from "./shared.jsx";
import { TUNJANGAN_PER_HARI, DEFAULT_GAJI } from "./shared.jsx";

function SlipRow({ label, val, color }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
      <span style={{ color: "#64748b", fontSize: 13, flex: 1 }}>{label}</span>
      <span style={{ color: color || "#0f172a", fontWeight: 700, fontSize: 14 }}>{val}</span>
    </div>
  );
}

// Slip gaji cetak — dirender inline di bawah row karyawan saat expanded
function SlipPrint({ r, periode }) {
  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", marginTop: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.35)" }}>
      <div style={{ background: "#1a1a2e", padding: "20px 20px 16px", textAlign: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 32, height: 32, background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, color: "#1a1a2e" }}>GKA</div>
          <div style={{ textAlign: "left" }}>
            <p style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>PT Gratia Karunia Agung</p>
            <p style={{ color: "#64748b", fontSize: 10 }}>GKA Group · Tangerang</p>
          </div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 10, padding: "6px 14px", display: "inline-block" }}>
          <p style={{ color: "#94a3b8", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>Slip Gaji — {monthName(periode)}</p>
        </div>
      </div>

      <div style={{ background: "#f8fafc", padding: "14px 20px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Nama Karyawan</p>
            <p style={{ color: "#0f172a", fontWeight: 800, fontSize: 16 }}>{r.driver}</p>
            <p style={{ color: "#94a3b8", fontSize: 11 }}>{r.jabatan} · GKA Group</p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 2 }}>Kehadiran</p>
            <p style={{ color: "#0f172a", fontWeight: 800, fontSize: 22 }}>{r.hadir}</p>
            <p style={{ color: "#94a3b8", fontSize: 11 }}>/ {r.hariKerja} hari</p>
          </div>
        </div>
      </div>

      <div style={{ padding: "18px 20px" }}>
        <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Penerimaan</p>
        <SlipRow label="Gaji Pokok" val={fmt(r.gajiPokok)} />
        <SlipRow label={`Tunjangan Hadir (${r.hadir} hari × Rp70.000)`} val={fmt(r.tunjangan)} />

        {r.potongan > 0 && (
          <>
            <p style={{ color: "#64748b", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, marginTop: 14 }}>Potongan</p>
            <SlipRow label="Potongan Pinjaman" val={`- ${fmt(r.potongan)}`} color="#ef4444" />
          </>
        )}

        {r.absen > 0 && (
          <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "8px 12px", marginBottom: 14, marginTop: 6, display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13 }}>⚠️</span>
            <p style={{ color: "#92400e", fontSize: 12 }}>{r.absen}x tidak hadir — sudah dikurangi dari tunjangan hadir</p>
          </div>
        )}

        <div style={{ height: 1, background: "#e2e8f0", margin: "12px 0" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f0f9ff", borderRadius: 12, padding: "12px 16px" }}>
          <p style={{ color: "#0369a1", fontWeight: 700, fontSize: 14 }}>Total Diterima</p>
          <p style={{ color: "#0369a1", fontWeight: 900, fontSize: 20 }}>{fmt(r.total)}</p>
        </div>

        <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "#94a3b8", fontSize: 11, marginBottom: 40 }}>Direktur</p>
            <div style={{ width: 100, height: 1, background: "#cbd5e1", marginBottom: 4 }} />
            <p style={{ color: "#0f172a", fontWeight: 700, fontSize: 12 }}>Timothy Ciesha</p>
            <p style={{ color: "#94a3b8", fontSize: 10 }}>PT Gratia Karunia Agung</p>
          </div>
        </div>
        <p style={{ color: "#cbd5e1", fontSize: 9, textAlign: "center", marginTop: 16 }}>Dicetak pada {fmtDateLong(today())} · GKA App</p>
      </div>
    </div>
  );
}

export default function TabGajian({ drivers, absens, BottomNav }) {
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ periode: today().slice(0, 7), hari_minggu: "", tanggal_merah: "" });
  const [result, setResult] = useState(null);
  const [potongan, setPotongan] = useState({});
  const [openSlips, setOpenSlips] = useState({}); // { [driverName]: true }

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const getAbsenBulan = (name, periode) => absens.filter(a => a.driver_name === name && a.tanggal.startsWith(periode));

  const hitung = () => {
    if (!form.periode) return showToast("Pilih periode dulu", "err");
    const [y, m] = form.periode.split("-").map(Number);
    const totalHari = new Date(y, m, 0).getDate();
    const minggu = parseInt(form.hari_minggu, 10) || 0;
    const merah = parseInt(form.tanggal_merah, 10) || 0;
    const hariKerja = totalHari - minggu - merah;
    if (hariKerja <= 0) return showToast("Hari kerja tidak valid", "err");

    const results = drivers.map(d => {
      const absen = getAbsenBulan(d.name, form.periode).length;
      const hadir = Math.max(0, hariKerja - absen);
      const gajiPokok = d.gaji_pokok || DEFAULT_GAJI;
      const tunjangan = hadir * TUNJANGAN_PER_HARI;
      return { driver: d.name, jabatan: d.jabatan || "Sopir", gajiPokok, hariKerja, absen, hadir, tunjangan };
    });

    setResult({ periode: form.periode, totalHari, minggu, merah, hariKerja, results });
    setPotongan({});
    setOpenSlips({});
  };

  const potonganVal = (name) => parseInt(String(potongan[name] || 0).replace(/\D/g, ""), 10) || 0;
  const totalDriver = (r) => r.gajiPokok + r.tunjangan - potonganVal(r.driver);

  const totalGaji = result ? result.results.reduce((s, r) => s + totalDriver(r), 0) : 0;

  const toggleSlip = (name) => setOpenSlips(prev => ({ ...prev, [name]: !prev[name] }));
  const allOpen = result ? result.results.every(r => openSlips[r.driver]) : false;
  const toggleAllSlips = () => {
    if (!result) return;
    if (allOpen) { setOpenSlips({}); return; }
    const next = {};
    result.results.forEach(r => { next[r.driver] = true; });
    setOpenSlips(next);
  };

  return (
    <div style={S.page}>
      <Toast toast={toast} />

      <div style={S.container}>
        <PageHeader title="Gajian" />

        <div style={{ ...S.card, display: "flex", flexDirection: "column", gap: 14 }}>
          <div><label style={S.label}>Periode</label><input type="month" value={form.periode} onChange={e => { setForm({ ...form, periode: e.target.value }); setResult(null); }} style={S.input} /></div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><label style={S.label}>Jumlah Minggu</label><input type="number" min="0" max="5" placeholder="Contoh: 4" value={form.hari_minggu} onChange={e => { setForm({ ...form, hari_minggu: e.target.value }); setResult(null); }} style={S.input} /></div>
            <div style={{ flex: 1 }}><label style={S.label}>Tanggal Merah</label><input type="number" min="0" max="10" placeholder="Contoh: 2" value={form.tanggal_merah} onChange={e => { setForm({ ...form, tanggal_merah: e.target.value }); setResult(null); }} style={S.input} /></div>
          </div>
          {form.hari_minggu !== "" && (() => {
            const [y, m] = form.periode.split("-").map(Number);
            const total = new Date(y, m, 0).getDate();
            const kerja = total - (parseInt(form.hari_minggu,10)||0) - (parseInt(form.tanggal_merah,10)||0);
            return <p style={{ color: "#64748b", fontSize: 13 }}>Total: {total} hari · Libur: {total - kerja} · <strong style={{ color: "#34d399" }}>Hari kerja: {kerja}</strong></p>;
          })()}
          <button onClick={hitung} style={{ ...S.btnPrimary, width: "100%", padding: "14px", borderRadius: 14, fontSize: 15 }}>Hitung Gaji Semua Karyawan</button>
        </div>

        {result && (
          <>
            <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155", borderRadius: 20, padding: 18, marginBottom: 12 }}>
              <p style={S.eyebrow}>{monthName(result.periode)} · {result.hariKerja} hari kerja</p>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Total pengeluaran gaji</p>
              <p style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800, marginBottom: 12 }}>{fmt(totalGaji)}</p>
              <button onClick={toggleAllSlips} style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 10, padding: "8px 14px", color: "#60a5fa", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {allOpen ? "Tutup Semua Slip" : "🧾 Buka Semua Slip"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.results.map(r => {
                const pot = potonganVal(r.driver);
                const total = totalDriver(r);
                const open = !!openSlips[r.driver];
                return (
                  <div key={r.driver} style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16 }}>
                    <button onClick={() => toggleSlip(r.driver)} style={{ background: "transparent", border: "none", padding: 0, width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <Avatar name={r.driver} />
                          <div>
                            <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{r.driver}</p>
                            <p style={{ color: "#475569", fontSize: 12 }}>{r.jabatan} · Hadir {r.hadir}/{r.hariKerja} hari{r.absen > 0 ? ` · ${r.absen}x absen` : ""}</p>
                          </div>
                        </div>
                        <span style={{ color: "#334155", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                        <span style={{ color: "#475569" }}>Tunjangan {fmt(r.tunjangan)}{pot > 0 ? ` · Potong ${fmt(pot)}` : ""}</span>
                        <span style={{ color: "#34d399", fontWeight: 800 }}>{fmt(total)}</span>
                      </div>
                    </button>

                    {open && (
                      <div onClick={e => e.stopPropagation()}>
                        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #1e293b" }}>
                          <label style={S.label}>Potongan Pinjaman</label>
                          <input type="text" inputMode="numeric" placeholder="0 jika tidak ada"
                            value={potongan[r.driver] || ""}
                            onChange={e => setPotongan(prev => ({ ...prev, [r.driver]: e.target.value }))}
                            style={{ ...S.input, fontSize: 14 }} />
                          {pot > 0 && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>- {fmt(pot)}</p>}
                        </div>
                        <SlipPrint r={{ ...r, potongan: pot, total }} periode={result.periode} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
