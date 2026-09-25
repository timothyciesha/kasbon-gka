import { useEffect, useId, useRef } from "react";
import { X, Inbox, ArrowUpRight } from "lucide-react";
export function Button({ children, variant = "primary", ...props }) {
  return (
    <button className={`button ${variant}`} type="button" {...props}>
      {children}
    </button>
  );
}
export function Field({ label, children, hint }) {
  const id = useId();
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      {typeof children === "function" ? children(id) : children}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Empty({
  title = "Belum ada data",
  text = "Data yang ditambahkan akan tampil di sini.",
}) {
  return (
    <div className="empty">
      <Inbox size={32} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function Badge({ children, tone = "neutral" }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Stat({ label, value, detail, icon: Icon, tone = "" }) {
  return (
    <div className={`stat ${tone}`}>
      <div className="stat-heading">
        <span>{label}</span>
        {Icon && <Icon size={19} />}
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </div>
  );
}
export function PageTitle({
  eyebrow = "GKA / OPERASIONAL",
  title,
  subtitle,
  children,
}) {
  return (
    <header className="page-title">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <div className="actions">{children}</div>
    </header>
  );
}
export function Panel({ title, subtitle, children, action }) {
  return (
    <section className="panel">
      <header className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}
export function Modal({ title, children, onClose, busy }) {
  const ref = useRef();
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    const before = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-body">
        <header>
          <h2 id={id}>{title}</h2>
          <button
            className="icon-button"
            disabled={busy}
            onClick={onClose}
            aria-label="Tutup dialog"
          >
            <X size={21} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function Progress({ value, total }) {
  const percent = total ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Progres pembayaran"
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}
export function LinkButton({ children, onClick }) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
      <ArrowUpRight size={15} />
    </button>
  );
}
