import { useState } from "react";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail } from "lucide-react";
import { OWNER_EMAIL } from "../lib/supabase.js";
import { Button } from "./common.jsx";

export default function Login({ sendMagicLink }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await sendMagicLink();
      setSent(true);
    } catch (err) {
      setError(err.message || "Link masuk gagal dikirim. Silakan coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-shell" aria-labelledby="login-title">
        <div className="login-brand">
          <span className="brand-mark">G</span>
          <span>
            GKA<span className="brand-sub">OPERASIONAL</span>
          </span>
        </div>
        <div className="login-icon" aria-hidden="true">
          <LockKeyhole size={25} />
        </div>
        <p className="eyebrow">RUANG KERJA PRIVAT</p>
        <h1 id="login-title">Masuk ke GKA Operasional</h1>
        <p className="login-description">
          Akses kasbon, absensi, gaji, dan supplier melalui email owner yang
          sudah terdaftar.
        </p>

        {sent ? (
          <div className="login-sent" role="status">
            <CheckCircle2 size={24} />
            <div>
              <strong>Cek inbox email</strong>
              <p>
                Link masuk sudah dikirim ke <b>{OWNER_EMAIL}</b>. Buka link itu
                di perangkat ini untuk melanjutkan.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit}>
            <label className="field">
              <span>Email owner</span>
              <span className="login-email">
                <Mail size={17} />
                <input value={OWNER_EMAIL} readOnly aria-readonly="true" />
              </span>
            </label>
            {error && (
              <div className="notice error" role="alert">
                {error}
              </div>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Mengirim…" : "Kirim link masuk"}
              {!busy && <ArrowRight size={17} />}
            </Button>
          </form>
        )}

        {sent && (
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setSent(false)}
          >
            Kirim ulang link
          </Button>
        )}
        <small className="login-security">
          Link hanya berlaku sekali dan sesi tersimpan aman di browser ini.
        </small>
      </section>
    </main>
  );
}
