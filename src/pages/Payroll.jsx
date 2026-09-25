import ExcelButton from "../components/ExcelButton.jsx";
import { useState } from "react";
import { Check, Download, Printer, Plus, X } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  Field,
  Modal,
  PageTitle,
  Panel,
  Stat,
} from "../components/common.jsx";
import {
  dateLabel,
  downloadCSV,
  money,
  monthLabel,
  payrollPreview,
  today,
  workingDates,
} from "../lib/domain.js";
const exportColumns = [
  { key: "driver_name", label: "Karyawan" },
  { key: "gaji_pokok", label: "Gaji pokok" },
  { key: "hari_kerja", label: "Hari kerja" },
  { key: "hari_absen", label: "Tidak hadir" },
  { key: "tunjangan_hadir", label: "Tunjangan" },
  { key: "potongan_pinjaman", label: "Potongan kasbon" },
  { key: "total", label: "Diterima" },
];
function Slip({ row, period, date }) {
  return (
    <article className="salary-slip">
      <header>
        <div className="brand-mark">G</div>
        <div>
          <strong>PT Gratia Karunia Agung</strong>
          <small>SLIP GAJI · {monthLabel(period)}</small>
        </div>
        <Badge tone="success">Final</Badge>
      </header>
      <div className="row-between">
        <div>
          <small>Karyawan</small>
          <h2>{row.driver_name}</h2>
          <p>{row.jabatan}</p>
        </div>
        <div className="align-right">
          <small>Tanggal pembayaran</small>
          <strong>{dateLabel(date)}</strong>
        </div>
      </div>
      <dl>
        <div>
          <dt>Gaji pokok</dt>
          <dd>{money(row.gaji_pokok)}</dd>
        </div>
        <div>
          <dt>Kehadiran</dt>
          <dd>
            {row.hari_kerja - row.hari_absen} / {row.hari_kerja} hari
          </dd>
        </div>
        <div>
          <dt>Tunjangan hadir</dt>
          <dd>{money(row.tunjangan_hadir)}</dd>
        </div>
        <div>
          <dt>Potongan kasbon</dt>
          <dd>− {money(row.potongan_pinjaman)}</dd>
        </div>
        <div className="slip-total">
          <dt>Total diterima</dt>
          <dd>{money(row.total)}</dd>
        </div>
      </dl>
      <footer>
        Dokumen tersimpan · GKA Operasional · {row.id?.slice(0, 8)}
      </footer>
    </article>
  );
}
export default function Payroll({ data: d, command, busy, disabled }) {
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [holidays, setHolidays] = useState([]);
  const [holiday, setHoliday] = useState("");
  const [cuts, setCuts] = useState({});
  const [paymentDate, setPaymentDate] = useState(today());
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState("");
  const [slips, setSlips] = useState(false);
  const [requestId, setRequestId] = useState(crypto.randomUUID());
  const run = d.payroll_runs.find((r) => r.periode === period);
  let preview = [];
  let calculationError = "";
  if (!run)
    try {
      preview = d.drivers
        .filter(
          (e) => e.is_active !== false && (e.jabatan || "Sopir") !== "Sopir",
        )
        .map((e) =>
          payrollPreview(
            e,
            d.absens,
            d.kasbons,
            d.cicilans,
            period,
            holidays,
            cuts[e.id] || 0,
          ),
        );
    } catch (e) {
      calculationError = e.message;
    }
  const rows = run
    ? d.payroll_items.filter((i) => i.run_id === run.id)
    : preview;
  const finalise = async () => {
    setError("");
    try {
      const expected = Object.fromEntries(
        rows.map((r) => [
          r.employee_id,
          Object.fromEntries(
            [
              "gaji_pokok",
              "hari_kerja",
              "hari_absen",
              "tunjangan_hadir",
              "potongan_pinjaman",
              "total",
            ].map((k) => [k, r[k]]),
          ),
        ]),
      );
      await command(
        "payroll",
        {
          periode: period,
          tanggal: paymentDate,
          holidays,
          deductions: cuts,
          expected,
        },
        requestId,
      );
      setConfirm(false);
      setSlips(true);
    } catch (e) {
      setError(e.message);
    }
  };
  const changePeriod = (value) => {
    if (!value) return;
    setPeriod(value);
    setCuts({});
    setHolidays([]);
    setSlips(false);
    setRequestId(crypto.randomUUID());
    setError("");
  };
  return (
    <>
      <PageTitle
        title="Gajian & slip"
        subtitle="Hitung, periksa, lalu simpan payroll dalam satu transaksi."
      >
        <ExcelButton
          name={"gaji-" + period}
          columns={exportColumns}
          rows={rows}
          disabled={!rows.length || !!calculationError}
        />
        <Button
          variant="secondary"
          disabled={!rows.length || !!calculationError}
          onClick={() => downloadCSV("gaji-" + period, exportColumns, rows)}
        >
          <Download size={16} /> CSV
        </Button>
        {run && (
          <Button
            variant="secondary"
            onClick={() => {
              setSlips(true);
              setTimeout(() => window.print(), 100);
            }}
          >
            <Printer size={16} /> Cetak / PDF
          </Button>
        )}
      </PageTitle>
      <div className="toolbar">
        <label className="inline-field">
          Periode
          <input
            type="month"
            value={period}
            onChange={(e) => changePeriod(e.target.value)}
          />
        </label>
        <Badge tone={run ? "success" : "warning"}>
          {run ? "Payroll final tersimpan" : "Pratinjau · belum disimpan"}
        </Badge>
      </div>
      {!run && (
        <Panel
          title="Pengaturan perhitungan"
          subtitle="Hari Minggu otomatis dikecualikan. Tambahkan tanggal libur aktual agar tidak dihitung ganda."
        >
          <div className="panel-padding payroll-settings">
            <Field label="Tanggal pembayaran">
              {(id) => (
                <input
                  id={id}
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                />
              )}
            </Field>
            <Field label="Tanggal libur tambahan">
              {(id) => (
                <div className="input-action">
                  <input
                    id={id}
                    type="date"
                    value={holiday}
                    onChange={(e) => setHoliday(e.target.value)}
                  />
                  <Button
                    variant="secondary"
                    aria-label="Tambah tanggal libur"
                    onClick={() => {
                      if (
                        holiday.startsWith(period) &&
                        !holidays.includes(holiday)
                      ) {
                        setHolidays((h) => [...h, holiday].sort());
                        setHoliday("");
                        setError("");
                      } else
                        setError(
                          "Pilih tanggal libur dalam periode ini yang belum ditambahkan.",
                        );
                    }}
                  >
                    <Plus size={16} />
                  </Button>
                </div>
              )}
            </Field>
            <div className="holiday-list">
              {holidays.map((h) => (
                <span className="badge" key={h}>
                  {dateLabel(h)}
                  <button
                    aria-label={`Hapus libur ${h}`}
                    onClick={() => setHolidays((v) => v.filter((x) => x !== h))}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          </div>
        </Panel>
      )}
      <div className="stats-grid three">
        <Stat
          label="Total gaji diterima"
          value={money(rows.reduce((s, r) => s + Number(r.total), 0))}
          detail={`${rows.length} karyawan non-sopir`}
        />
        <Stat
          label="Potongan kasbon"
          value={money(
            rows.reduce((s, r) => s + Number(r.potongan_pinjaman), 0),
          )}
          detail={
            run
              ? "Sudah tercatat sebagai cicilan"
              : "Dicatat otomatis saat finalisasi"
          }
        />
        <Stat
          label="Hari kerja"
          value={
            run
              ? (rows[0]?.hari_kerja ?? 0)
              : workingDates(period, holidays).length
          }
          detail="Tidak termasuk Minggu dan libur"
        />
      </div>
      {(calculationError || error) && (
        <div className="notice error" role="alert">
          {calculationError || error}
        </div>
      )}
      <Panel
        title={run ? "Rincian payroll final" : "Periksa rincian gaji"}
        subtitle="Sopir digaji di luar aplikasi. Tunjangan kehadiran Rp70.000 per hari kerja."
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Hadir</th>
                <th className="numeric">Pokok</th>
                <th className="numeric">Tunjangan</th>
                <th className="numeric">Potongan kasbon</th>
                <th className="numeric">Diterima</th>
              </tr>
            </thead>
            <tbody>
              {(run
                ? rows
                : d.drivers
                    .filter(
                      (e) =>
                        e.is_active !== false &&
                        (e.jabatan || "Sopir") !== "Sopir",
                    )
                    .map(
                      (e) =>
                        rows.find((r) => r.employee_id === e.id) || {
                          employee_id: e.id,
                          driver_name: e.name,
                        },
                    )
              ).map((r) => (
                <tr key={r.employee_id}>
                  <td>
                    <strong>{r.driver_name}</strong>
                  </td>
                  <td>
                    {r.hari_kerja !== undefined
                      ? `${r.hari_kerja - r.hari_absen}/${r.hari_kerja}`
                      : "—"}
                  </td>
                  <td className="numeric">
                    {r.gaji_pokok !== undefined ? money(r.gaji_pokok) : "—"}
                  </td>
                  <td className="numeric">
                    {r.tunjangan_hadir !== undefined
                      ? money(r.tunjangan_hadir)
                      : "—"}
                  </td>
                  <td className="numeric">
                    {run ? (
                      money(r.potongan_pinjaman)
                    ) : (
                      <>
                        <input
                          className="deduction-input"
                          aria-label={`Potongan ${r.driver_name}`}
                          inputMode="numeric"
                          value={cuts[r.employee_id] || ""}
                          placeholder="0"
                          onChange={(e) =>
                            setCuts((c) => ({
                              ...c,
                              [r.employee_id]: e.target.value,
                            }))
                          }
                        />
                        {r.debt !== undefined && (
                          <small>Sisa {money(r.debt)}</small>
                        )}
                      </>
                    )}
                  </td>
                  <td className="numeric">
                    <strong>
                      {r.total !== undefined ? money(r.total) : "—"}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !calculationError && (
            <Empty title="Tidak ada karyawan non-sopir" />
          )}
        </div>
        <div className="panel-padding row-between">
          <p className="muted">
            {run
              ? `Dibayar ${dateLabel(run.tanggal)} · Data final tidak berubah ketika gaji pokok diperbarui.`
              : "Finalisasi mengunci absensi dan menyimpan slip permanen."}
          </p>
          {run ? (
            <Button variant="secondary" onClick={() => setSlips(!slips)}>
              {slips ? "Tutup slip" : "Lihat slip"}
            </Button>
          ) : (
            <Button
              disabled={disabled || !rows.length || !!calculationError}
              onClick={() => setConfirm(true)}
            >
              <Check size={17} /> Finalisasi payroll
            </Button>
          )}
        </div>
      </Panel>
      {run && slips && (
        <div className="slips-print">
          {rows.map((r) => (
            <Slip key={r.id} row={r} period={period} date={run.tanggal} />
          ))}
        </div>
      )}
      <Panel
        title="Riwayat periode"
        subtitle="Payroll baru dan catatan tanggal gajian dari aplikasi sebelumnya tetap tersedia."
      >
        <div className="list-stack">
          {d.payroll_runs
            .slice()
            .sort((a, b) => b.periode.localeCompare(a.periode))
            .map((r) => (
              <button
                className="list-row history-button"
                key={r.id}
                onClick={() => changePeriod(r.periode)}
              >
                <strong>{monthLabel(r.periode)}</strong>
                <span>
                  {dateLabel(r.tanggal)} <Badge tone="success">Final</Badge>
                </span>
              </button>
            ))}
          {d.gajian
            .slice()
            .sort((a, b) => b.tanggal.localeCompare(a.tanggal))
            .map((g) => (
              <div className="list-row" key={g.id}>
                <div>
                  <strong>Catatan gajian lama</strong>
                  <small>
                    {g.periode
                      ? monthLabel(g.periode)
                      : "Periode tidak dicatat pada aplikasi lama"}
                  </small>
                </div>
                <span>{dateLabel(g.tanggal)}</span>
              </div>
            ))}
        </div>
      </Panel>
      {confirm && (
        <Modal
          title="Finalisasi payroll?"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p className="modal-description">
            {monthLabel(period)} · {rows.length} karyawan · Total diterima{" "}
            <strong>{money(rows.reduce((s, r) => s + r.total, 0))}</strong>.
          </p>
          <p className="notice">
            Potongan kasbon akan dicatat sebagai pembayaran. Payroll dan absensi
            periode ini dikunci setelah berhasil. Periksa tanggal pembayaran{" "}
            {dateLabel(paymentDate)}.
          </p>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button
              disabled={busy}
              variant="secondary"
              onClick={() => setConfirm(false)}
            >
              Periksa lagi
            </Button>
            <Button
              disabled={busy || disabled || !!calculationError}
              onClick={finalise}
            >
              {busy ? "Menyimpan…" : "Ya, finalisasi"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
