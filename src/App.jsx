import { useState, useEffect } from "react";

const DRIVERS = ["Sahrul", "Ajat", "Deden", "Agus"];
const ADMIN_FEE = 50000;
const WAITING_DAYS = 30;

const formatRp = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

const formatDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

const today = () => new Date().toISOString().slice(0, 10);

const loadData = () => {
  try {
    const saved = localStorage.getItem("kasbon_v3");
    if (saved) return JSON.parse(saved);
  } catch {}
  const d = {};
  DRIVERS.forEach((name) => { d[name] = { active: null, history: [] }; });
  return d;
};

export default function App() {
  const [data, setData] = useState(loadData);
  const [view, setView] = useState("dashboard");
  const [sel, setSel] = useState(null); // selected driver
  const [toast, setToast] = useState(null);

  // Form states
  const [kForm, setKForm] = useState({ nominal: "", tanggal: today() }); // kasbon form
  const [cForm, setCForm] = useState({ nominal: "", tanggal: today() }); // cicilan form
  const [showCForm, setShowCForm] = useState(false);
  const [confirmHapus, setConfirmHapus] = useState(null); // { type: 'cicilan'|'kasbon', index }

  useEffect(() => {
    try { localStorage.setItem("kasbon_v3", JSON.stringify(data)); } catch {}
  }, [data]);

  const showToast = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // ── helpers ──────────────────────────────────────────
  const getSisaBayar = (kasbon) => {
    const totalBayar = (kasbon.cicilan || []).reduce((s, c) => s + c.nominal, 0);
    return Math.max(0, kasbon.totalPotong - totalBayar);
  };

  const getStatus = (driver) => {
    const d = data[driver];
    if (d.active) return "aktif";
    if (!d.history.length) return "bersih";
    const lastLunas = d.history[d.history.length - 1]?.tanggalLunas;
    const days = daysSince(lastLunas);
    if (days < WAITING_DAYS) return "tunggu";
    return "bisa";
  };

  const getSisaHari = (driver) => {
    const d = data[driver];
    const last = d.history[d.history.length - 1]?.tanggalLunas;
    if (!last) return 0;
    return Math.max(0, WAITING_DAYS - daysSince(last));
  };

  const getFee = (driver) => {
    const d = data[driver];
    const last = d.history[d.history.length - 1]?.tanggalLunas;
    if (!last) return 0;
    return daysSince(last) < WAITING_DAYS ? ADMIN_FEE : 0;
  };

  // ── actions ──────────────────────────────────────────
  const submitKasbon = () => {
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1000) return showToast("Nominal tidak valid", "err");
    const fee = getFee(sel);
    setData((prev) => ({
      ...prev,
      [sel]: {
        ...prev[sel],
        active: { nominal, fee, totalPotong: nominal + fee, tanggalKasbon: kForm.tanggal, cicilan: [] },
      },
    }));
    setKForm({ nominal: "", tanggal: today() });
    setView("detail");
    showToast("Kasbon berhasil dicatat");
  };

  const submitCicilan = () => {
    const nominal = parseInt(cForm.nominal.replace(/\D/g, ""), 10);
    if (!nominal || nominal < 1) return showToast("Nominal cicilan tidak valid", "err");
    const active = data[sel].active;
    const sisa = getSisaBayar(active);
    if (nominal > sisa) return showToast(`Melebihi sisa ${formatRp(sisa)}`, "err");

    const newCicilan = [...(active.cicilan || []), { nominal, tanggal: cForm.tanggal }];
    const totalBayar = newCicilan.reduce((s, c) => s + c.nominal, 0);
    const lunas = totalBayar >= active.totalPotong;

    setData((prev) => {
      const updated = { ...active, cicilan: newCicilan };
      if (lunas) {
        return {
          ...prev,
          [sel]: {
            active: null,
            history: [...prev[sel].history, { ...updated, tanggalLunas: cForm.tanggal }],
          },
        };
      }
      return { ...prev, [sel]: { ...prev[sel], active: updated } };
    });

    setCForm({ nominal: "", tanggal: today() });
    setShowCForm(false);
    showToast(lunas ? "Kasbon lunas! 🎉" : "Cicilan berhasil dicatat");
  };

  const hapusCicilan = (idx) => {
    setData((prev) => {
      const cicilan = [...(prev[sel].active.cicilan || [])];
      cicilan.splice(idx, 1);
      return { ...prev, [sel]: { ...prev[sel], active: { ...prev[sel].active, cicilan } } };
    });
    setConfirmHapus(null);
    showToast("Cicilan dihapus");
  };

  // ── badge ─────────────────────────────────────────────
  const badge = (status, driver) => {
    const map = {
      aktif: "bg-amber-100 text-amber-700 border-amber-200",
      tunggu: "bg-blue-50 text-blue-600 border-blue-200",
      bisa: "bg-emerald-50 text-emerald-600 border-emerald-200",
      bersih: "bg-gray-50 text-gray-500 border-gray-200",
    };
    const label = {
      aktif: "Ada Kasbon",
      tunggu: `Tunggu ${getSisaHari(driver)}h`,
      bisa: "Bisa Kasbon",
      bersih: "Belum pernah",
    };
    return (
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${map[status]}`}>
        {label[status]}
      </span>
    );
  };

  // ════════════════════════════════════════════════════════
  // DASHBOARD
  // ════════════════════════════════════════════════════════
  if (view === "dashboard") {
    const totalAktif = DRIVERS.filter((d) => data[d].active).reduce(
      (s, d) => s + (data[d].active?.nominal || 0), 0
    );
    const totalSisaBayar = DRIVERS.filter((d) => data[d].active).reduce(
      (s, d) => s + getSisaBayar(data[d].active), 0
    );

    return (
      <div className="min-h-screen bg-slate-50">
        {toast && <Toast toast={toast} />}
        <div className="max-w-md mx-auto px-4 pb-10">
          <div className="pt-10 pb-5">
            <p className="text-xs font-bold tracking-widest text-slate-400 uppercase mb-1">GKA</p>
            <h1 className="text-2xl font-bold text-slate-800">Kasbon Sopir</h1>
          </div>

          {totalAktif > 0 && (
            <div className="bg-slate-800 rounded-2xl p-4 mb-5">
              <p className="text-slate-400 text-xs mb-3">Ringkasan kasbon aktif</p>
              <div className="flex gap-4">
                <div>
                  <p className="text-slate-400 text-xs">Total dipinjam</p>
                  <p className="text-white text-lg font-bold">{formatRp(totalAktif)}</p>
                </div>
                <div className="w-px bg-slate-600" />
                <div>
                  <p className="text-slate-400 text-xs">Sisa belum bayar</p>
                  <p className="text-amber-400 text-lg font-bold">{formatRp(totalSisaBayar)}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {DRIVERS.map((driver) => {
              const status = getStatus(driver);
              const active = data[driver].active;
              const sisa = active ? getSisaBayar(active) : 0;
              const progress = active
                ? Math.round(((active.totalPotong - sisa) / active.totalPotong) * 100)
                : 0;

              return (
                <button
                  key={driver}
                  onClick={() => { setSel(driver); setView("detail"); }}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-slate-100 text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-bold text-sm">
                        {driver[0]}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{driver}</p>
                        <p className="text-xs text-slate-400">{data[driver].history.length} kasbon selesai</p>
                      </div>
                    </div>
                    {badge(status, driver)}
                  </div>
                  {active && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs text-slate-500 mb-1">
                        <span>Terbayar {formatRp(active.totalPotong - sisa)}</span>
                        <span className="text-amber-600 font-semibold">Sisa {formatRp(sisa)}</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-amber-400 rounded-full transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Aturan</p>
            <div className="space-y-1.5 text-xs text-slate-600">
              <p>✅ Kasbon ≥30 hari setelah lunas → <strong>Gratis</strong></p>
              <p>⚡ Kasbon &lt;30 hari setelah lunas → <strong>+Rp50.000 admin</strong></p>
              <p>🚫 Tidak bisa kasbon saat masih ada kasbon aktif</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // DETAIL
  // ════════════════════════════════════════════════════════
  if (view === "detail" && sel) {
    const d = data[sel];
    const status = getStatus(sel);
    const active = d.active;
    const sisa = active ? getSisaBayar(active) : 0;
    const totalBayar = active ? active.totalPotong - sisa : 0;
    const progress = active ? Math.round((totalBayar / active.totalPotong) * 100) : 0;
    const canKasbon = status === "bisa" || status === "bersih";

    return (
      <div className="min-h-screen bg-slate-50">
        {toast && <Toast toast={toast} />}

        {/* Confirm hapus cicilan */}
        {confirmHapus && (
          <div className="fixed inset-0 bg-black/40 z-40 flex items-end">
            <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6">
              <p className="font-bold text-slate-800 mb-1">Hapus cicilan ini?</p>
              <p className="text-sm text-slate-500 mb-5">Tindakan ini tidak bisa dibatalkan.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmHapus(null)} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">Batal</button>
                <button onClick={() => hapusCicilan(confirmHapus.idx)} className="flex-1 py-3 rounded-xl bg-red-500 text-white text-sm font-semibold">Hapus</button>
              </div>
            </div>
          </div>
        )}

        {/* Add cicilan sheet */}
        {showCForm && (
          <div className="fixed inset-0 bg-black/40 z-40 flex items-end">
            <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-6">
              <p className="font-bold text-slate-800 mb-1">Catat Pembayaran</p>
              <p className="text-xs text-slate-400 mb-4">Sisa kasbon: <strong className="text-slate-700">{formatRp(sisa)}</strong></p>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Nominal Bayar</label>
                  <input
                    type="text" inputMode="numeric"
                    placeholder="Contoh: 500000"
                    value={cForm.nominal}
                    onChange={(e) => setCForm({ ...cForm, nominal: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-base font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    autoFocus
                  />
                  {parseInt(cForm.nominal.replace(/\D/g,""),10) > 0 && (
                    <p className="text-xs text-slate-400 mt-1">{formatRp(parseInt(cForm.nominal.replace(/\D/g,""),10))}</p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1">Tanggal Bayar</label>
                  <input
                    type="date" value={cForm.tanggal}
                    onChange={(e) => setCForm({ ...cForm, tanggal: e.target.value })}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-5">
                <button onClick={() => { setShowCForm(false); setCForm({ nominal: "", tanggal: today() }); }} className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium">Batal</button>
                <button onClick={submitCicilan} className="flex-1 py-3 rounded-xl bg-slate-800 text-white text-sm font-semibold">Simpan</button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-md mx-auto px-4 pb-10">
          {/* Header */}
          <div className="pt-8 pb-4 flex items-center gap-3">
            <button onClick={() => { setView("dashboard"); setShowCForm(false); }} className="text-2xl text-slate-400 leading-none">←</button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">{sel}</h2>
              <div className="mt-0.5">{badge(status, sel)}</div>
            </div>
          </div>

          {/* Active kasbon card */}
          {active && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Kasbon Aktif</p>

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                  <span>Terbayar {formatRp(totalBayar)}</span>
                  <span className="font-semibold text-amber-600">Sisa {formatRp(sisa)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="text-xs text-slate-400 mt-1 text-right">{progress}% terbayar</p>
              </div>

              {/* Info rows */}
              <div className="space-y-2 text-sm">
                <Row label="Nominal kasbon" val={formatRp(active.nominal)} />
                {active.fee > 0 && <Row label="Biaya admin" val={`+ ${formatRp(active.fee)}`} valClass="text-red-500" />}
                <Row label="Total harus bayar" val={formatRp(active.totalPotong)} bold />
                <Row label="Tanggal kasbon" val={formatDate(active.tanggalKasbon)} />
              </div>

              {/* Cicilan list */}
              {active.cicilan && active.cicilan.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rincian Pembayaran</p>
                  <div className="space-y-2">
                    {active.cicilan.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{formatRp(c.nominal)}</p>
                          <p className="text-xs text-slate-400">{formatDate(c.tanggal)}</p>
                        </div>
                        <button
                          onClick={() => setConfirmHapus({ idx: i })}
                          className="text-slate-300 hover:text-red-400 text-lg leading-none px-1"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => { setCForm({ nominal: "", tanggal: today() }); setShowCForm(true); }}
                className="mt-4 w-full py-3 bg-slate-800 text-white rounded-xl text-sm font-semibold"
              >
                + Catat Pembayaran
              </button>
            </div>
          )}

          {/* Kasbon baru */}
          {!active && (
            <div className="mb-4">
              {canKasbon ? (
                <button
                  onClick={() => setView("form")}
                  className="w-full py-3 bg-slate-800 text-white rounded-2xl font-semibold text-sm"
                >
                  + Catat Kasbon Baru
                  {getFee(sel) === 0 && <span className="ml-2 text-xs font-normal text-slate-300">· Gratis</span>}
                </button>
              ) : status === "tunggu" ? (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-center">
                  <p className="text-blue-700 font-semibold text-sm">Masa tunggu: {getSisaHari(sel)} hari lagi</p>
                  <p className="text-blue-500 text-xs mt-0.5">atau kasbon sekarang + biaya admin Rp50.000</p>
                  <button
                    onClick={() => setView("form")}
                    className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-xl text-xs font-semibold"
                  >
                    Kasbon Sekarang (+Rp50.000)
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* History */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-4 pt-4 pb-2">
              Riwayat ({d.history.length})
            </p>
            {d.history.length === 0 ? (
              <p className="text-sm text-slate-400 px-4 pb-4">Belum ada riwayat.</p>
            ) : (
              <div className="divide-y divide-slate-50">
                {[...d.history].reverse().map((h, i) => {
                  const [open, setOpen] = useState(false);
                  return (
                    <div key={i}>
                      <button
                        onClick={() => setOpen(!open)}
                        className="w-full px-4 py-3 text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-800 text-sm">{formatRp(h.nominal)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatDate(h.tanggalKasbon)} → Lunas {formatDate(h.tanggalLunas)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {h.fee > 0 && <span className="text-xs text-red-400">+admin</span>}
                            <span className="text-xs text-emerald-600 font-medium">✓ Lunas</span>
                            <span className="text-slate-300 text-xs">{open ? "▲" : "▼"}</span>
                          </div>
                        </div>
                      </button>
                      {open && h.cicilan && h.cicilan.length > 0 && (
                        <div className="px-4 pb-3 space-y-1.5">
                          {h.cicilan.map((c, j) => (
                            <div key={j} className="flex justify-between bg-slate-50 rounded-lg px-3 py-1.5 text-xs">
                              <span className="text-slate-500">{formatDate(c.tanggal)}</span>
                              <span className="font-semibold text-slate-700">{formatRp(c.nominal)}</span>
                            </div>
                          ))}
                          {h.fee > 0 && (
                            <div className="flex justify-between px-3 py-1.5 text-xs">
                              <span className="text-red-400">Biaya admin</span>
                              <span className="font-semibold text-red-400">{formatRp(h.fee)}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════
  // FORM KASBON BARU
  // ════════════════════════════════════════════════════════
  if (view === "form" && sel) {
    const fee = getFee(sel);
    const nominal = parseInt(kForm.nominal.replace(/\D/g, ""), 10) || 0;
    const total = nominal + fee;

    return (
      <div className="min-h-screen bg-slate-50">
        {toast && <Toast toast={toast} />}
        <div className="max-w-md mx-auto px-4 pb-10">
          <div className="pt-8 pb-6 flex items-center gap-3">
            <button onClick={() => setView("detail")} className="text-2xl text-slate-400 leading-none">←</button>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Kasbon Baru</h2>
              <p className="text-sm text-slate-400">{sel}</p>
            </div>
          </div>

          {fee > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 mb-4 text-sm text-amber-700">
              ⚡ Masih dalam masa tunggu — biaya admin <strong>Rp50.000</strong> ditambahkan.
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Nominal Kasbon</label>
              <input
                type="text" inputMode="numeric"
                placeholder="Contoh: 500000"
                value={kForm.nominal}
                onChange={(e) => setKForm({ ...kForm, nominal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xl font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
              {nominal > 0 && <p className="text-xs text-slate-400 mt-1">{formatRp(nominal)}</p>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Tanggal Kasbon</label>
              <input
                type="date" value={kForm.tanggal}
                onChange={(e) => setKForm({ ...kForm, tanggal: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            {nominal > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                <Row label="Nominal" val={formatRp(nominal)} />
                {fee > 0 && <Row label="Biaya admin" val={`+ ${formatRp(fee)}`} valClass="text-red-500" />}
                <div className="border-t border-slate-200 pt-1.5">
                  <Row label="Total harus bayar" val={formatRp(total)} bold />
                </div>
              </div>
            )}

            <button onClick={submitKasbon} className="w-full py-3.5 bg-slate-800 text-white rounded-xl font-semibold text-sm">
              Simpan Kasbon
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ── shared components ──────────────────────────────────
function Row({ label, val, bold, valClass }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className={`${bold ? "font-bold text-slate-800" : "font-medium text-slate-700"} ${valClass || ""}`}>{val}</span>
    </div>
  );
}

function Toast({ toast }) {
  return (
    <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-lg text-sm font-medium
      ${toast.type === "err" ? "bg-red-500 text-white" : "bg-slate-800 text-white"}`}>
      {toast.msg}
    </div>
  );
}
