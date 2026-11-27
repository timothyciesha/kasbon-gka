import ExcelButton from "../components/ExcelButton.jsx";
import { useState } from "react";
import { Download, Plus } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  PageTitle,
  Panel,
} from "../components/common.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import {
  addDays,
  dateLabel,
  downloadCSV,
  monthLabel,
  today,
} from "../lib/domain.js";
export default function Attendance({ data: d, command, busy, disabled }) {
  const [period, setPeriod] = useState(today().slice(0, 7));
  const [modal, setModal] = useState(null);
  const lastPayroll = d.payroll_runs
    .slice()
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal))[0];
  const cutoff = lastPayroll?.tanggal;
  const openSince = cutoff ? addDays(cutoff) : null;
  const rows = d.absens
    .filter((a) => a.tanggal.startsWith(period))
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
  return (
    <>
      <PageTitle
        title="Absensi karyawan"
        subtitle="Catat ketidakhadiran tanpa menghilangkan riwayat periode lama."
      >
        <Button disabled={disabled} onClick={() => setModal({ type: "add" })}>
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
          <Badge tone="success">
            {openSince
              ? `Terbuka sejak ${dateLabel(openSince)}`
              : "Pencatatan terbuka"}
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
        </div>
      </div>
      <div className="notice">
        {cutoff
          ? `Payroll terakhir mengunci absensi sampai ${dateLabel(cutoff)}. Absensi setelah tanggal tersebut tetap dapat dicatat dan masuk ke payroll berikutnya.`
          : "Belum ada payroll final. Seluruh absensi dapat dicatat sesuai tanggal kejadian."}
      </div>
      <Panel
        title={monthLabel(period)}
        subtitle={`${rows.filter((r) => !r.voided_at).length} catatan ketidakhadiran`}
      >
        <div className="table-wrap">
          <table className="responsive">
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
                  <td className="cell-title">
                    <strong>{a.driver_name}</strong>
                  </td>
                  <td data-label="Tanggal">{dateLabel(a.tanggal)}</td>
                  <td data-label="Jenis">{a.kind || "Tidak hadir"}</td>
                  <td data-label="Catatan">{a.note || "—"}</td>
                  <td data-label="Status">
                    <Badge tone={a.voided_at ? "danger" : "neutral"}>
                      {a.voided_at ? "Dibatalkan" : "Tercatat"}
                    </Badge>
                    {a.void_reason && <small>{a.void_reason}</small>}
                  </td>
                  <td className="cell-action">
                    {!a.voided_at && (!cutoff || a.tanggal > cutoff) && (
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
            tanggal: today(),
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
            {
              key: "tanggal",
              label: "Tanggal",
              type: "date",
              min: openSince || undefined,
              max: today(),
            },
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
    </>
  );
}
