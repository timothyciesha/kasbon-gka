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
  "audit_log",
];
const empty = Object.fromEntries(TABLES.map((t) => [t, []]));
export function useData(enabled = true) {
  const [data, setData] = useState(empty);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const running = useRef(null);
  const refresh = useCallback(() => {
    if (!enabled) return Promise.resolve({});
    if (running.current) return running.current;
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
        if (!Object.keys(failures).length) setUpdatedAt(new Date());
        return failures;
      })
      .finally(() => {
        setLoading(false);
        running.current = null;
      });
    return running.current;
  }, [enabled]);
  useEffect(() => {
    if (!enabled) {
      setData(empty);
      setErrors({});
      setLoading(false);
      setUpdatedAt(null);
      return undefined;
    }
    refresh();
    const focus = () => refresh();
    window.addEventListener("focus", focus);
    return () => window.removeEventListener("focus", focus);
  }, [enabled, refresh]);
  return { data, errors, loading, updatedAt, refresh };
}
