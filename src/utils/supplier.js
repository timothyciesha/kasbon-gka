export const createSupplierHelpers = (tagihans, supplierBayar) => {
  const getTagihans = (supplierId) => tagihans.filter(tagihan => tagihan.supplier_id === supplierId);
  const getBayaran = (tagihanId) => supplierBayar.filter(bayaran => bayaran.tagihan_id === tagihanId);
  const getSisaTagihan = (tagihan) => Math.max(0, tagihan.nominal - getBayaran(tagihan.id).reduce((sum, bayaran) => sum + bayaran.nominal, 0));
  const hariSampaiJatuhTempo = (tanggal) => {
    const diff = new Date(tanggal).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };
  const getTagihanStatus = (tagihan) => {
    if (tagihan.is_lunas) return "lunas";
    const hari = hariSampaiJatuhTempo(tagihan.jatuh_tempo);
    if (hari < 0) return "overdue";
    if (hari <= 3) return "warning";
    return "aktif";
  };
  const tagihanStatusStyle = (status) => ({
    lunas: { color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)" },
    aktif: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
    warning: { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
    overdue: { color: "#ef4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
  }[status]);
  const tagihanStatusLabel = (tagihan) => {
    const status = getTagihanStatus(tagihan);
    const hari = hariSampaiJatuhTempo(tagihan.jatuh_tempo);
    if (status === "lunas") return "Lunas";
    if (status === "overdue") return `Overdue ${Math.abs(hari)}h`;
    if (status === "warning") return `H-${hari} jatuh tempo`;
    return "Aktif";
  };

  return { getTagihans, getBayaran, getSisaTagihan, hariSampaiJatuhTempo, getTagihanStatus, tagihanStatusStyle, tagihanStatusLabel };
};
