import { useState } from "react";
import { S, fmt, fmtDate, today, monthName, Modal, Toast, InfoRow, Avatar, PageHeader } from "./shared.jsx";
import { TUNJANGAN_PER_HARI, DEFAULT_GAJI } from "./shared.jsx";

export default function TabGajian({ drivers, absens, BottomNav }) {
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({ periode: today().slice(0, 7), hari_minggu: "", tanggal_merah: "" });
  const [result, setResult] = useState(null);
  const [selDriver, setSelDriver] = useState(null);
  const [potongan, setPotongan] = useState({});

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
  };

  const totalGaji = result ? result.results.reduce((s, r) => {
    const pot = parseInt(String(potongan[r.driver] || 0).replace(/\D/g, ""), 10) || 0;
    return s + r.gajiPokok + r.tunjangan - pot;
  }, 0) : 0;

  const selResult = result?.results.find(r => r.driver === selDriver);
  const selPot = selResult ? (parseInt(String(potongan[selDriver] || 0).replace(/\D/g, ""), 10) || 0) : 0;
  const selTotal = selResult ? selResult.gajiPokok + selResult.tunjangan - selPot : 0;

  return (
    <div style={S.page}>
      <Toast toast={toast} />

      {selDriver && selResult && (
        <Modal onClose={() => setSelDriver(null)}>
          <p style={S.modalTitle}>{selDriver}</p>
          <p style={{ ...S.modalSub, marginBottom: 14 }}>{selResult.jabatan} · {monthName(result.periode)}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <InfoRow label="Gaji pokok" val={fmt(selResult.gajiPokok)} />
            <InfoRow label="Hari kerja" val={`${selResult.hariKerja} hari`} />
            <InfoRow label="Hari absen" val={selResult.absen > 0 ? `${selResult.absen} hari` : "Tidak ada"} accent={selResult.absen > 0 ? "#ef4444" : undefined} />
            <InfoRow label="Hari hadir" val={`${selResult.hadir} hari`} />
            <InfoRow label={`Tunjangan hadir (×Rp70.000)`} val={fmt(selResult.tunjangan)} />
            <div style={{ height: 1, background: "#1e293b" }} />
            <div>
              <label style={S.label}>Potongan Pinjaman</label>
              <input type="text" inputMode="numeric" placeholder="0 jika tidak ada"
                value={potongan[selDriver] || ""}
                onChange={e => setPotongan(prev => ({ ...prev, [selDriver]: e.target.value }))}
                style={{ ...S.input, fontSize: 14 }} />
              {selPot > 0 && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>- {fmt(selPot)}</p>}
            </div>
            <div style={{ height: 1, background: "#1e293b" }} />
            <InfoRow label="Total diterima" val={fmt(selTotal)} bold />
          </div>
          <button onClick={() => setSelDriver(null)} style={{ ...S.btnPrimary, width: "100%" }}>Tutup</button>
        </Modal>
      )}

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
              <p style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800 }}>{fmt(totalGaji)}</p>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Tap karyawan untuk input potongan pinjaman</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.results.map(r => {
                const pot = parseInt(String(potongan[r.driver] || 0).replace(/\D/g, ""), 10) || 0;
                const total = r.gajiPokok + r.tunjangan - pot;
                return (
                  <button key={r.driver} onClick={() => setSelDriver(r.driver)} style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <Avatar name={r.driver} />
                        <div>
                          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{r.driver}</p>
                          <p style={{ color: "#475569", fontSize: 12 }}>{r.jabatan} · Hadir {r.hadir}/{r.hariKerja} hari{r.absen > 0 ? ` · ${r.absen}x absen` : ""}</p>
                        </div>
                      </div>
                      <span style={{ color: "#60a5fa", fontSize: 16 }}>›</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#475569" }}>Tunjangan {fmt(r.tunjangan)}{pot > 0 ? ` · Potong ${fmt(pot)}` : ""}</span>
                      <span style={{ color: "#34d399", fontWeight: 800 }}>{fmt(total)}</span>
                    </div>
                  </button>
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
