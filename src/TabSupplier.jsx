import { useState } from "react";
import { db } from "./db.js";
import { S, fmt, fmtDate, today, Modal, Toast, InfoRow, Avatar, ProgressBar, PageHeader } from "./shared.jsx";

function TagihanCard({ t, sisa, bayaran, onBayar }) {
  const [open, setOpen] = useState(false);
  const progress = Math.round(((t.nominal - sisa) / t.nominal) * 100);
  const hari = Math.ceil((new Date(t.jatuh_tempo).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
  const status = t.is_lunas ? "lunas" : hari < 0 ? "overdue" : hari <= 3 ? "warning" : "aktif";
  const sc = { lunas: { color:"#34d399",bg:"rgba(52,211,153,0.1)",border:"rgba(52,211,153,0.2)",label:"Lunas" }, aktif: { color:"#94a3b8",bg:"rgba(148,163,184,0.1)",border:"rgba(148,163,184,0.2)",label:"Aktif" }, warning: { color:"#f59e0b",bg:"rgba(245,158,11,0.1)",border:"rgba(245,158,11,0.2)",label:`H-${hari} JT` }, overdue: { color:"#ef4444",bg:"rgba(239,68,68,0.1)",border:"rgba(239,68,68,0.2)",label:`Overdue ${Math.abs(hari)}h` } }[status];
  return (
    <div style={{ background: "#161b27", border: `1px solid ${status === "overdue" ? "rgba(239,68,68,0.3)" : status === "warning" ? "rgba(245,158,11,0.3)" : "#1e293b"}`, borderRadius: 18, padding: 16, marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{t.keterangan || "Tagihan"}</p><p style={{ color: "#475569", fontSize: 12, marginTop: 2 }}>JT: {fmtDate(t.jatuh_tempo)}</p></div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 10px", borderRadius: 20, border: `1px solid ${sc.border}`, color: sc.color, background: sc.bg }}>{sc.label}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 8 }}>
        <span style={{ color: "#475569" }}>Terbayar {fmt(t.nominal - sisa)}</span>
        <span style={{ color: "#f59e0b", fontWeight: 700 }}>Sisa {fmt(sisa)}</span>
      </div>
      <ProgressBar progress={progress} color="linear-gradient(90deg, #3b82f6, #60a5fa)" />
      {bayaran.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setOpen(!open)} style={{ background: "transparent", border: "none", color: "#475569", fontSize: 12, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>{open ? "▲" : "▼"} {bayaran.length} pembayaran</button>
          {open && <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
            {bayaran.map(b => <div key={b.id} style={{ display: "flex", justifyContent: "space-between", background: "#0f1117", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}><span style={{ color: "#475569" }}>{fmtDate(b.tanggal)}</span><span style={{ color: "#94a3b8", fontWeight: 700 }}>{fmt(b.nominal)}</span></div>)}
          </div>}
        </div>
      )}
      <button onClick={() => onBayar(t)} style={{ ...S.btnPrimary, width: "100%", marginTop: 12, padding: "10px", borderRadius: 12, fontSize: 13 }}>+ Catat Pembayaran</button>
    </div>
  );
}

export default function TabSupplier({ suppliers, setSuppliers, tagihans, setTagihans, supplierBayar, setSupplierBayar, BottomNav }) {
  const [toast, setToast] = useState(null);
  const [view, setView] = useState("list"); // list | detail
  const [selSupplier, setSelSupplier] = useState(null);
  const [selTagihan, setSelTagihan] = useState(null);
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [newName, setNewName] = useState("");
  const [showTagihanForm, setShowTagihanForm] = useState(false);
  const [tagihanForm, setTagihanForm] = useState({ keterangan: "", nominal: "", jatuh_tempo: today() });
  const [showBayarForm, setShowBayarForm] = useState(false);
  const [bayarForm, setBayarForm] = useState({ nominal: "", tanggal: today() });

  const showToast = (msg, type = "ok") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const getTagihans = (supId) => tagihans.filter(t => t.supplier_id === supId);
  const getBayaran = (tagId) => supplierBayar.filter(b => b.tagihan_id === tagId);
  const getSisa = (t) => Math.max(0, t.nominal - getBayaran(t.id).reduce((s, b) => s + b.nominal, 0));
  const getStatus = (t) => {
    if (t.is_lunas) return "lunas";
    const h = Math.ceil((new Date(t.jatuh_tempo).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000*60*60*24));
    return h < 0 ? "overdue" : h <= 3 ? "warning" : "aktif";
  };

  const addSupplier = async () => {
    const name = newName.trim();
    if (!name) return showToast("Nama tidak boleh kosong", "err");
    if (suppliers.find(s => s.name === name)) return showToast("Sudah ada", "err");
    try {
      const [created] = await db.post("suppliers", { name });
      setSuppliers(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName(""); setShowAddSupplier(false); showToast(`${name} ditambahkan`);
    } catch { showToast("Gagal", "err"); }
  };

  const addTagihan = async () => {
    const nominal = parseInt(tagihanForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    try {
      const [created] = await db.post("supplier_tagihan", { supplier_id: selSupplier.id, keterangan: tagihanForm.keterangan || null, nominal, jatuh_tempo: tagihanForm.jatuh_tempo });
      setTagihans(prev => [created, ...prev]);
      setTagihanForm({ keterangan: "", nominal: "", jatuh_tempo: today() }); setShowTagihanForm(false);
      showToast("Tagihan dicatat");
    } catch { showToast("Gagal", "err"); }
  };

  const addBayar = async () => {
    const nominal = parseInt(bayarForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal) return showToast("Nominal tidak valid", "err");
    const sisa = getSisa(selTagihan);
    if (nominal > sisa) return showToast(`Melebihi sisa ${fmt(sisa)}`, "err");
    try {
      const [created] = await db.post("supplier_bayar", { tagihan_id: selTagihan.id, nominal, tanggal: bayarForm.tanggal });
      const allBayar = [...getBayaran(selTagihan.id), created];
      const lunas = allBayar.reduce((s, b) => s + b.nominal, 0) >= selTagihan.nominal;
      setSupplierBayar(prev => [...prev, created]);
      if (lunas) {
        await db.patch("supplier_tagihan", selTagihan.id, { is_lunas: true });
        setTagihans(prev => prev.map(t => t.id === selTagihan.id ? { ...t, is_lunas: true } : t));
        showToast("Tagihan lunas! 🎉");
      } else { showToast("Pembayaran dicatat"); }
      setBayarForm({ nominal: "", tanggal: today() }); setShowBayarForm(false); setSelTagihan(null);
    } catch { showToast("Gagal", "err"); }
  };

  // ── DETAIL ────────────────────────────────────────────
  if (view === "detail" && selSupplier) {
    const supTagihans = getTagihans(selSupplier.id);
    const aktif = supTagihans.filter(t => !t.is_lunas);
    const lunas = supTagihans.filter(t => t.is_lunas);

    return (
      <div style={S.page}>
        <Toast toast={toast} />
        {showTagihanForm && (
          <Modal onClose={() => setShowTagihanForm(false)}>
            <p style={S.modalTitle}>Tagihan Baru</p><p style={S.modalSub}>{selSupplier.name}</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Keterangan (opsional)</label><input type="text" placeholder="Contoh: Pembelian ban April" value={tagihanForm.keterangan} onChange={e => setTagihanForm({ ...tagihanForm, keterangan: e.target.value })} style={S.input} /></div>
              <div><label style={S.label}>Nominal</label><input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 5000000" value={tagihanForm.nominal} onChange={e => setTagihanForm({ ...tagihanForm, nominal: e.target.value })} style={S.input} />{parseInt(tagihanForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(tagihanForm.nominal.replace(/\D/g,""),10))}</p>}</div>
              <div><label style={S.label}>Jatuh Tempo</label><input type="date" value={tagihanForm.jatuh_tempo} onChange={e => setTagihanForm({ ...tagihanForm, jatuh_tempo: e.target.value })} style={S.input} /></div>
            </div>
            <div style={S.rowBtns}><button onClick={() => setShowTagihanForm(false)} style={S.btnSecondary}>Batal</button><button onClick={addTagihan} style={S.btnPrimary}>Simpan</button></div>
          </Modal>
        )}
        {showBayarForm && selTagihan && (
          <Modal onClose={() => { setShowBayarForm(false); setBayarForm({ nominal: "", tanggal: today() }); }}>
            <p style={S.modalTitle}>Catat Pembayaran</p><p style={S.modalSub}>Sisa: <strong style={{ color: "#f59e0b" }}>{fmt(getSisa(selTagihan))}</strong></p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><label style={S.label}>Nominal Bayar</label><input autoFocus type="text" inputMode="numeric" placeholder="Contoh: 2000000" value={bayarForm.nominal} onChange={e => setBayarForm({ ...bayarForm, nominal: e.target.value })} style={S.input} />{parseInt(bayarForm.nominal.replace(/\D/g,""),10) > 0 && <p style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>{fmt(parseInt(bayarForm.nominal.replace(/\D/g,""),10))}</p>}</div>
              <div><label style={S.label}>Tanggal Bayar</label><input type="date" value={bayarForm.tanggal} onChange={e => setBayarForm({ ...bayarForm, tanggal: e.target.value })} style={S.input} /></div>
            </div>
            <div style={S.rowBtns}><button onClick={() => { setShowBayarForm(false); setBayarForm({ nominal: "", tanggal: today() }); }} style={S.btnSecondary}>Batal</button><button onClick={addBayar} style={S.btnPrimary}>Simpan</button></div>
          </Modal>
        )}
        <div style={S.container}>
          <div style={{ paddingTop: 40, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button onClick={() => { setView("list"); setSelSupplier(null); }} style={S.backBtn}>←</button>
              <div><h2 style={{ color: "#f1f5f9", fontWeight: 800, fontSize: 22 }}>{selSupplier.name}</h2><p style={{ color: "#475569", fontSize: 12 }}>{aktif.length} tagihan aktif</p></div>
            </div>
            <button onClick={() => setShowTagihanForm(true)} style={{ ...S.btnPrimary, flex: "none", padding: "8px 14px", borderRadius: 12, fontSize: 13 }}>+ Tagihan</button>
          </div>
          {aktif.length === 0 && <div style={{ textAlign: "center", padding: "32px 0", color: "#334155" }}><p style={{ fontSize: 32, marginBottom: 8 }}>✅</p><p style={{ fontSize: 14, fontWeight: 600 }}>Semua tagihan lunas</p></div>}
          {aktif.map(t => <TagihanCard key={t.id} t={t} sisa={getSisa(t)} bayaran={getBayaran(t.id)} onBayar={t => { setSelTagihan(t); setShowBayarForm(true); }} />)}
          {lunas.length > 0 && (
            <div style={{ ...S.card, padding: 0, overflow: "hidden" }}>
              <p style={{ ...S.eyebrow, padding: "14px 16px 10px" }}>Lunas ({lunas.length})</p>
              {lunas.map((t, i) => (
                <div key={t.id} style={{ padding: "10px 16px", borderTop: i === 0 ? "none" : "1px solid #1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><p style={{ color: "#475569", fontSize: 13 }}>{t.keterangan || "Tagihan"}</p><p style={{ color: "#334155", fontSize: 11 }}>JT: {fmtDate(t.jatuh_tempo)}</p></div>
                  <div style={{ textAlign: "right" }}><p style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>{fmt(t.nominal)}</p><p style={{ color: "#334155", fontSize: 11 }}>✓ Lunas</p></div>
                </div>
              ))}
            </div>
          )}
        </div>
        <BottomNav />
      </div>
    );
  }

  // ── LIST ─────────────────────────────────────────────
  const totalBelumLunas = tagihans.filter(t => !t.is_lunas).reduce((s, t) => s + getSisa(t), 0);
  const totalOverdue = tagihans.filter(t => getStatus(t) === "overdue").length;
  const totalWarning = tagihans.filter(t => getStatus(t) === "warning").length;

  return (
    <div style={S.page}>
      <Toast toast={toast} />
      {showAddSupplier && (
        <Modal onClose={() => { setShowAddSupplier(false); setNewName(""); }}>
          <p style={S.modalTitle}>Tambah Supplier</p><p style={S.modalSub}>Masukkan nama supplier</p>
          <input autoFocus type="text" placeholder="Nama supplier" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSupplier()} style={S.input} />
          <div style={S.rowBtns}><button onClick={() => { setShowAddSupplier(false); setNewName(""); }} style={S.btnSecondary}>Batal</button><button onClick={addSupplier} style={S.btnPrimary}>Tambah</button></div>
        </Modal>
      )}
      <div style={S.container}>
        <div style={{ paddingTop: 48, paddingBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <PageHeader title="Supplier" />
          <button onClick={() => setShowAddSupplier(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 12, background: "#1e293b", border: "1px solid #334155", color: "#94a3b8", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>+ Supplier</button>
        </div>
        {totalBelumLunas > 0 && (
          <div style={{ background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)", border: "1px solid #334155", borderRadius: 20, padding: 18, marginBottom: 16 }}>
            <p style={S.eyebrow}>Total Hutang Supplier</p>
            <p style={{ color: "#f1f5f9", fontSize: 24, fontWeight: 800 }}>{fmt(totalBelumLunas)}</p>
            <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
              {totalOverdue > 0 && <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 700 }}>⚠ {totalOverdue} overdue</span>}
              {totalWarning > 0 && <span style={{ fontSize: 12, color: "#f59e0b", fontWeight: 700 }}>⏰ {totalWarning} hampir jatuh tempo</span>}
            </div>
          </div>
        )}
        {suppliers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#334155" }}><div style={{ fontSize: 40, marginBottom: 12 }}>🏭</div><p style={{ fontSize: 15, fontWeight: 600 }}>Belum ada supplier</p><p style={{ fontSize: 13, marginTop: 4 }}>Tap "+ Supplier" untuk menambahkan</p></div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {suppliers.map(sup => {
              const aktif = getTagihans(sup.id).filter(t => !t.is_lunas);
              const totalSisa = aktif.reduce((s, t) => s + getSisa(t), 0);
              const hasOverdue = aktif.some(t => getStatus(t) === "overdue");
              const hasWarning = aktif.some(t => getStatus(t) === "warning");
              return (
                <button key={sup.id} onClick={() => { setSelSupplier(sup); setView("detail"); }} style={{ background: "#161b27", border: `1px solid ${hasOverdue ? "rgba(239,68,68,0.3)" : hasWarning ? "rgba(245,158,11,0.3)" : "#1e293b"}`, borderRadius: 18, padding: 16, textAlign: "left", cursor: "pointer", width: "100%", fontFamily: "inherit" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                      <Avatar name={sup.name} />
                      <div><p style={{ color: "#f1f5f9", fontWeight: 700, fontSize: 15 }}>{sup.name}</p><p style={{ color: "#475569", fontSize: 12, marginTop: 1 }}>{aktif.length > 0 ? `${aktif.length} tagihan aktif` : "Semua lunas"}</p></div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {totalSisa > 0 ? (
                        <><p style={{ color: hasOverdue ? "#ef4444" : hasWarning ? "#f59e0b" : "#f1f5f9", fontWeight: 800, fontSize: 14 }}>{fmt(totalSisa)}</p>{hasOverdue && <p style={{ color: "#ef4444", fontSize: 11, fontWeight: 700 }}>OVERDUE</p>}{!hasOverdue && hasWarning && <p style={{ color: "#f59e0b", fontSize: 11, fontWeight: 700 }}>HAMPIR JT</p>}</>
                      ) : <span style={{ fontSize: 11, color: "#34d399", fontWeight: 700 }}>✓ Lunas</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
}
