import ExcelButton from "../components/ExcelButton.jsx";
import { useState } from "react";
import { Archive, Download, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  PageTitle,
  Panel,
} from "../components/common.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import { dateLabel, downloadCSV, monthLabel, today } from "../lib/domain.js";
export default function Attendance({ data: d, command, busy, disabled }) {
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [modal, setModal] = useState(null);
  const closed = d.attendance_periods.some(
    (p) => p.periode === period && p.closed_at,
  );
  const rows = d.absens
    .filter((a) => a.tanggal.startsWith(period))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return (
    <>
      <PageTitle
        title="Absensi karyawan"
        subtitle="Catat ketidakhadiran tanpa menghilangkan riwayat periode lama."
      >
        <Button
          disabled={disabled || closed}
          onClick={() => setModal({ type: "add" })}
        >
          <Plus size={17} /> Catat absen
        </Button>
      </PageTitle>
      <div className="toolbar">
        <label className="inline-field">
          Periode
          <input
            type="month"
            value={period}
            onChange={(e) => e.target.value && setPeriod(e.target.value)}
          />
        </label>
        <div className="actions">
          <Badge tone={closed ? "neutral" : "success"}>
            {closed ? "Periode ditutup" : "Periode terbuka"}
          </Badge>
          <ExcelButton
            name={"absensi-" + period}
            columns={[
              { key: "driver_name", label: "Karyawan" },
              { key: "tanggal", label: "Tanggal" },
              { key: "kind", label: "Jenis" },
              { key: "void_reason", label: "Alasan pembatalan" },
            ]}
            rows={rows}
          />
          <Button
            variant="secondary"
            onClick={() =>
              downloadCSV(
                "absensi-" + period,
                [
                  { key: "driver_name", label: "Karyawan" },
                  { key: "tanggal", label: "Tanggal" },
                  { key: "kind", label: "Jenis" },
                  { key: "note", label: "Catatan" },
                  { key: "void_reason", label: "Alasan pembatalan" },
                ],
                rows,
              )
            }
          >
            <Download size={16} /> CSV
          </Button>
          <Button
            disabled={disabled || closed}
            variant="secondary"
            onClick={() => setModal({ type: "close" })}
          >
            <Archive size={16} /> Tutup periode
          </Button>
        </div>
      </div>
      <div className="notice">
        Hari Minggu dan tanggal libur yang dipilih pada payroll tidak mengurangi
        tunjangan lagi. Semua jenis ketidakhadiran pada hari kerja mengurangi
        tunjangan hadir sesuai aturan saat ini.
      </div>
      <Panel
        title={monthLabel(period)}
        subtitle={`${rows.filter((r) => !r.voided_at).length} catatan ketidakhadiran`}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Karyawan</th>
                <th>Tanggal</th>
                <th>Jenis</th>
                <th>Catatan</th>
                <th>Status</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td>
                    <strong>{a.driver_name}</strong>
                  </td>
                  <td>{dateLabel(a.tanggal)}</td>
                  <td>{a.kind || "Tidak hadir"}</td>
                  <td>{a.note || "—"}</td>
                  <td>
                    <Badge tone={a.voided_at ? "danger" : "neutral"}>
                      {a.voided_at ? "Dibatalkan" : "Tercatat"}
                    </Badge>
                    {a.void_reason && <small>{a.void_reason}</small>}
                  </td>
                  <td>
                    {!a.voided_at && !closed && (
                      <Button
                        disabled={disabled}
                        variant="ghost"
                        onClick={() => setModal({ type: "void", row: a })}
                      >
                        Batalkan
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && (
            <Empty
              title="Belum ada ketidakhadiran"
              text="Pilih periode lain untuk melihat arsip, atau catat absen baru."
            />
          )}
        </div>
      </Panel>
      {modal?.type === "add" && (
        <TransactionForm
          title="Catat ketidakhadiran"
          initial={{
            tanggal: period === today().slice(0, 7) ? today() : period + "-01",
            kind: "Tidak hadir",
          }}
          fields={[
            {
              key: "employee_id",
              label: "Karyawan",
              options: d.drivers
                .filter((e) => e.is_active !== false)
                .map((e) => ({ value: e.id, label: e.name })),
            },
            { key: "tanggal", label: "Tanggal", type: "date" },
            {
              key: "kind",
              label: "Jenis",
              options: ["Tidak hadir", "Izin", "Sakit", "Cuti"].map((v) => ({
                value: v,
                label: v,
              })),
            },
            { key: "note", label: "Catatan", required: false },
          ]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) => command("absence", body, id)}
        />
      )}
      {modal?.type === "void" && (
        <TransactionForm
          title="Batalkan catatan absen"
          fields={[{ key: "reason", label: "Alasan pembatalan" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            command("void_absence", { ...body, id: modal.row.id }, id)
          }
        />
      )}
      {modal?.type === "close" && (
        <TransactionForm
          title={`Tutup ${monthLabel(period)}`}
          fields={[{ key: "reason", label: "Catatan penutupan" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            command("close_attendance", { ...body, periode: period }, id)
          }
        >
          <p className="notice">
            Tidak ada data yang dihapus. Setelah ditutup, absensi periode ini
            terkunci dan tetap dapat digunakan untuk payroll.
          </p>
        </TransactionForm>
      )}
    </>
  );
}
