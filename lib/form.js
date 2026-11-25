"use strict";
/* Utilidades de los formularios públicos. La usan /api/ebook y /api/ondemand.
   shortcut: /api/register tiene su propia copia (no se tocó antes del webinar del 26/11); unificar después. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Dominios de email personal: los forms piden email aziendale (decisión del cliente).
const FREE_DOMAINS = new Set((
  "gmail.com googlemail.com outlook.com outlook.it hotmail.com hotmail.it live.com live.it msn.com yahoo.com yahoo.it ymail.com icloud.com me.com mac.com aol.com proton.me protonmail.com gmx.com gmx.net libero.it virgilio.it alice.it tim.it tin.it tiscali.it fastwebnet.it email.it inwind.it iol.it aruba.it pec.it legalmail.it mail.com yandex.com zoho.com"
).split(" "));
const isWorkEmail = (s) => EMAIL_RE.test(s) && !FREE_DOMAINS.has(s.split("@")[1].toLowerCase());

const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_url", "referrer"];

const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 500) : null);

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

// Insert con la service_role key (ignora RLS): las tablas no aceptan escrituras públicas.
async function insertRow(table, row) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Supabase insert ${res.status} ${await res.text().catch(() => "")}`);
}

module.exports = { isWorkEmail, UTM_FIELDS, clean, readBody, insertRow };
