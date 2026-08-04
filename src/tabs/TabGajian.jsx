import { useState } from "react";
import { fmt, today, monthName, TUNJANGAN_PER_HARI, DEFAULT_GAJI } from "../lib/utils";
import { pageStyle, containerStyle, cardStyle, eyebrowStyle, labelStyle, inputStyle, btnPrimary, rowStyle, modalTitle, modalSub, GKAHeader, Modal, Toast, InfoRow } from "../components/UI";

export default function TabGajian({ drivers, absens, toast, showToast }) {
  const [form, setForm] = useState({ periode: today().slice(0, 7), hari_minggu: "", tanggal_merah: "" });
  const [result, setResult] = useState(null);
  const [potongan, setPotongan] = useState({});
  const [detailSel, setDetailSel] = useState(null);

  const getAbsenBulan = (name, bulan) => absens.filter(a => a.driver_name === name && a.tanggal.startsWith(bulan));

  const hitung = () => {
    if (!form.periode) return showToast("Pilih periode dulu", "err");
    const [year, month] = form.periode.split("-").map(Number);
    const totalHari = new Date(year, month, 0).getDate();
    const hariMinggu = parseInt(form.hari_minggu, 10) || 0;
    const tanggalMerah = parseInt(form.tanggal_merah, 10) || 0;
    const hariKerja = totalHari - hariMinggu - tanggalMerah;
    if (hariKerja <= 0) return showToast("Hari kerja tidak valid", "err");
    const results = drivers.map(d => {
      const absenBulan = getAbsenBulan(d.name, form.periode);
      const hariAbsen = absenBulan.length;
      const hariHadir = Math.max(0, hariKerja - hariAbsen);
      const gajiPokok = d.gaji_pokok || DEFAULT_GAJI;
      const tunjanganHadir = hariHadir * TUNJANGAN_PER_HARI;
      return { driver: d.name, jabatan: d.jabatan || "Sopir", gajiPokok, hariKerja, hariAbsen, hariHadir, tunjanganHadir };
    });
    setResult({ periode: form.periode, totalHari, hariMinggu, tanggalMerah, hariKerja, results });
    setPotongan({});
  };

  const getTotal = (r) => {
    const pot = parseInt(String(potongan[r.driver] || "0").replace(/\D/g, ""), 10) || 0;
    return r.gajiPokok + r.tunjanganHadir - pot;
  };

  const totalSemua = result ? result.results.reduce((s, r) => s + getTotal(r), 0) : 0;
  const selResult = detailSel && result ? result.results.find(r => r.driver === detailSel) : null;
  const selPot = selResult ? (parseInt(String(potongan[selResult.driver] || "0").replace(/\D/g, ""), 10) || 0) : 0;

  return (
    <div style={pageStyle}>
      <Toast toast={toast} />

      {selResult && (
        <Modal onClose={() => setDetailSel(null)}>
          <p style={modalTitle}>{selResult.driver}</p>
          <p style={{ ...modalSub, marginBottom: 14 }}>{selResult.jabatan} · {monthName(result.periode)}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
            <InfoRow label="Gaji pokok" val={fmt(selResult.gajiPokok)} />
            <InfoRow label="Hari kerja" val={`${selResult.hariKerja} hari`} />
            <InfoRow label="Hari absen" val={selResult.hariAbsen > 0 ? `${selResult.hariAbsen} hari` : "Tidak ada"} accent={selResult.hariAbsen > 0 ? "#ef4444" : undefined} />
            <InfoRow label="Hari hadir" val={`${selResult.hariHadir} hari`} />
            <InfoRow label={`Tunjangan hadir (×Rp70.000)`} val={fmt(selResult.tunjanganHadir)} />
            <div style={{ height: 1, background: "#1e293b" }} />
            <div>
              <label style={labelStyle}>Potongan Pinjaman</label>
              <input type="text" inputMode="numeric" placeholder="0 jika tidak ada"
                value={potongan[selResult.driver] || ""}
                onChange={e => setPotongan(prev => ({ ...prev, [selResult.driver]: e.target.value }))}
                style={{ ...inputStyle, fontSize: 14 }} />
              {selPot > 0 && <p style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>- {fmt(selPot)}</p>}
            </div>
            <div style={{ height: 1, background: "#1e293b" }} />
            <InfoRow label="Total diterima" val={fmt(getTotal(selResult))} bold />
          </div>
          <button onClick={() => setDetailSel(null)} style={{ ...btnPrimary, width: "100%", justifyContent: "center" }}>Tutup</button>
        </Modal>
      )}

      <div style={containerStyle}>
        <GKAHeader title="Gajian" />

        <div style={{ ...cardStyle, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={labelStyle}>Periode</label>
            <input type="month" value={form.periode} onChange={e => { setForm({ ...form, periode: e.target.value }); setResult(null); setPotongan({}); }} style={inputStyle} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Jumlah Minggu</label>
              <input type="number" min="0" max="5" placeholder="Contoh: 4" value={form.hari_minggu} onChange={e => { setForm({ ...form, hari_minggu: e.target.value }); setResult(null); }} style={inputStyle} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Tanggal Merah</label>
              <input type="number" min="0" max="10" placeholder="Contoh: 2" value={form.tanggal_merah} onChange={e => { setForm({ ...form, tanggal_merah: e.target.value }); setResult(null); }} style={inputStyle} />
            </div>
          </div>
          {form.hari_minggu !== "" && (() => {
            const [y, m] = form.periode.split("-").map(Number);
            const total = new Date(y, m, 0).getDate();
            const minggu = parseInt(form.hari_minggu, 10) || 0;
            const merah = parseInt(form.tanggal_merah, 10) || 0;
            return <p style={{ color: "#64748b", fontSize: 13 }}>Total: {total} hari · Libur: {minggu + merah} · <strong style={{ color: "#34d399" }}>Kerja: {total - minggu - merah} hari</strong></p>;
          })()}
          <button onClick={hitung} style={{ ...btnPrimary, width: "100%", justifyContent: "center", padding: "14px", borderRadius: 14, fontSize: 15 }}>
            Hitung Gaji Semua Karyawan
          </button>
        </div>

        {result && (
          <>
            <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155", borderRadius: 20, padding: 18, marginBottom: 12 }}>
              <p style={eyebrowStyle}>{monthName(result.periode)} · {result.hariKerja} hari kerja</p>
              <p style={{ color: "#64748b", fontSize: 12, marginBottom: 4 }}>Total pengeluaran gaji</p>
              <p style={{ color: "#f1f5f9", fontSize: 26, fontWeight: 800 }}>{fmt(totalSemua)}</p>
              <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>Tap karyawan untuk input potongan pinjaman</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {result.results.map(r => {
                const pot = parseInt(String(potongan[r.driver] || "0").replace(/\D/g, ""), 10) || 0;
                return (
                  <button key={r.driver} onClick={() => setDetailSel(r.driver)}
                    style={{ background: "#161b27", border: "1px solid #1e293b", borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: 15 }}>{r.driver[0].toUpperCase()}</div>
                        <div>
                          <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{r.driver}</p>
                          <p style={{ color: "#475569", fontSize: 12 }}>{r.jabatan} · Hadir {r.hariHadir}/{r.hariKerja}{r.hariAbsen > 0 ? ` · ${r.hariAbsen}x absen` : ""}</p>
                        </div>
                      </div>
                      <span style={{ color: "#60a5fa", fontSize: 14 }}>›</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
                      <span style={{ color: "#475569" }}>Tunjangan {fmt(r.tunjanganHadir)}{pot > 0 ? ` · Potong ${fmt(pot)}` : ""}</span>
                      <span style={{ color: "#34d399", fontWeight: 800 }}>{fmt(getTotal(r))}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
