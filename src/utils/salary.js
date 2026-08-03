import { DEFAULT_GAJI, TUNJANGAN_PER_HARI } from "../constants.js";

export const calculateGajian = (drivers, getAbsenBulan, form) => {
  const [year, month] = form.periode.split("-").map(Number);
  const totalHari = new Date(year, month, 0).getDate();
  const hariMinggu = parseInt(form.hari_minggu, 10) || 0;
  const tanggalMerah = parseInt(form.tanggal_merah, 10) || 0;
  const hariKerja = totalHari - hariMinggu - tanggalMerah;
  const results = drivers.map(driver => {
    const absenBulan = getAbsenBulan(driver.name, form.periode);
    const hariAbsen = absenBulan.length;
    const hariHadir = Math.max(0, hariKerja - hariAbsen);
    const gajiPokok = driver.gaji_pokok || DEFAULT_GAJI;
    const tunjanganHadir = hariHadir * TUNJANGAN_PER_HARI;
    return { driver: driver.name, jabatan: driver.jabatan || "Sopir", gajiPokok, hariKerja, hariAbsen, hariHadir, tunjanganHadir };
  });

  return { periode: form.periode, totalHari, hariMinggu, tanggalMerah, hariKerja, results };
};

export const calculateSlip = (slipDriver, drivers, getAbsenBulan, slipForm) => {
  const hari = parseInt(slipForm.hari_hadir, 10);
  const driverData = drivers.find(driver => driver.name === slipDriver);
  const jabatan = driverData?.jabatan || "Sopir";
  const gajiPokok = parseInt(String(slipForm.gaji_pokok).replace(/\D/g, ""), 10) || driverData?.gaji_pokok || DEFAULT_GAJI;
  const tunjanganHadir = hari * TUNJANGAN_PER_HARI;
  const absenBulan = getAbsenBulan(slipDriver, slipForm.periode);
  const potonganPinjaman = parseInt(String(slipForm.potongan_pinjaman).replace(/\D/g, ""), 10) || 0;
  const total = gajiPokok + tunjanganHadir - potonganPinjaman;
  return { driver: slipDriver, jabatan, periode: slipForm.periode, gajiPokok, hariHadir: hari, tunjanganHadir, absenCount: absenBulan.length, potonganPinjaman, total };
};
