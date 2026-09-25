const ROOT =
  import.meta.env.VITE_SUPABASE_URL ||
  "https://qvwohfqpkkqawemchzkk.supabase.co";
const KEY =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  "sb_publishable_zUgWGgPOIKuTC9R9tqEHJg_ImIFftcC";
const headers = { apikey: KEY, "Content-Type": "application/json" };
async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${ROOT}/rest/v1/${path}`, {
      ...options,
      headers: { ...headers, ...options.headers },
      signal: AbortSignal.timeout(25000),
    });
  } catch {
    throw new Error(
      "Koneksi terputus. Muat ulang data sebelum mencoba kembali; transaksi mungkin sudah tersimpan.",
    );
  }
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok)
    throw new Error(
      data?.message ||
        `Permintaan gagal (${response.status}). Silakan coba lagi.`,
    );
  return data;
}
export const db = {
  async list(table) {
    const all = [];
    const size = 500;
    for (let offset = 0; ; offset += size) {
      const rows = await request(
        `${table}?select=*&order=id.asc&limit=${size}&offset=${offset}`,
      );
      all.push(...rows);
      if (rows.length < size) return all;
    }
  },
  async rpc(name, args) {
    return request(`rpc/${name}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  },
};
