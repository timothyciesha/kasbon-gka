export const createAttendanceHelpers = (absens) => ({
  getAbsenBulan: (name, bulan) => absens.filter(a => a.driver_name === name && a.tanggal.startsWith(bulan)),
});

export const getNextGajian = (lastTanggal) => {
  const d = new Date(lastTanggal);
  const bulanDepan = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  const akhirBulanDepan = new Date(bulanDepan.getFullYear(), bulanDepan.getMonth() + 1, 0);
  akhirBulanDepan.setDate(akhirBulanDepan.getDate() - 2);
  return akhirBulanDepan.toISOString().slice(0, 10);
};
