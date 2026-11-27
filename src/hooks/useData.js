import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../lib/api.js";
export const TABLES = [
  "drivers",
  "kasbons",
  "cicilans",
  "absens",
  "gajian",
  "gajian_detail",
  "suppliers",
  "supplier_tagihan",
  "supplier_bayar",
  "slips",
  "payroll_runs",
  "payroll_items",
  "attendance_periods",
  "admin_fee_withdrawals",
  "audit_log",
];
// Background refresh (window focus / tab visible) is skipped when the last
// successful load is newer than this, so returning from a date picker or
// another app on a phone does not reload every table each time.
const BACKGROUND_REFRESH_MS = 30000;
const empty = Object.fromEntries(TABLES.map((t) => [t, []]));
export function useData(enabled = true) {
  const [data, setData] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const running = useRef(null);
  const lastLoad = useRef(0);
  const refresh = useCallback(
    (options = {}) => {
      if (!enabled) return Promise.resolve({});
      // A load that started before a write may return stale balances. When the
      // caller needs fresh data (after saving), wait for it and load again.
      if (running.current)
        return options.force === true
          ? running.current.then(() => refresh(options))
          : running.current;
      setLoading(true);
      running.current = Promise.allSettled(TABLES.map((t) => db.list(t)))
        .then((results) => {
          const next = {};
          const failures = {};
          results.forEach((r, i) => {
            if (r.status === "fulfilled") next[TABLES[i]] = r.value;
            else failures[TABLES[i]] = r.reason.message;
          });
          setData((prev) => ({ ...prev, ...next }));
          setErrors(failures);
          if (!Object.keys(failures).length) {
            setUpdatedAt(new Date());
            lastLoad.current = Date.now();
          }
          return failures;
        })
        .finally(() => {
          setLoading(false);
          running.current = null;
        });
      return running.current;
    },
    [enabled],
  );
  useEffect(() => {
    if (!enabled) {
      setData(empty);
      setErrors({});
      setLoading(false);
      setUpdatedAt(null);
      lastLoad.current = 0;
      return undefined;
    }
    refresh();
    const background = () => {
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastLoad.current < BACKGROUND_REFRESH_MS) return;
      refresh();
    };
    window.addEventListener("focus", background);
    document.addEventListener("visibilitychange", background);
    return () => {
      window.removeEventListener("focus", background);
      document.removeEventListener("visibilitychange", background);
    };
  }, [enabled, refresh]);
  return { data, errors, loading, updatedAt, refresh };
}
