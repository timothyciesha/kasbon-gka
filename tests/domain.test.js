import test from "node:test";
import assert from "node:assert/strict";
import {
  amount,
  csvText,
  dayDiff,
  feeFor,
  payrollPreview,
  remaining,
  today,
  validDate,
  workingDates,
} from "../src/lib/domain.js";
test("tanggal bisnis memakai WIB, termasuk batas bulan", () => {
  assert.equal(today(new Date("2026-09-25T01:00:00+07:00")), "2026-09-25");
  assert.equal(today(new Date("2026-10-01T00:00:00+07:00")), "2026-10-01");
});
test("hari libur yang bertepatan Minggu tidak dipotong dua kali", () => {
  assert.equal(workingDates("2026-09").length, 26);
  assert.equal(
    workingDates("2026-09", ["2026-09-06", "2026-09-06"]).length,
    26,
  );
  assert.equal(workingDates("2026-09", ["2026-09-07"]).length, 25);
});
test("rupiah tidak mengubah negatif/desimal menjadi nominal positif", () => {
  for (const value of ["-100", "1.5", "1e5", "100,000", "NaN", ""])
    assert.throws(() => amount(value));
  assert.equal(amount("500000"), 500000);
  assert.equal(amount("0", true), 0);
  assert.throws(() => amount("0"));
});
test("tanggal dan biaya admin mengacu tanggal transaksi", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2024-02-29"), true);
  assert.equal(dayDiff("2026-10-01", "2026-09-01"), 30);
  assert.equal(feeFor("2026-09-01", "2026-09-30"), 50000);
  assert.equal(feeFor("2026-09-01", "2026-10-01"), 0);
});
test("pembayaran void tidak mengurangi saldo", () => {
  assert.equal(
    remaining({ id: "k", total_potong: 100000 }, [
      { kasbon_id: "k", nominal: 20000 },
      { kasbon_id: "k", nominal: 50000, voided_at: "2026-09-25" },
    ]),
    80000,
  );
});
test("payroll pakai ID karyawan, abaikan duplikat absensi, hari libur, dan void", () => {
  const employee = { id: "e", name: "Nama baru", gaji_pokok: 4000000 };
  const absences = [
    { employee_id: "e", driver_name: "Nama lama", tanggal: "2026-09-01" },
    { employee_id: "e", tanggal: "2026-09-01" },
    { employee_id: "e", tanggal: "2026-09-06" },
    { employee_id: "e", tanggal: "2026-09-07" },
    { employee_id: "e", tanggal: "2026-09-08", voided_at: "yes" },
  ];
  const row = payrollPreview(
    employee,
    absences,
    [{ id: "k", employee_id: "e", is_active: true, total_potong: 500000 }],
    [],
    "2026-09",
    ["2026-09-07"],
    100000,
  );
  assert.equal(row.hari_kerja, 25);
  assert.equal(row.hari_absen, 1);
  assert.equal(row.tunjangan_hadir, 1680000);
  assert.equal(row.total, 5580000);
  assert.throws(() =>
    payrollPreview(employee, absences, [], [], "2026-09", [], 1),
  );
});
test("CSV mengamankan formula spreadsheet dan karakter kutip", () => {
  const output = csvText(
    [{ key: "name", label: "Nama" }],
    [{ name: "=SUM(1,2)" }, { name: 'A "B"' }],
  );
  assert.ok(output.includes("'=SUM(1,2)"));
  assert.ok(output.includes('A ""B""'));
});
