import { useRef, useState } from "react";
import { Button, Field, Modal } from "./common.jsx";
import { amount, dateLabel, money, today, validDate } from "../lib/domain.js";
export default function TransactionForm({
  title,
  fields,
  initial = {},
  onSubmit,
  onClose,
  busy,
  balance,
  fee = 0,
  children,
}) {
  const [values, setValues] = useState({ tanggal: today(), ...initial });
  const [error, setError] = useState("");
  const requestId = useRef(crypto.randomUUID());
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const body = { ...values };
      for (const f of fields) {
        if (f.required !== false && !String(body[f.key] ?? "").trim())
          throw new Error(`${f.label} wajib diisi.`);
        if (f.type === "money") body[f.key] = amount(body[f.key], f.allowZero);
        if (f.type === "date" && !validDate(body[f.key]))
          throw new Error(`${f.label} tidak valid.`);
      }
      if (balance !== undefined && Number(body.nominal) > balance)
        throw new Error(
          `Pembayaran melebihi sisa saldo ${money(balance)}. Periksa kembali nominalnya.`,
        );
      await onSubmit(body, requestId.current);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };
  return (
    <Modal title={title} onClose={onClose} busy={busy}>
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          {fields.map((f) => (
            <Field
              key={f.key}
              label={f.label}
              hint={
                f.type === "money" &&
                values[f.key] !== "" &&
                values[f.key] != null
                  ? [money(values[f.key]), f.hint].filter(Boolean).join(" · ")
                  : f.hint
              }
            >
              {(id) =>
                f.options ? (
                  <select
                    id={id}
                    value={values[f.key] ?? ""}
                    required={f.required !== false}
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  >
                    <option value="">Pilih {f.label.toLowerCase()}</option>
                    {f.options.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    id={id}
                    type={f.type === "money" ? "text" : f.type || "text"}
                    inputMode={f.type === "money" ? "numeric" : undefined}
                    pattern={f.type === "money" ? "[0-9]+" : undefined}
                    autoComplete="off"
                    value={values[f.key] ?? ""}
                    required={f.required !== false}
                    min={f.min}
                    max={f.max}
                    maxLength={
                      f.type === "money"
                        ? 16
                        : f.type === "text"
                          ? 200
                          : undefined
                    }
                    onChange={(e) => {
                      // Accept "50.000" or "Rp 50.000" typed/pasted on a phone
                      // keyboard and keep only the rupiah digits.
                      const value =
                        f.type === "money"
                          ? e.target.value.replace(/\D/g, "")
                          : e.target.value;
                      setValues((v) => ({ ...v, [f.key]: value }));
                    }}
                  />
                )
              }
            </Field>
          ))}
          {children}
          {balance !== undefined && (
            <div className="payment-preview">
              <div>
                <span>Saldo sebelum</span>
                <strong>{money(balance)}</strong>
              </div>
              <div>
                <span>Pembayaran</span>
                <strong>{money(values.nominal)}</strong>
              </div>
              <div>
                <span>Saldo sesudah</span>
                <strong>{money(balance - Number(values.nominal || 0))}</strong>
              </div>
              <small>Tanggal transaksi: {dateLabel(values.tanggal)}</small>
            </div>
          )}
          {typeof fee === "function" && (
            <div className="notice">
              Biaya admin: <strong>{money(fee(values))}</strong>. Total
              kewajiban:{" "}
              <strong>
                {money(Number(values.nominal || 0) + fee(values))}
              </strong>
              .
            </div>
          )}
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit">{busy ? "Menyimpan…" : "Simpan"}</Button>
          </div>
        </fieldset>
      </form>
    </Modal>
  );
}
