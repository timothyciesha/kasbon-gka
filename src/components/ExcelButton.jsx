import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { downloadExcel } from "../lib/export.js";
import { Button } from "./common.jsx";
export default function ExcelButton({ name, columns, rows, disabled }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const download = async () => {
    setBusy(true);
    setError("");
    try {
      await downloadExcel(name, columns, rows);
    } catch {
      setError("Ekspor gagal. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="excel-export">
      <Button
        variant="secondary"
        disabled={disabled || busy}
        onClick={download}
      >
        <FileSpreadsheet size={16} />
        {busy ? "Menyiapkan…" : "Excel"}
      </Button>
      {error && <small role="alert">{error}</small>}
    </span>
  );
}
