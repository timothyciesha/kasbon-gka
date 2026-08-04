const SUPABASE_URL = "https://qvwohfqpkkqawemchzkk.supabase.co";
const SUPABASE_KEY = "sb_publishable_zUgWGgPOIKuTC9R9tqEHJg_ImIFftcC";

const headers = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

export const db = {
  async get(table, params = "") {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, { headers });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async post(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async patch(table, id, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
      method: "PATCH",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw await res.json();
    return res.json();
  },
  async delete(table, params) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      method: "DELETE", headers,
    });
    if (!res.ok) throw await res.json();
  },
};
