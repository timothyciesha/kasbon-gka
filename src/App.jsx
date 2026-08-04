import { useState, useEffect } from "react";
import { db } from "./db.js";
import { S, today } from "./shared.jsx";
import TabKasbon from "./TabKasbon";
import TabAbsen from "./TabAbsen";
import TabGajian from "./TabGajian";
import TabSupplier from "./TabSupplier";
import TabSlip from "./TabSlip";

export default function App() {
  const [tab, setTab] = useState("kasbon");
  const [loading, setLoading] = useState(true);

  // shared state
  const [drivers, setDrivers] = useState([]);
  const [kasbons, setKasbons] = useState([]);
  const [cicilans, setCicilans] = useState([]);
  const [absens, setAbsens] = useState([]);
  const [gajianList, setGajianList] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [tagihans, setTagihans] = useState([]);
  const [supplierBayar, setSupplierBayar] = useState([]);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const [d, k, c, a, g, sup, tag, sb] = await Promise.all([
          db.get("drivers", "order=created_at.asc"),
          db.get("kasbons", "order=created_at.asc"),
          db.get("cicilans", "order=created_at.asc"),
          db.get("absens", "order=tanggal.desc"),
          db.get("gajian", "order=tanggal.desc"),
          db.get("suppliers", "order=name.asc"),
          db.get("supplier_tagihan", "order=created_at.desc"),
          db.get("supplier_bayar", "order=tanggal.asc"),
        ]);
        setDrivers(d); setKasbons(k); setCicilans(c); setAbsens(a);
        setGajianList(g); setSuppliers(sup); setTagihans(tag); setSupplierBayar(sb);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchAll();
  }, []);

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#0f1117", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: 40, height: 40, border: "3px solid #1e293b", borderTop: "3px solid #3b82f6", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#475569", fontSize: 14 }}>Memuat data...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const TABS = [
    { key: "kasbon",   icon: "💳", label: "Kasbon"   },
    { key: "absen",    icon: "📋", label: "Absen"    },
    { key: "gajian",   icon: "💰", label: "Gajian"   },
    { key: "supplier", icon: "🏭", label: "Supplier" },
    { key: "slip",     icon: "🧾", label: "Slip"     },
  ];

  const BottomNav = () => (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0f1117", borderTop: "1px solid #1e293b", display: "flex", zIndex: 30 }}>
      {TABS.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 0 14px", background: "transparent", border: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontFamily: "inherit" }}>
          <span style={{ fontSize: 18 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: tab === t.key ? "#3b82f6" : "#334155" }}>{t.label}</span>
          {tab === t.key && <div style={{ width: 16, height: 2, background: "#3b82f6", borderRadius: 99 }} />}
        </button>
      ))}
    </div>
  );

  const shared = { drivers, setDrivers, kasbons, setKasbons, cicilans, setCicilans, absens, setAbsens, gajianList, setGajianList, suppliers, setSuppliers, tagihans, setTagihans, supplierBayar, setSupplierBayar, BottomNav };

  return (
    <>
      {tab === "kasbon"   && <TabKasbon   {...shared} />}
      {tab === "absen"    && <TabAbsen    {...shared} />}
      {tab === "gajian"   && <TabGajian   {...shared} />}
      {tab === "supplier" && <TabSupplier {...shared} />}
      {tab === "slip"     && <TabSlip     {...shared} />}
    </>
  );
}
