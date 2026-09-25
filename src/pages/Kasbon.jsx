import ExcelButton from "../components/ExcelButton.jsx";
import { useState } from "react";
import {
  Plus,
  Search,
  ArrowLeft,
  Download,
  Pencil,
  Archive,
} from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  PageTitle,
  Panel,
  Progress,
  Stat,
} from "../components/common.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import {
  belongs,
  dateLabel,
  downloadCSV,
  feeFor,
  lastSettlement,
  money,
  remaining,
  today,
} from "../lib/domain.js";
const columns = [
  { key: "driver_name", label: "Karyawan" },
  { key: "tanggal_kasbon", label: "Tanggal" },
  { key: "nominal", label: "Nominal" },
  { key: "fee", label: "Admin" },
  { key: "sisa", label: "Sisa" },
  { key: "status", label: "Status" },
];
export default function Kasbon({ data: d, command, busy, disabled }) {
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("aktif");
  const [modal, setModal] = useState(null);
  const employee = d.drivers.find((e) => e.id === selected);
  const loans = employee
    ? d.kasbons
        .filter((k) => belongs(k, employee))
        .sort((a, b) => b.tanggal_kasbon.localeCompare(a.tanggal_kasbon))
    : d.kasbons;
  const active = loans.find((k) => k.is_active);
  const settlement = employee ? lastSettlement(d.kasbons, employee) : null;
  const employees = d.drivers.filter(
    (e) =>
      e.name.toLowerCase().includes(query.toLowerCase()) &&
      (filter === "semua" ||
        (filter === "nonaktif"
          ? e.is_active === false
          : e.is_active !== false)),
  );
  const exportRows = () =>
    downloadCSV(
      "rekap-kasbon-" + today(),
      columns,
      loans.map((k) => ({
        ...k,
        sisa: remaining(k, d.cicilans),
        status: k.is_active ? "Aktif" : "Lunas",
      })),
    );
  const save = (action) => (body, id) => command(action, body, id);
  return (
    <>
      <PageTitle
        title={employee ? employee.name : "Kasbon & karyawan"}
        subtitle={
          employee
            ? `${employee.jabatan || "Sopir"} · Riwayat pinjaman dan pembayaran`
            : "Kelola pinjaman, pembayaran, dan data karyawan."
        }
      >
        <ExcelButton
          name={"kasbon-" + today()}
          columns={columns}
          rows={loans.map((k) => ({
            ...k,
            sisa: remaining(k, d.cicilans),
            status: k.is_active ? "Aktif" : "Lunas",
          }))}
        />
        <Button variant="secondary" onClick={exportRows}>
          <Download size={16} /> Ekspor CSV
        </Button>
        {!employee && (
          <Button
            disabled={disabled}
            onClick={() => setModal({ type: "employee" })}
          >
            <Plus size={17} /> Karyawan
          </Button>
        )}
      </PageTitle>
      {employee ? (
        <>
          <div className="toolbar">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              <ArrowLeft size={16} /> Semua karyawan
            </Button>
            <div className="actions">
              <Badge
                tone={employee.is_active === false ? "neutral" : "success"}
              >
                {employee.is_active === false ? "Nonaktif" : "Aktif"}
              </Badge>
              <Button
                disabled={disabled}
                variant="secondary"
                onClick={() => setModal({ type: "employee", row: employee })}
              >
                <Pencil size={15} /> Edit
              </Button>
              <Button
                disabled={disabled || !!active}
                variant="secondary"
                onClick={() => setModal({ type: "archive", row: employee })}
              >
                <Archive size={15} />
                {employee.is_active === false ? "Aktifkan" : "Nonaktifkan"}
              </Button>
            </div>
          </div>
          <div className="stats-grid three">
            <Stat
              label="Gaji pokok"
              value={money(employee.gaji_pokok ?? 4000000)}
              detail="Gaji bulanan"
            />
            <Stat
              label="Sisa kasbon"
              value={money(
                loans
                  .filter((k) => k.is_active)
                  .reduce((s, k) => s + remaining(k, d.cicilans), 0),
              )}
              detail={
                active
                  ? "Pembayaran dapat dicatat di bawah"
                  : "Tidak ada pinjaman aktif"
              }
            />
            <Stat
              label="Riwayat selesai"
              value={loans.filter((k) => !k.is_active).length}
              detail={`Pelunasan terakhir: ${dateLabel(settlement)}`}
            />
          </div>
          {!active && employee.is_active !== false && (
            <div className="notice row-between">
              <span>
                Kasbon baru tersedia. Admin Rp50.000 berlaku jika kurang dari 30
                hari setelah lunas.
              </span>
              <Button
                disabled={disabled}
                onClick={() => setModal({ type: "loan" })}
              >
                <Plus size={16} /> Kasbon baru
              </Button>
            </div>
          )}
          {!loans.length && <Empty title="Belum ada pinjaman" />}
          {loans.map((k) => {
            const balance = remaining(k, d.cicilans);
            const payments = d.cicilans
              .filter((c) => c.kasbon_id === k.id)
              .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
            return (
              <Panel
                key={k.id}
                title={`Kasbon ${dateLabel(k.tanggal_kasbon)}`}
                subtitle={`Pokok ${money(k.nominal)} · Admin ${money(k.fee)} · Ref ${k.id.slice(0, 8)}`}
                action={
                  <Badge tone={k.is_active ? "warning" : "success"}>
                    {k.is_active ? "Aktif" : "Lunas"}
                  </Badge>
                }
              >
                <div className="panel-padding">
                  <div className="row-between">
                    <div>
                      <small>Sisa pembayaran</small>
                      <h2>{money(balance)}</h2>
                    </div>
                    {k.is_active && (
                      <Button
                        disabled={disabled}
                        onClick={() => setModal({ type: "payment", row: k })}
                      >
                        <Plus size={16} /> Catat pembayaran
                      </Button>
                    )}
                  </div>
                  <Progress
                    value={k.total_potong - balance}
                    total={k.total_potong}
                  />
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>Catatan / referensi</th>
                        <th>Status</th>
                        <th className="numeric">Nominal</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((c) => (
                        <tr key={c.id}>
                          <td>{dateLabel(c.tanggal)}</td>
                          <td>
                            {c.note ||
                              (c.payroll_run_id
                                ? "Potongan payroll"
                                : "Pembayaran kasbon")}
                            <small>{c.id.slice(0, 8)}</small>
                          </td>
                          <td>
                            <Badge tone={c.voided_at ? "danger" : "success"}>
                              {c.voided_at ? "Dibatalkan" : "Tercatat"}
                            </Badge>
                            {c.void_reason && <small>{c.void_reason}</small>}
                          </td>
                          <td className="numeric">{money(c.nominal)}</td>
                          <td>
                            {!c.voided_at && !c.payroll_run_id && (
                              <Button
                                disabled={disabled}
                                variant="ghost"
                                onClick={() =>
                                  setModal({ type: "void", row: c })
                                }
                              >
                                Batalkan
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!payments.length && <Empty title="Belum ada pembayaran" />}
                </div>
              </Panel>
            );
          })}
        </>
      ) : (
        <>
          <div className="toolbar">
            <label className="search">
              <Search size={18} />
              <input
                aria-label="Cari karyawan"
                placeholder="Cari nama karyawan…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <select
              aria-label="Status karyawan"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="aktif">Karyawan aktif</option>
              <option value="nonaktif">Karyawan nonaktif</option>
              <option value="semua">Semua karyawan</option>
            </select>
          </div>
          <div className="employee-grid">
            {employees.map((e) => {
              const records = d.kasbons.filter((k) => belongs(k, e));
              const outstanding = records
                .filter((k) => k.is_active)
                .reduce((s, k) => s + remaining(k, d.cicilans), 0);
              return (
                <button
                  className="employee-card"
                  key={e.id}
                  onClick={() => setSelected(e.id)}
                >
                  <div className="row-between">
                    <span className="avatar large">
                      {e.name.slice(0, 2).toUpperCase()}
                    </span>
                    <Badge
                      tone={
                        outstanding
                          ? "warning"
                          : e.is_active === false
                            ? "neutral"
                            : "success"
                      }
                    >
                      {outstanding
                        ? "Ada kasbon"
                        : e.is_active === false
                          ? "Nonaktif"
                          : "Tidak ada kasbon"}
                    </Badge>
                  </div>
                  <h3>{e.name}</h3>
                  <p>{e.jabatan || "Sopir"}</p>
                  <div className="card-footer">
                    <span>Sisa kasbon</span>
                    <strong>{money(outstanding)}</strong>
                  </div>
                </button>
              );
            })}
          </div>
          {!employees.length && <Empty title="Karyawan tidak ditemukan" />}
        </>
      )}
      {modal?.type === "employee" && (
        <TransactionForm
          title={modal.row ? "Edit karyawan" : "Tambah karyawan"}
          initial={modal.row || { jabatan: "Sopir", gaji_pokok: 4000000 }}
          fields={[
            { key: "name", label: "Nama lengkap" },
            {
              key: "jabatan",
              label: "Jabatan",
              options: ["Sopir", "Sales", "Admin", "Kolektor"].map((v) => ({
                value: v,
                label: v,
              })),
            },
            {
              key: "gaji_pokok",
              label: "Gaji pokok (rupiah)",
              type: "money",
              allowZero: true,
            },
          ]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            save("employee")({ ...body, id: modal.row?.id }, id)
          }
        />
      )}
      {modal?.type === "archive" && (
        <TransactionForm
          title={
            employee.is_active === false
              ? "Aktifkan karyawan"
              : "Nonaktifkan karyawan"
          }
          fields={[{ key: "reason", label: "Alasan perubahan" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            save("employee_status")(
              {
                ...body,
                id: employee.id,
                is_active: employee.is_active === false,
              },
              id,
            )
          }
        >
          <p className="notice">
            Seluruh riwayat kasbon dan gaji tetap tersimpan.
          </p>
        </TransactionForm>
      )}
      {modal?.type === "loan" && (
        <TransactionForm
          title={`Kasbon baru · ${employee.name}`}
          fields={[
            { key: "nominal", label: "Nominal kasbon (rupiah)", type: "money" },
            { key: "tanggal", label: "Tanggal kasbon", type: "date" },
          ]}
          fee={(v) => feeFor(settlement, v.tanggal)}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            save("loan")({ ...body, employee_id: employee.id }, id)
          }
        />
      )}
      {modal?.type === "payment" && (
        <TransactionForm
          title={`Pembayaran · ${employee.name}`}
          balance={remaining(modal.row, d.cicilans)}
          fields={[
            {
              key: "nominal",
              label: "Nominal pembayaran (rupiah)",
              type: "money",
            },
            { key: "tanggal", label: "Tanggal pembayaran", type: "date" },
            {
              key: "note",
              label: "Catatan / referensi transfer",
              required: false,
            },
          ]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            save("loan_payment")({ ...body, kasbon_id: modal.row.id }, id)
          }
        />
      )}
      {modal?.type === "void" && (
        <TransactionForm
          title="Batalkan pembayaran"
          fields={[{ key: "reason", label: "Alasan pembatalan" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            save("void_payment")(
              { ...body, id: modal.row.id, kind: "kasbon" },
              id,
            )
          }
        >
          <div className="notice">
            Pembayaran {money(modal.row.nominal)} akan dibatalkan dan saldo
            dihitung ulang. Catatan asli tetap tersedia.
          </div>
        </TransactionForm>
      )}
    </>
  );
}
