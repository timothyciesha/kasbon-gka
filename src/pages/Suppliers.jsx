import ExcelButton from "../components/ExcelButton.jsx";
import { useState } from "react";
import { Download, Plus, Search } from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  PageTitle,
  Panel,
  Stat,
} from "../components/common.jsx";
import TransactionForm from "../components/TransactionForm.jsx";
import {
  dateLabel,
  dayDiff,
  downloadCSV,
  invoiceRemaining,
  money,
  today,
} from "../lib/domain.js";
export default function Suppliers({ data: d, command, busy, disabled }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("aktif");
  const [modal, setModal] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const supplierName = (id) =>
    d.suppliers.find((s) => s.id === id)?.name || "Supplier";
  const rows = d.supplier_tagihan
    .filter(
      (t) =>
        (supplierName(t.supplier_id) + " " + (t.keterangan || ""))
          .toLowerCase()
          .includes(query.toLowerCase()) &&
        (status === "semua" ||
          (status === "lunas"
            ? t.is_lunas
            : status === "overdue"
              ? !t.is_lunas && t.jatuh_tempo < today()
              : !t.is_lunas)),
    )
    .sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  return (
    <>
      <PageTitle
        title="Tagihan supplier"
        subtitle="Pantau kewajiban, jatuh tempo, dan bukti pembayaran."
      >
        <Button
          disabled={disabled}
          variant="secondary"
          onClick={() => setModal({ type: "supplier" })}
        >
          <Plus size={16} /> Supplier
        </Button>
        <Button
          disabled={disabled || !d.suppliers.length}
          onClick={() => setModal({ type: "invoice" })}
        >
          <Plus size={16} /> Tagihan
        </Button>
      </PageTitle>
      <div className="stats-grid three">
        <Stat
          label="Belum terbayar"
          value={money(
            d.supplier_tagihan
              .filter((t) => !t.is_lunas)
              .reduce((s, t) => s + invoiceRemaining(t, d.supplier_bayar), 0),
          )}
          detail="Seluruh tagihan aktif"
        />
        <Stat
          label="Lewat jatuh tempo"
          value={
            d.supplier_tagihan.filter(
              (t) => !t.is_lunas && t.jatuh_tempo < today(),
            ).length
          }
          detail="Tagihan perlu diprioritaskan"
        />
        <Stat
          label="Supplier terdaftar"
          value={d.suppliers.length}
          detail="Mitra operasional"
        />
      </div>
      <div className="toolbar">
        <label className="search">
          <Search size={18} />
          <input
            aria-label="Cari supplier atau tagihan"
            placeholder="Cari supplier atau tagihan…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="Filter tagihan"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="aktif">Belum lunas</option>
          <option value="overdue">Lewat jatuh tempo</option>
          <option value="lunas">Lunas</option>
          <option value="semua">Semua tagihan</option>
        </select>
        <ExcelButton
          name={"supplier-" + today()}
          columns={[
            { key: "supplier", label: "Supplier" },
            { key: "keterangan", label: "Tagihan" },
            { key: "nominal", label: "Nominal" },
            { key: "sisa", label: "Sisa" },
          ]}
          rows={rows.map((t) => ({
            ...t,
            supplier: supplierName(t.supplier_id),
            sisa: invoiceRemaining(t, d.supplier_bayar),
          }))}
        />
        <Button
          variant="secondary"
          onClick={() =>
            downloadCSV(
              "tagihan-" + today(),
              [
                { key: "supplier", label: "Supplier" },
                { key: "keterangan", label: "Tagihan" },
                { key: "jatuh_tempo", label: "Jatuh tempo" },
                { key: "nominal", label: "Nominal" },
                { key: "sisa", label: "Sisa" },
              ],
              rows.map((t) => ({
                ...t,
                supplier: supplierName(t.supplier_id),
                sisa: invoiceRemaining(t, d.supplier_bayar),
              })),
            )
          }
        >
          <Download size={16} /> CSV
        </Button>
      </div>
      {!rows.length && <Empty title="Tidak ada tagihan pada filter ini" />}
      {rows.map((t) => {
        const balance = invoiceRemaining(t, d.supplier_bayar);
        const days = dayDiff(t.jatuh_tempo, today());
        const payments = d.supplier_bayar
          .filter((b) => b.tagihan_id === t.id)
          .sort((a, b) => b.tanggal.localeCompare(a.tanggal));
        return (
          <Panel
            key={t.id}
            title={supplierName(t.supplier_id)}
            subtitle={`${t.keterangan || "Tagihan"} · Jatuh tempo ${dateLabel(t.jatuh_tempo)}`}
            action={
              <Badge
                tone={
                  t.is_lunas
                    ? "success"
                    : days < 0
                      ? "danger"
                      : days <= 3
                        ? "warning"
                        : "neutral"
                }
              >
                {t.is_lunas
                  ? "Lunas"
                  : days < 0
                    ? `Lewat ${-days} hari`
                    : days === 0
                      ? "Jatuh tempo hari ini"
                      : `${days} hari lagi`}
              </Badge>
            }
          >
            <div className="panel-padding row-between">
              <div>
                <small>Sisa tagihan dari {money(t.nominal)}</small>
                <h2>{money(balance)}</h2>
              </div>
              <div className="actions">
                <Button
                  variant="secondary"
                  onClick={() => setExpanded(expanded === t.id ? null : t.id)}
                >
                  {expanded === t.id
                    ? "Tutup riwayat"
                    : `Riwayat (${payments.length})`}
                </Button>
                {!t.is_lunas && (
                  <Button
                    disabled={disabled}
                    onClick={() => setModal({ type: "payment", row: t })}
                  >
                    Catat pembayaran
                  </Button>
                )}
              </div>
            </div>
            {expanded === t.id && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Catatan / referensi</th>
                      <th className="numeric">Nominal</th>
                      <th>Status</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((b) => (
                      <tr key={b.id}>
                        <td>{dateLabel(b.tanggal)}</td>
                        <td>
                          {b.note || "—"}
                          <small>{b.id.slice(0, 8)}</small>
                        </td>
                        <td className="numeric">{money(b.nominal)}</td>
                        <td>
                          <Badge tone={b.voided_at ? "danger" : "success"}>
                            {b.voided_at ? "Dibatalkan" : "Tercatat"}
                          </Badge>
                          {b.void_reason && <small>{b.void_reason}</small>}
                        </td>
                        <td>
                          {!b.voided_at && (
                            <Button
                              disabled={disabled}
                              variant="ghost"
                              onClick={() => setModal({ type: "void", row: b })}
                            >
                              Batalkan
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!payments.length && <Empty />}
              </div>
            )}
          </Panel>
        );
      })}
      <Panel
        title="Daftar supplier"
        subtitle="Nama yang tersedia saat membuat tagihan"
      >
        <div className="supplier-list">
          {d.suppliers.map((s) => (
            <Badge key={s.id}>{s.name}</Badge>
          ))}
          {!d.suppliers.length && <Empty title="Tambahkan supplier pertama" />}
        </div>
      </Panel>
      {modal?.type === "supplier" && (
        <TransactionForm
          title="Tambah supplier"
          fields={[{ key: "name", label: "Nama supplier" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) => command("supplier", body, id)}
        />
      )}
      {modal?.type === "invoice" && (
        <TransactionForm
          title="Tambah tagihan"
          initial={{ jatuh_tempo: today() }}
          fields={[
            {
              key: "supplier_id",
              label: "Supplier",
              options: d.suppliers.map((s) => ({ value: s.id, label: s.name })),
            },
            { key: "keterangan", label: "Nomor invoice / keterangan" },
            {
              key: "nominal",
              label: "Nominal tagihan (rupiah)",
              type: "money",
            },
            { key: "jatuh_tempo", label: "Jatuh tempo", type: "date" },
          ]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) => command("invoice", body, id)}
        />
      )}
      {modal?.type === "payment" && (
        <TransactionForm
          title="Pembayaran supplier"
          balance={invoiceRemaining(modal.row, d.supplier_bayar)}
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
            command(
              "supplier_payment",
              { ...body, tagihan_id: modal.row.id },
              id,
            )
          }
        />
      )}
      {modal?.type === "void" && (
        <TransactionForm
          title="Batalkan pembayaran supplier"
          fields={[{ key: "reason", label: "Alasan pembatalan" }]}
          busy={busy}
          onClose={() => setModal(null)}
          onSubmit={(body, id) =>
            command(
              "void_payment",
              { ...body, id: modal.row.id, kind: "supplier" },
              id,
            )
          }
        />
      )}
    </>
  );
}
