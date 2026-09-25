export async function downloadExcel(name, columns, rows) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "GKA Operasional";
  const sheet = workbook.addWorksheet("Rekap");
  sheet.columns = columns.map((c) => ({
    header: c.label,
    key: c.key,
    width: c.key.includes("name") ? 28 : 22,
  }));
  rows.forEach((row) =>
    sheet.addRow(
      Object.fromEntries(columns.map((c) => [c.key, row[c.key] ?? ""])),
    ),
  );
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF176B53" },
  };
  sheet.views = [{ state: "frozen", ySplit: 1 }];
  sheet.autoFilter = { from: "A1", to: { row: 1, column: columns.length } };
  columns.forEach((c, i) => {
    if (/nominal|total|sisa|gaji|tunjangan|potongan|fee/.test(c.key))
      sheet.getColumn(i + 1).numFmt = "#,##0";
  });
  const bytes = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([bytes], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name + ".xlsx";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
