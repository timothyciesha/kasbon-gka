import { useRef, useState } from "react";
import {
  Activity as ActivityIcon,
  Building2,
  CalendarCheck,
  LayoutDashboard,
  RefreshCw,
  Wallet,
  Banknote,
  Menu,
  X,
  ArrowUpRight,
  LogOut,
} from "lucide-react";
import { useData } from "./hooks/useData.js";
import { useAuth } from "./hooks/useAuth.js";
import { db } from "./lib/api.js";
import { dateLabel, today } from "./lib/domain.js";
import { Button } from "./components/common.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Kasbon from "./pages/Kasbon.jsx";
import Attendance from "./pages/Attendance.jsx";
import Payroll from "./pages/Payroll.jsx";
import Suppliers from "./pages/Suppliers.jsx";
import Activity from "./pages/Activity.jsx";
import Login from "./components/Login.jsx";
const nav = [
  {
    id: "dashboard",
    label: "Ringkasan",
    icon: LayoutDashboard,
    page: Dashboard,
  },
  {
    id: "kasbon",
    label: "Kasbon & karyawan",
    short: "Kasbon",
    icon: Wallet,
    page: Kasbon,
  },
  { id: "absen", label: "Absensi", icon: CalendarCheck, page: Attendance },
  { id: "gajian", label: "Gajian", icon: Banknote, page: Payroll },
  { id: "supplier", label: "Supplier", icon: Building2, page: Suppliers },
  { id: "activity", label: "Aktivitas", icon: ActivityIcon, page: Activity },
];
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const lock = useRef(false);
  const timer = useRef(null);
  const auth = useAuth();
  const { data, errors, loading, updatedAt, refresh } = useData(!!auth.user);
  const navigate = (id) => {
    setTab(id);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  const command = async (action, payload, id) => {
    if (lock.current)
      throw new Error("Masih ada proses penyimpanan. Tunggu sebentar.");
    if (Object.keys(errors).length || loading)
      throw new Error("Tunggu sampai data selesai dimuat sebelum menyimpan.");
    lock.current = true;
    setBusy(true);
    try {
      const result = await db.rpc("gka_command", {
        p_action: action,
        p_payload: payload,
        p_request_id: id,
      });
      const failures = await refresh();
      setToast(
        Object.keys(failures).length
          ? "Transaksi tersimpan. Sebagian data gagal dimuat ulang; coba segarkan data."
          : "Perubahan berhasil disimpan.",
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), 6000);
      return result;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  const props = {
    data,
    command,
    busy,
    disabled: busy || loading || !!Object.keys(errors).length,
    navigate,
  };

  if (auth.loading) {
    return (
      <main className="auth-loading">
        <span className="brand-mark">G</span>
        <RefreshCw className="spin" size={23} />
        <p>Memeriksa sesi aman…</p>
      </main>
    );
  }

  if (!auth.user) return <Login sendMagicLink={auth.sendMagicLink} />;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Lewati ke konten
      </a>
      <aside className={`sidebar ${menu ? "is-open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-mark">G</span>
          <span>
            GKA<span className="brand-sub">OPERASIONAL</span>
          </span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav aria-label="Navigasi utama">
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={tab === id ? "page" : undefined}
              className={tab === id ? "active" : ""}
              onClick={() => navigate(id)}
            >
              <Icon size={19} />
              {label}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="mini-label">SATU RUANG KERJA</span>
          <strong>
            Rapi hari ini.
            <br />
            Siap untuk besok.
          </strong>
          <p>Kasbon, kehadiran, gaji, dan supplier.</p>
          <ArrowUpRight size={22} />
        </div>
        <div className="sidebar-footer">
          <span className="avatar">GK</span>
          <div>
            <strong>Timothy Ciesha</strong>
            <small>{auth.user.email}</small>
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="Tutup navigasi"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label={menu ? "Tutup navigasi" : "Buka navigasi"}
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{nav.find((n) => n.id === tab).label}</strong>
            </span>
          </div>
          <div className="actions">
            <span className="topbar-date">{dateLabel(today())}</span>
            <Button
              variant="ghost"
              disabled={loading || busy}
              onClick={refresh}
            >
              <RefreshCw size={16} className={loading ? "spin" : ""} />
              <span className="refresh-label">
                {loading ? "Memuat" : "Segarkan"}
              </span>
            </Button>
            <Button variant="ghost" onClick={auth.signOut}>
              <LogOut size={16} />
              <span className="refresh-label">Keluar</span>
            </Button>
            <span className="avatar small">GK</span>
          </div>
        </header>
        <main id="main">
          <div className="sync-line">
            <span
              className={`status-dot ${Object.keys(errors).length ? "error-dot" : ""}`}
            />
            {Object.keys(errors).length
              ? "Sebagian data belum tersedia"
              : loading
                ? "Memuat data terbaru…"
                : updatedAt
                  ? `Diperbarui ${updatedAt.toLocaleTimeString("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })} WIB`
                  : "Menyiapkan data"}
          </div>
          {!!Object.keys(errors).length && (
            <div className="notice error" role="alert">
              <strong>
                Data belum lengkap. Penyimpanan dinonaktifkan agar tidak memakai
                saldo yang salah.
              </strong>
              <p>{Object.keys(errors).join(", ")}</p>
              <details>
                <summary>Detail kendala</summary>
                {Object.entries(errors).map(([table, msg]) => (
                  <p key={table}>
                    {table}: {msg}
                  </p>
                ))}
              </details>
              <Button variant="secondary" disabled={loading} onClick={refresh}>
                Coba muat ulang
              </Button>
            </div>
          )}
          {loading && !updatedAt && !Object.keys(errors).length ? (
            <div className="loading-state">
              <RefreshCw className="spin" size={28} />
              <h2>Menyiapkan ruang kerja…</h2>
              <p>Mengambil catatan yang sudah tersimpan.</p>
            </div>
          ) : (
            nav.map(({ id, page: Page }) => (
              <section key={id} hidden={id !== tab} className="page-view">
                <Page {...props} />
              </section>
            ))
          )}
          <footer className="content-footer">
            <span>GKA Operasional</span>
            <span>Catatan terhubung. Riwayat terjaga.</span>
          </footer>
        </main>
      </div>
      <nav className="bottom-nav" aria-label="Navigasi seluler">
        {nav.slice(0, 5).map(({ id, label, short, icon: Icon }) => (
          <button
            key={id}
            aria-current={tab === id ? "page" : undefined}
            onClick={() => navigate(id)}
            className={tab === id ? "active" : ""}
          >
            <Icon size={19} />
            <span>{short || label}</span>
          </button>
        ))}
      </nav>
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Tutup notifikasi" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
