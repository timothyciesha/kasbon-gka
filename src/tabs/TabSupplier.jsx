import { useState } from "react";
import { db } from "../lib/db";
import { fmt, fmtDate, today, daysUntil } from "../lib/utils";
import { pageStyle, containerStyle, cardStyle, eyebrowStyle, labelStyle, inputStyle, btnPrimary, btnSecondary, backBtn, rowStyle, modalTitle, modalSub, GKAHeader, Modal, Toast, TagihanCard } from "../components/UI";

export default function TabSupplier({ suppliers, setSuppliers, tagihans, setTagihans, supplierBayar, setSupplierBayar, toast, showToast }) {
  const [view, setView] = useState("list"); // list | detail
  const [selSupplier, setSelSupplier] = useState(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [showTagihanForm, setShowTagihanForm] = useState(false);
  const [tagihanForm, setTagihanForm] = useState({ keterangan: "", nominal: "", jatuh_tempo: today() });
  const [showBayarForm, setShowBayarForm] = useState(false);
  const [bayarForm, setBayarForm] = useState({ nominal: "", tanggal: today() });
  const [selTagihan, setSelTagihan] = useState(null);

  // helpers
  const getTagihans = (supId) => tagihans.filter(t => t.supplier_id === supId);
  const getBayaran = (tagihanId) => supplierBayar.filter(b => b.tagihan_id === tagihanId);
  const getSisaTagihan = (t) => Math.max(0, t.nominal - getBayaran(t.id).reduce((s, b) => s + b.nominal, 0));

  const getTagihanStatus = (t) => {
    if (t.is_lunas) return "lunas";
    const h = daysUntil(t.jatuh_tempo);
    if (h < 0) return "overdue";
    if (h <= 3) return "warning";
    return "aktif";
  };

  const statusStyle = (s) => ({
    lunas:   { color: "#34d399", bg: "rgba(52,211,153,0.1)",   border: "rgba(52,211,153,0.2)"   },
    aktif:   { color: "#94a3b8", bg: "rgba(148,163,184,0.1)",  border: "rgba(148,163,184,0.2)"  },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.2)"   },
    overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.1)",    border: "rgba(239,68,68,0.2)"    },
  }[s] || { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" });

  const statusLabel = (t) => {
    const s = getTagihanStatus(t);
    const h = daysUntil(t.jatuh_tempo);
    if (s === "lunas") return "Lunas";
    if (s === "overdue") return `Overdue ${Math.abs(h)}h`;
    if (s === "warning") return `H-${h} jatuh tempo`;
    return "Aktif";
  };

  // actions
  const addSupplier = async () => {
    const name = newSupplierName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (suppliers.find(s => s.name === name)) return showToast("Supplier sudah ada", "err");
    try {
      const [created] = await db.post("suppliers", { name });
      setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewSupplierName(""); setShowAddSupplier(false);
      showToast(`${name} ditambahkan`);
    } catch { showToast("Gagal tambah supplier", "err"); }
  };

  const addTagihan = async () => {
    const nominal = parseInt(tagihanForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    if (!tagihanForm.jatuh_tempo) return showToast("Isi tanggal jatuh tempo", "err");
    try {
      const [created] = await db.post("supplier_tagihan", {
        supplier_id: selSupplier.id,
        keterangan: tagihanForm.keterangan || null,
        nominal, jatuh_tempo: tagihanForm.jatuh_tempo,
      });
      setTagihans(prev => [created, ...prev]);
      setTagihanForm({ keterangan: "", nominal: "", jatuh_tempo: today() }); setShowTagihanForm(false);
      showToast("Tagihan dicatat");
    } catch { showToast("Gagal simpan tagihan", "err"); }
  };

  const addBayar = async () => {
    const nominal = parseInt(bayarForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    const sisa = getSisaTagihan(selTagihan);
    if (nominal > sisa) return showToast(`Melebihi sisa ${fmt(sisa)}`, "err");
    try {
      const [created] = await db.post("supplier_bayar", { tagihan_id: selTagihan.id, nominal, tanggal: bayarForm.tanggal });
      const newBayaran = [...getBayaran(selTagihan.id), created];
      const lunas = newBayaran.reduce((s, b) => s + b.nominal, 0) >= selTagihan.nominal;
      setSupplierBayar(prev => [...prev, created]);
      if (lunas) {
        await db.patch("supplier_tagihan", selTagihan.id, { is_lunas: true });
        setTagihans(prev => prev.map(t => t.id === selTagihan.id ? { ...t, is_lunas: true } : t));
        showToast("Tagihan lunas! 🎉");
      } else { showToast("Pembayaran dicatat"); }
      setSelTagihan(null); setShowBayarForm(false); setBayarForm({ nominal: "", tanggal: today() });
    } catch { showToast("Gagal simpan pembayaran", "err"); }
  };

  const totalBelumLunas = tagihans.filter(t => !t.is_lunas).reduce((s, t) => s + getSisaTagihan(t), 0);
  const totalOverdue = tagihans.filter(t => getTagihanStatus(t) === "overdue").length;
  const totalWarning = tagihans.filter(t => getTagihanStatus(t) === "warning").length;

  // ── DETAIL ──
  if (view === "detail" && selSupplier) {
    const supTagihans = getTagihans(selSupplier.id);
    const aktif = supTagihans.filter(t => !t.is_lunas);
    const lunas = supTagihans.filter(t => t.is_lunas);

    return (
      <div style={pageStyle}>
        <Toast toast={toast} />

        {showTagihanForm && (
          <Modal onClose={() => setShowTagihanForm(false)}>
            <p style={modalTitle}>Tagihan Baru</p>
            <p style={modalSub}>{selSupplier.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Keterangan (opsional)</label>
                <input type="text" placeholder="Contoh: Pembelian ban April" value={tagihanForm.keterangan} onChange={e => setTagihanForm({ ...tagihanForm, keterangan: e.target.value })} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nominal</label>
                <input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 5000000" value={tagihanForm.nominal} onChange={e => setTagihanForm({ ...tagihanForm, nominal: e.target.value })} style={inputStyle} />
                {parseInt(tagihanForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(tagihanForm.nominal.replace(/\D/g,""),10))}</p>}
              </div>
              <div>
                <label style={labelStyle}>Jatuh Tempo</label>
                <input type="date" value={tagihanForm.jatuh_tempo} onChange={e => setTagihanForm({ ...tagihanForm, jatuh_tempo: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={rowStyle}>
              <button onClick={() => setShowTagihanForm(false)} style={btnSecondary}>Batal</button>
              <button onClick={addTagihan} style={btnPrimary}>Simpan</button>
            </div>
          </Modal>
        )}

        {showBayarForm && selTagihan && (
          <Modal onClose={() => { setShowBayarForm(false); setBayarForm({ nominal: "", tanggal: today() }); }}>
            <p style={modalTitle}>Catat Pembayaran</p>
            <p style={modalSub}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(getSisaTagihan(selTagihan))}</strong></p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={labelStyle}>Nominal Bayar</label>
                <input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 2000000" value={bayarForm.nominal} onChange={e => setBayarForm({ ...bayarForm, nominal: e.target.value })} style={inputStyle} />
                {parseInt(bayarForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(bayarForm.nominal.replace(/\D/g,""),10))}</p>}
              </div>
              <div>
                <label style={labelStyle}>Tanggal Bayar</label>
                <input type="date" value={bayarForm.tanggal} onChange={e => setBayarForm({ ...bayarForm, tanggal: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={rowStyle}>
              <button onClick={() => { setShowBayarForm(false); setBayarForm({ nominal: "", tanggal: today() }); }} style={btnSecondary}>Batal</button>
              <button onClick={addBayar} style={btnPrimary}>Simpan</button>
            </div>
          </Modal>
        )}

        <div style={containerStyle}>
          <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setView("list"); setSelSupplier(null); }} style={backBtn}>←</button>
              <div>
                <h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22 }}>{selSupplier.name}</h2>
                <p style={{ color: "#475569", fontSize: 12 }}>{aktif.length} tagihan aktif</p>
              </div>
            </div>
            <button onClick={() => setShowTagihanForm(true)} style={{ ...btnPrimary, flex: "none", padding: "8px 14px", borderRadius: 12, fontSize: 13 }}>+ Tagihan</button>
          </div>

          {aktif.length === 0 && (
            <div style={{ textAlign: "center", padding: "32px 0", color: "#334155" }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>✅</p>
              <p style={{ fontSize: 14, fontWeight: 600 }}>Semua tagihan lunas</p>
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {aktif.map(t => (
              <TagihanCard
                key={t.id}
                t={t}
                sisa={getSisaTagihan(t)}
                bayaran={getBayaran(t.id)}
                statusStyle={statusStyle}
                statusLabel={statusLabel}
                onBayar={(t) => { setSelTagihan(t); setShowBayarForm(true); }}
              />
            ))}
          </div>

          {lunas.length > 0 && (
            <div style={{ ...cardStyle, padding: 0, overflow: "hidden" }}>
              <p style={{ ...eyebrowStyle, padding: "14px 16px 10px" }}>Lunas ({lunas.length})</p>
              {lunas.map((t, i) => (
                <div key={t.id} style={{ padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <p style={{ color: "#475569", fontSize: 13 }}>{t.keterangan || "Tagihan"}</p>
                    <p style={{ color: "#334155", fontSize: 11 }}>JT: {fmtDate(t.jatuh_tempo)}</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>{fmt(t.nominal)}</p>
                    <p style={{ color: "#334155", fontSize: 11 }}>✓ Lunas</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── LIST ──
  return (
    <div style={pageStyle}>
      <Toast toast={toast} />
      {showAddSupplier && (
        <Modal onClose={() => { setShowAddSupplier(false); setNewSupplierName(""); }}>
          <p style={modalTitle}>Tambah Supplier</p>
          <p style={modalSub}>Nama supplier baru</p>
          <input autoFocus type="text" placeholder="Nama supplier" value={newSupplierName} onChange={e => setNewSupplierName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSupplier()} style={inputStyle} />
          <div style={rowStyle}>
            <button onClick={() => { setShowAddSupplier(false); setNewSupplierName(""); }} style={btnSecondary}>Batal</button>
            <button onClick={addSupplier} style={btnPrimary}>Tambah</button>
          </div>
        </Modal>
      )}

      <div style={containerStyle}>
        <GKAHeader title="Supplier" action={
          <button onClick={() => setShowAddSupplier(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            <span>+</span> Supplier
          </button>
        } />

        {totalBelumLunas > 0 && (
          <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155", borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <p style={eyebrowStyle}>Total Hutang</p>
            <p style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800 }}>{fmt(totalBelumLunas)}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {totalOverdue > 0 && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>⚠ {totalOverdue} overdue</span>}
              {totalWarning > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>⏰ {totalWarning} jatuh tempo</span>}
            </div>
          </div>
        )}

        {suppliers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada supplier</p>
            <p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Supplier" untuk menambahkan</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suppliers.map(sup => {
              const supTagihans = getTagihans(sup.id);
              const aktif = supTagihans.filter(t => !t.is_lunas);
              const totalSisa = aktif.reduce((s, t) => s + getSisaTagihan(t), 0);
              const hasOverdue = aktif.some(t => getTagihanStatus(t) === "overdue");
              const hasWarning = aktif.some(t => getTagihanStatus(t) === "warning");
              return (
                <button key={sup.id} onClick={() => { setSelSupplier(sup); setView("detail"); }}
                  style={{ background: "#161b27", border: `1px solid ${hasOverdue ? "rgba(239,68,68,0.3)" : hasWarning ? "rgba(245,158,11,0.3)" : "#1e293b"}`, borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontWeight: 800, fontSize: 15 }}>{sup.name[0].toUpperCase()}</div>
                      <div>
                        <p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{sup.name}</p>
                        <p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{aktif.length > 0 ? `${aktif.length} tagihan aktif` : "Semua lunas"}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {totalSisa > 0 ? (
                        <>
                          <p style={{ color: hasOverdue ? "#ef4444" : hasWarning ? "#f59e0b" : "#f1f5f9", fontWeight: 800, fontSize: 14 }}>{fmt(totalSisa)}</p>
                          {hasOverdue && <p style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>OVERDUE</p>}
                          {!hasOverdue && hasWarning && <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>HAMPIR JT</p>}
                        </>
                      ) : <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✓ Lunas</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
