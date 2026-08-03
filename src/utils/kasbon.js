import { ADMIN_FEE, WAITING_DAYS } from "../constants.js";
import { daysSince } from "./date.js";

export const createKasbonHelpers = (kasbons, cicilans) => {
  const getActive = (name) => kasbons.find(k => k.driver_name === name && k.is_active) || null;
  const getHistory = (name) => kasbons.filter(k => k.driver_name === name && !k.is_active);
  const getCicilans = (id) => cicilans.filter(c => c.kasbon_id === id);
  const getSisaBayar = (kasbon) => Math.max(0, kasbon.total_potong - getCicilans(kasbon.id).reduce((sum, cicilan) => sum + cicilan.nominal, 0));
  const getLastLunas = (name) => {
    const history = getHistory(name);
    return history.length ? history[history.length - 1].tanggal_lunas : null;
  };
  const getStatus = (name) => {
    if (getActive(name)) return "aktif";
    const history = getHistory(name);
    if (!history.length) return "bersih";
    return daysSince(getLastLunas(name)) < WAITING_DAYS ? "tunggu" : "bisa";
  };
  const getSisaHari = (name) => {
    const lastLunas = getLastLunas(name);
    return lastLunas ? Math.max(0, WAITING_DAYS - daysSince(lastLunas)) : 0;
  };
  const getFee = (name) => {
    const lastLunas = getLastLunas(name);
    return lastLunas && daysSince(lastLunas) < WAITING_DAYS ? ADMIN_FEE : 0;
  };
  const statusColor = (status) => ({
    aktif: { color: "#fbbf24", bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.2)" },
    tunggu: { color: "#60a5fa", bg: "rgba(96,165,250,0.1)", border: "rgba(96,165,250,0.2)" },
    bisa: { color: "#34d399", bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.2)" },
    bersih: { color: "#94a3b8", bg: "rgba(148,163,184,0.1)", border: "rgba(148,163,184,0.2)" },
  }[status]);
  const statusLabel = (status, name) => ({ aktif: "Ada Kasbon", tunggu: `Tunggu ${getSisaHari(name)}h`, bisa: "Bisa Kasbon", bersih: "Belum ada" }[status]);

  return { getActive, getHistory, getCicilans, getSisaBayar, getLastLunas, getStatus, getSisaHari, getFee, statusColor, statusLabel };
};
