import {
  Wallet,
  Users,
  Building2,
  ArrowDownLeft,
  Plus,
  CalendarDays,
} from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  LinkButton,
  PageTitle,
  Panel,
  Progress,
  Stat,
} from "../components/common.jsx";
import {
  dateLabel,
  dayDiff,
  invoiceRemaining,
  money,
  remaining,
  today,
} from "../lib/domain.js";
export default function Dashboard({ data: d, navigate }) {
  const loans = d.kasbons.filter((k) => k.is_active);
  const invoices = d.supplier_tagihan
    .filter((t) => !t.is_lunas)
    .sort((a, b) => a.jatuh_tempo.localeCompare(b.jatuh_tempo));
  const month = today().slice(0, 7);
  const payments = d.cicilans.filter(
    (c) => !c.voided_at && c.tanggal.startsWith(month),
  );
  const recent = [
    ...d.cicilans.map((c) => ({
      ...c,
      kind: "Pembayaran kasbon",
      name: d.kasbons.find((k) => k.id === c.kasbon_id)?.driver_name,
    })),
    ...d.supplier_bayar.map((c) => ({
      ...c,
      kind: "Pembayaran supplier",
      name: d.suppliers.find(
        (s) =>
          s.id ===
          d.supplier_tagihan.find((t) => t.id === c.tagihan_id)?.supplier_id,
      )?.name,
    })),
  ]
    .sort(
      (a, b) =>
        b.tanggal.localeCompare(a.tanggal) ||
        String(b.created_at).localeCompare(String(a.created_at)),
    )
    .slice(0, 6);
  return (
    <>
      <PageTitle
        title="Ringkasan operasional"
        subtitle="Semua catatan keuangan, dalam satu tempat."
      >
        <Button onClick={() => navigate("kasbon")}>
          <Plus size={17} /> Catat kasbon
        </Button>
      </PageTitle>
      <div className="welcome-banner">
        <div>
          <Badge tone="light">GKA GROUP</Badge>
          <h2>
            Catatan rapi.
            <br />
            Operasional lebih pasti.
          </h2>
          <p>Pantau kasbon karyawan dan kewajiban supplier Anda.</p>
        </div>
        <div className="banner-date">
          <CalendarDays size={25} />
          <strong>{dateLabel(today())}</strong>
          <span>Waktu Indonesia Barat</span>
        </div>
        <div className="banner-orbit" />
      </div>
      <div className="stats-grid">
        <Stat
          label="Sisa kasbon"
          value={money(loans.reduce((s, k) => s + remaining(k, d.cicilans), 0))}
          detail={`${loans.length} kasbon aktif`}
          icon={Wallet}
        />
        <Stat
          label="Pembayaran bulan ini"
          value={money(payments.reduce((s, c) => s + Number(c.nominal), 0))}
          detail="Penerimaan cicilan kasbon"
          icon={ArrowDownLeft}
          tone="green"
        />
        <Stat
          label="Hutang supplier"
          value={money(
            invoices.reduce(
              (s, t) => s + invoiceRemaining(t, d.supplier_bayar),
              0,
            ),
          )}
          detail={`${invoices.length} tagihan belum lunas`}
          icon={Building2}
        />
        <Stat
          label="Karyawan aktif"
          value={d.drivers.filter((e) => e.is_active !== false).length}
          detail="Terdaftar dalam operasional"
          icon={Users}
        />
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Kasbon yang berjalan"
          subtitle="Saldo terkini per pinjaman"
          action={
            <LinkButton onClick={() => navigate("kasbon")}>
              Lihat semua
            </LinkButton>
          }
        >
          {!loans.length ? (
            <Empty title="Tidak ada kasbon aktif" />
          ) : (
            loans.slice(0, 5).map((k) => {
              const balance = remaining(k, d.cicilans);
              return (
                <div className="loan-summary" key={k.id}>
                  <div className="row-between">
                    <div className="person">
                      <span className="avatar">
                        {k.driver_name.slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <strong>{k.driver_name}</strong>
                        <small>{dateLabel(k.tanggal_kasbon)}</small>
                      </div>
                    </div>
                    <div className="align-right">
                      <strong>{money(balance)}</strong>
                      <small>Sisa pembayaran</small>
                    </div>
                  </div>
                  <Progress
                    value={k.total_potong - balance}
                    total={k.total_potong}
                  />
                </div>
              );
            })
          )}
        </Panel>
        <Panel
          title="Jatuh tempo supplier"
          subtitle="Prioritaskan pembayaran terdekat"
          action={
            <LinkButton onClick={() => navigate("supplier")}>Detail</LinkButton>
          }
        >
          {!invoices.length ? (
            <Empty title="Semua tagihan selesai" />
          ) : (
            invoices.slice(0, 5).map((t) => {
              const days = dayDiff(t.jatuh_tempo, today());
              return (
                <div className="list-row" key={t.id}>
                  <div>
                    <strong>
                      {d.suppliers.find((s) => s.id === t.supplier_id)?.name ||
                        "Supplier"}
                    </strong>
                    <small>
                      {dateLabel(t.jatuh_tempo)} · {t.keterangan || "Tagihan"}
                    </small>
                  </div>
                  <div className="align-right">
                    <strong>
                      {money(invoiceRemaining(t, d.supplier_bayar))}
                    </strong>
                    <Badge
                      tone={
                        days < 0 ? "danger" : days <= 3 ? "warning" : "neutral"
                      }
                    >
                      {days < 0
                        ? `Lewat ${-days} hari`
                        : days === 0
                          ? "Hari ini"
                          : `${days} hari lagi`}
                    </Badge>
                  </div>
                </div>
              );
            })
          )}
        </Panel>
      </div>
      <Panel
        title="Aktivitas pembayaran"
        subtitle="Kasbon dan supplier terbaru"
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaksi</th>
                <th>Nama</th>
                <th>Tanggal</th>
                <th>Status</th>
                <th className="numeric">Nominal</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id}>
                  <td>{r.kind}</td>
                  <td>
                    <strong>{r.name || "—"}</strong>
                  </td>
                  <td>{dateLabel(r.tanggal)}</td>
                  <td>
                    <Badge tone={r.voided_at ? "danger" : "success"}>
                      {r.voided_at ? "Dibatalkan" : "Tercatat"}
                    </Badge>
                  </td>
                  <td className="numeric">{money(r.nominal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!recent.length && <Empty />}
        </div>
      </Panel>
    </>
  );
}
