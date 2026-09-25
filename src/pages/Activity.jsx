import { useState } from "react";
import { Download } from "lucide-react";
import { Button, Empty, PageTitle, Panel } from "../components/common.jsx";
import { downloadCSV, today } from "../lib/domain.js";
export default function Activity({ data: d }) {
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(50);
  const rows = d.audit_log
    .filter((r) =>
      (r.table_name + " " + r.action + " " + r.record_id)
        .toLowerCase()
        .includes(query.toLowerCase()),
    )
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <>
      <PageTitle
        title="Riwayat perubahan"
        subtitle="Catatan perubahan sejak pembaruan aplikasi. Data lama tetap tersedia pada masing-masing modul."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCSV(
              "aktivitas-" + today(),
              [
                { key: "created_at", label: "Waktu" },
                { key: "table_name", label: "Modul" },
                { key: "record_id", label: "ID catatan" },
                { key: "action", label: "Aksi" },
              ],
              rows,
            )
          }
        >
          <Download size={16} /> CSV
        </Button>
      </PageTitle>
      <div className="notice">
        Aplikasi digunakan tanpa login. Riwayat ini mencatat perubahan data,
        tetapi tidak dapat memastikan identitas orang yang melakukannya.
      </div>
      <div className="toolbar">
        <input
          aria-label="Cari aktivitas"
          placeholder="Cari modul, aksi, atau ID…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <Panel
        title="Log aktivitas"
        subtitle={`${rows.length} perubahan tercatat`}
      >
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Waktu (WIB)</th>
                <th>Modul</th>
                <th>Aksi</th>
                <th>Referensi</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr key={r.id}>
                  <td>
                    {new Date(r.created_at).toLocaleString("id-ID", {
                      timeZone: "Asia/Jakarta",
                    })}
                  </td>
                  <td>{r.table_name}</td>
                  <td>{r.action}</td>
                  <td>{r.record_id.slice(0, 8)}</td>
                  <td>
                    <details>
                      <summary>Lihat perubahan</summary>
                      <pre>
                        {JSON.stringify(
                          { sebelum: r.before_data, sesudah: r.after_data },
                          null,
                          2,
                        )}
                      </pre>
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && <Empty title="Belum ada perubahan baru" />}
        </div>
        {rows.length > limit && (
          <div className="panel-padding">
            <Button variant="secondary" onClick={() => setLimit((n) => n + 50)}>
              Muat lebih banyak
            </Button>
          </div>
        )}
      </Panel>
    </>
  );
}
