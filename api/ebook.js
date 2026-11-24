"use strict";
/* POST /api/ebook — form de ebook.objectfirst.online.
   Guarda la descarga en Supabase y devuelve una URL firmada (10 min) del PDF,
   que vive en el bucket privado "ebook": tiene licencia de TechTarget, no puede ser público. */

const { isWorkEmail, UTM_FIELDS, clean, readBody, insertRow } = require("../lib/form.js");

const BUCKET_PATH = "ebook/Omdia-Ebook.pdf";
const DOWNLOAD_NAME = "Omdia-eBook-Recovery-without-Compromise.pdf";
const EXPIRES_S = 600;

async function signedUrl() {
  const res = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/sign/${BUCKET_PATH}`, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: EXPIRES_S }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.signedURL) throw new Error(`Supabase sign ${res.status} ${data.message || ""}`.trim());
  // download= hace que el navegador lo guarde con ese nombre en vez de abrirlo.
  return `${process.env.SUPABASE_URL}/storage/v1${data.signedURL}&download=${encodeURIComponent(DOWNLOAD_NAME)}`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const b = readBody(req);
  // Honeypot: el bot ve "éxito" pero no recibe el PDF ni se guarda nada.
  if (b.sito_web) return res.status(200).json({ ok: true });

  const email = clean(b.email_aziendale);
  // Consenso obligatorio, igual que en el form del webinar (decisión del cliente).
  if (!email || !isWorkEmail(email) || b.consent_marketing !== true) {
    return res.status(400).json({ error: "invalid_fields" });
  }

  const row = { email_aziendale: email, consent_marketing: true };
  for (const f of UTM_FIELDS) row[f] = clean(b[f]);

  try {
    await insertRow("ebook_downloads", row);
    return res.status(200).json({ ok: true, url: await signedUrl() });
  } catch (err) {
    console.error("[ebook]", err.message);
    return res.status(500).json({ error: "download_failed" });
  }
};
