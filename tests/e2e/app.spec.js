import { test, expect } from "@playwright/test";
import ExcelJS from "exceljs";
const tables = [
  "drivers",
  "kasbons",
  "cicilans",
  "absens",
  "gajian",
  "gajian_detail",
  "suppliers",
  "supplier_tagihan",
  "supplier_bayar",
  "slips",
  "payroll_runs",
  "payroll_items",
  "attendance_periods",
  "audit_log",
];
async function fixture(page, { failure = false } = {}) {
  const data = Object.fromEntries(tables.map((t) => [t, []]));
  data.drivers = [
    {
      id: "e1",
      name: "Karyawan Uji",
      jabatan: "Admin",
      gaji_pokok: 4000000,
      is_active: true,
    },
    {
      id: "e2",
      name: "Sopir Uji",
      jabatan: "Sopir",
      gaji_pokok: 4000000,
      is_active: true,
    },
  ];
  data.kasbons = [
    {
      id: "k1",
      employee_id: "e1",
      driver_name: "Karyawan Uji",
      nominal: 500000,
      fee: 0,
      total_potong: 500000,
      tanggal_kasbon: "2026-09-01",
      is_active: true,
    },
  ];
  data.suppliers = [{ id: "s1", name: "Supplier Uji" }];
  data.supplier_tagihan = [
    {
      id: "t1",
      supplier_id: "s1",
      nominal: 1000000,
      keterangan: "Invoice uji",
      jatuh_tempo: "2026-09-20",
      is_lunas: false,
    },
  ];
  const calls = [];
  await page.route("**/rest/v1/**", async (route) => {
    const url = new URL(route.request().url());
    const table = url.pathname.split("/").at(-1);
    if (table === "gka_command") {
      const body = route.request().postDataJSON();
      calls.push(body);
      await new Promise((resolve) => setTimeout(resolve, 200));
      return route.fulfill({ status: 200, json: { id: "result" } });
    }
    if (failure && table === "cicilans")
      return route.fulfill({
        status: 500,
        json: { message: "Simulasi gangguan" },
      });
    return route.fulfill({ status: 200, json: data[table] || [] });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ringkasan operasional" }),
  ).toBeVisible();
  return { data, calls };
}
test("desktop dan mobile: navigasi seluruh modul, tidak ada overflow atau error", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await fixture(page);
  for (const name of [
    "Kasbon & karyawan",
    "Absensi",
    "Gajian",
    "Supplier",
    "Aktivitas",
    "Ringkasan",
  ]) {
    await page
      .getByRole("navigation", { name: "Navigasi utama" })
      .getByRole("button", { name, exact: true })
      .click();
    await expect(
      page.locator("main .page-view:not([hidden]) h1"),
    ).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ["Kasbon", "Absensi", "Gajian", "Supplier", "Ringkasan"]) {
    await page
      .getByRole("navigation", { name: "Navigasi seluler" })
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});

test("ekspor Excel berisi angka asli dan header rekap", async ({ page }) => {
  await fixture(page);
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: "Kasbon & karyawan" })
    .click();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Excel", exact: true }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/\.xlsx$/);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(await file.path());
  const sheet = workbook.getWorksheet("Rekap");
  expect(sheet.getCell("A1").value).toBe("Karyawan");
  expect(sheet.getCell("A2").value).toBe("Karyawan Uji");
  expect(sheet.getCell("C2").value).toBe(500000);
});

test("slip final tersedia dan layout cetak hanya menampilkan slip", async ({
  page,
}) => {
  const { data } = await fixture(page);
  data.payroll_runs = [
    { id: "r1", periode: "2026-09", tanggal: "2026-09-25", status: "final" },
  ];
  data.payroll_items = [
    {
      id: "pi1",
      run_id: "r1",
      employee_id: "e1",
      driver_name: "Karyawan Uji",
      jabatan: "Admin",
      gaji_pokok: 4000000,
      hari_kerja: 26,
      hari_absen: 1,
      tunjangan_hadir: 1750000,
      potongan_pinjaman: 100000,
      total: 5650000,
    },
  ];
  await page.reload();
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: "Gajian", exact: true })
    .click();
  await page.locator("section:not([hidden]) input[type=month]").fill("2026-09");
  await page.getByRole("button", { name: "Lihat slip", exact: true }).click();
  await expect(page.locator(".salary-slip")).toContainText("5.650.000");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(page.locator(".salary-slip")).toBeVisible();
  const pdf = await page.pdf();
  expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
});
test("kegagalan satu tabel ditampilkan dan penyimpanan dinonaktifkan", async ({
  page,
}) => {
  await fixture(page, { failure: true });
  await expect(page.getByRole("alert")).toContainText("Data belum lengkap");
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: "Kasbon & karyawan" })
    .click();
  await expect(
    page.getByRole("button", { name: "Karyawan", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: /Karyawan Uji/ }),
  ).toBeVisible();
});
test("pencarian, pembayaran menampilkan saldo, submit tunggal dan request ID", async ({
  page,
}) => {
  const { calls } = await fixture(page);
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: "Kasbon & karyawan" })
    .click();
  await page.getByLabel("Cari karyawan").fill("Karyawan Uji");
  await expect(page.getByRole("button", { name: /Sopir Uji/ })).toHaveCount(0);
  await page.getByRole("button", { name: /Karyawan Uji/ }).click();
  await page
    .getByRole("button", { name: "Catat pembayaran", exact: true })
    .click();
  await page.getByLabel("Nominal pembayaran (rupiah)").fill("100000");
  await expect(page.getByRole("dialog")).toContainText("400.000");
  await page.getByRole("button", { name: "Simpan", exact: true }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(calls).toHaveLength(1);
  expect(calls[0].p_action).toBe("loan_payment");
  expect(calls[0].p_request_id).toMatch(/^[0-9a-f-]{36}$/);
});
test("input payroll bertahan ketika pindah tab, potongan berlebih diblokir", async ({
  page,
}) => {
  await fixture(page);
  const nav = page.getByRole("navigation", { name: "Navigasi utama" });
  await nav.getByRole("button", { name: "Gajian", exact: true }).click();
  await page.getByLabel("Potongan Karyawan Uji").fill("100000");
  await nav.getByRole("button", { name: "Absensi", exact: true }).click();
  await nav.getByRole("button", { name: "Gajian", exact: true }).click();
  await expect(page.getByLabel("Potongan Karyawan Uji")).toHaveValue("100000");
  await page.getByLabel("Potongan Karyawan Uji").fill("500001");
  await expect(page.getByRole("alert")).toContainText("melebihi sisa kasbon");
  await expect(
    page.getByRole("button", { name: "Finalisasi payroll", exact: true }),
  ).toBeDisabled();
});
test("tidak ada tombol hapus/reset, dialog dapat ditutup dengan Escape", async ({
  page,
}) => {
  await fixture(page);
  await page
    .getByRole("navigation", { name: "Navigasi utama" })
    .getByRole("button", { name: "Absensi", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /reset|hapus/i })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Catat absen", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
