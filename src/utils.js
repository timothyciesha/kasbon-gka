export const ADMIN_FEE = 50000;
export const WAITING_DAYS = 30;
export const TUNJANGAN_PER_HARI = 70000;
export const DEFAULT_GAJI = 4000000;

export const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export const fmtDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric",
  });
};

export const fmtDateLong = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });
};

export const monthName = (iso) =>
  new Date(iso + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });

export const today = () => new Date().toISOString().slice(0, 10);

export const daysSince = (iso) => {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
};

export const hariSampaiJatuhTempo = (tgl) => {
  const diff = new Date(tgl).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};
