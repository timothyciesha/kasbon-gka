export const fmt = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");

export const fmtDate = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
};

export const fmtDateLong = (iso) => {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};

export const monthName = (iso) => new Date(iso + "-01").toLocaleDateString("id-ID", { month: "long", year: "numeric" });
