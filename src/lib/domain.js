export const ADMIN_FEE = 50000;
export const WAITING_DAYS = 30;
export const DAILY_ALLOWANCE = 70000;
export const DEFAULT_SALARY = 4000000;
export const today = (date = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
export const money = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
export const dateLabel = (value) =>
  value
    ? new Intl.DateTimeFormat("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(value.slice(0, 10) + "T00:00:00Z"))
    : "—";
export const monthLabel = (value) =>
  new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "-01T00:00:00Z"));
export const dayDiff = (a, b) =>
  Math.round(
    (Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400000,
  );
export function validDate(value) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(value)) &&
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value
  );
}
export function amount(value, allowZero = false) {
  const text = String(value).trim();
  if (!/^\d+$/.test(text))
    throw new Error(
      "Nominal harus berupa angka rupiah utuh tanpa tanda minus atau desimal.",
    );
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < (allowZero ? 0 : 1) || n > 2000000000)
    throw new Error("Nominal di luar batas yang diizinkan.");
  return n;
}
export const paid = (rows, key, id) =>
  rows
    .filter((r) => r[key] === id && !r.voided_at)
    .reduce((sum, r) => sum + Number(r.nominal), 0);
export const remaining = (loan, rows) =>
  Math.max(0, Number(loan.total_potong) - paid(rows, "kasbon_id", loan.id));
export const invoiceRemaining = (invoice, rows) =>
  Math.max(0, Number(invoice.nominal) - paid(rows, "tagihan_id", invoice.id));
export const belongs = (row, employee) =>
  row.employee_id
    ? row.employee_id === employee.id
    : row.driver_name === employee.name;
export const lastSettlement = (loans, employee) =>
  loans
    .filter((k) => belongs(k, employee) && !k.is_active && k.tanggal_lunas)
    .map((k) => k.tanggal_lunas)
    .sort()
    .at(-1);
export const feeFor = (settled, date) =>
  settled && dayDiff(date, settled) < WAITING_DAYS ? ADMIN_FEE : 0;
export function workingDates(period, holidays = []) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period))
    throw new Error("Periode tidak valid.");
  const [year, month] = period.split("-").map(Number);
  const excluded = new Set(holidays);
  const dates = [];
  for (
    let day = 1;
    day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
    day++
  ) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const iso = date.toISOString().slice(0, 10);
    if (date.getUTCDay() !== 0 && !excluded.has(iso)) dates.push(iso);
  }
  return dates;
}
export function payrollPreview(
  employee,
  absences,
  loans,
  payments,
  period,
  holidays,
  deduction = 0,
) {
  const dates = workingDates(period, holidays);
  const absent = new Set(
    absences
      .filter(
        (a) =>
          belongs(a, employee) && !a.voided_at && dates.includes(a.tanggal),
      )
      .map((a) => a.tanggal),
  ).size;
  const salary = Number(employee.gaji_pokok ?? DEFAULT_SALARY);
  const allowance = (dates.length - absent) * DAILY_ALLOWANCE;
  const debt = loans
    .filter((k) => belongs(k, employee) && k.is_active)
    .reduce((sum, k) => sum + remaining(k, payments), 0);
  const cut = amount(deduction, true);
  if (cut > debt)
    throw new Error(`Potongan ${employee.name} melebihi sisa kasbon.`);
  if (cut > salary + allowance)
    throw new Error(`Potongan ${employee.name} melebihi penerimaan.`);
  return {
    employee_id: employee.id,
    driver_name: employee.name,
    jabatan: employee.jabatan,
    gaji_pokok: salary,
    hari_kerja: dates.length,
    hari_absen: absent,
    tunjangan_hadir: allowance,
    potongan_pinjaman: cut,
    total: salary + allowance - cut,
    debt,
  };
}
export function csvText(columns, rows) {
  const escape = (value) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@\-\t\r]/, "'$&")
      .replaceAll('"', '""') +
    '"';
  return (
    "\uFEFF" +
    [
      columns.map((c) => escape(c.label)).join(";"),
      ...rows.map((r) => columns.map((c) => escape(r[c.key])).join(";")),
    ].join("\r\n")
  );
}
export function downloadCSV(name, columns, rows) {
  const url = URL.createObjectURL(
    new Blob([csvText(columns, rows)], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
