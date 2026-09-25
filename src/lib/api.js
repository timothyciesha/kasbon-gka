import { supabase } from "./supabase.js";

function message(error) {
  if (!error) return "Permintaan gagal. Silakan coba lagi.";
  if (/jwt|session|permission|policy|authorized/i.test(error.message || ""))
    return "Sesi sudah berakhir atau akses ditolak. Silakan masuk kembali.";
  return error.message || "Permintaan gagal. Silakan coba lagi.";
}

export const db = {
  async list(table) {
    const all = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order("id", { ascending: true })
        .range(offset, offset + size - 1);
      if (error) throw new Error(message(error));
      all.push(...data);
      if (data.length < size) return all;
    }
  },
  async rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) throw new Error(message(error));
    return data;
  },
};
