"use strict";
/* POST /api/register — Vercel Function (Node).
   1. registra al usuario en el webinar de Zoom (Zoom envía el link personale por email)
   2. guarda el lead en Supabase con el resultado de Zoom (ok / error)
   Los secrets viven solo en las env vars de Vercel, nunca en index.html. */

const TABLE = "webinar_registrations_italia";
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Dominios de email personal: el form pide email aziendale (decisión del cliente).
const FREE_DOMAINS = new Set((
  "gmail.com googlemail.com outlook.com outlook.it hotmail.com hotmail.it live.com live.it msn.com yahoo.com yahoo.it ymail.com icloud.com me.com mac.com aol.com proton.me protonmail.com gmx.com gmx.net libero.it virgilio.it alice.it tim.it tin.it tiscali.it fastwebnet.it email.it inwind.it iol.it aruba.it pec.it legalmail.it mail.com yandex.com zoho.com"
).split(" "));
const isWorkEmail = (s) => EMAIL_RE.test(s) && !FREE_DOMAINS.has(s.split("@")[1].toLowerCase());
const REQUIRED = ["nome", "cognome", "email_aziendale", "azienda", "ruolo", "paese"];
const ISO_RE = /^[A-Z]{2}$/;
const PHONE_RE = /^\+?[\d\s().-]{6,20}$/;
const phoneOk = (s) => PHONE_RE.test(s) && /^(\D*\d){6,15}\D*$/.test(s);
const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "landing_url", "referrer"];

// El token S2S dura 1 h: se reutiliza mientras la instancia siga caliente.
let cachedToken = { value: null, exp: 0 };

async function getZoomToken() {
  if (cachedToken.value && Date.now() < cachedToken.exp) return cachedToken.value;
  const basic = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch(
    "https://zoom.us/oauth/token?grant_type=account_credentials" +
      `&account_id=${encodeURIComponent(process.env.ZOOM_ACCOUNT_ID)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } }
  );
  if (!res.ok) throw new Error(`Zoom token ${res.status} ${await res.text().catch(() => "")}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, exp: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

async function addZoomRegistrant(r) {
  const token = await getZoomToken();
  const res = await fetch(
    `https://api.zoom.us/v2/webinars/${process.env.ZOOM_WEBINAR_ID}/registrants`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        first_name: r.nome,
        last_name: r.cognome,
        email: r.email_aziendale,
        ...(r.telefono ? { phone: r.telefono } : {}),
        org: r.azienda,
        job_title: r.ruolo,
        country: r.paese_iso,
        // El título debe coincidir exacto con la "Pregunta personalizada" del webinar en Zoom.
        custom_questions: [
          { title: "Consenso marketing", value: r.consent_marketing ? "Sì" : "No" },
        ],
      }),
    }
  );
  const data = await res.json().catch(() => ({}));
  // Email ya registrado: Zoom responde 201 con el mismo join_url → éxito.
  // Más de 3 envíos del mismo email en un día: Zoom da 429 "for the registrant".
  // Solo es éxito si de verdad está inscrito: un email "denied" también llega acá
  // tras 3 intentos fallidos, y antes se le mostraba "Grazie" sin estar en Zoom.
  if (res.status === 429 && /for the registrant/i.test(data.message || "")) {
    const existing = await findRegistrant(token, r.email_aziendale);
    if (existing) return { registrant_id: existing.id, join_url: existing.join_url, rate_limited: true };
  }
  if (!res.ok) throw new Error(`Zoom ${res.status} ${data.code || ""} ${data.message || ""}`.trim());
  return data;
}

// Busca el email entre los inscritos aprobados o pendientes del webinar.
async function findRegistrant(token, email) {
  const target = email.toLowerCase();
  for (const status of ["approved", "pending"]) {
    let next = "";
    do {
      const res = await fetch(
        `https://api.zoom.us/v2/webinars/${process.env.ZOOM_WEBINAR_ID}/registrants` +
          `?status=${status}&page_size=300&next_page_token=${encodeURIComponent(next)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error(`Zoom list ${res.status} ${await res.text().catch(() => "")}`);
      const page = await res.json();
      const hit = (page.registrants || []).find((x) => (x.email || "").toLowerCase() === target);
      if (hit) return hit;
      next = page.next_page_token || "";
    } while (next);
  }
  return null;
}

async function saveLead(row) {
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${TABLE}`, {
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

function readBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  try {
    return JSON.parse(req.body || "{}");
  } catch {
    return {};
  }
}

const clean = (v) => (typeof v === "string" ? v.trim().slice(0, 500) : null);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }

  const b = readBody(req);
  // Honeypot: el bot ve "éxito" pero no se guarda ni se registra nada.
  if (b.sito_web) return res.status(200).json({ ok: true });

  const lead = {};
  for (const f of [...REQUIRED, ...UTM_FIELDS]) lead[f] = clean(b[f]);
  lead.consent_marketing = b.consent_marketing === true;
  const iso = ISO_RE.test(b.paese_iso) ? b.paese_iso : "IT";
  // El form ya no pide provincia; la columna es NOT NULL, así que queda "".
  lead.provincia = "";
  lead.telefono = clean(b.telefono) || null; // facoltativo
  const missing = REQUIRED.filter((f) => !lead[f]);
  if (!lead.consent_marketing) missing.push("consent_marketing"); // obligatorio (decisión del cliente)
  if (missing.length || !isWorkEmail(lead.email_aziendale) || (lead.telefono && !phoneOk(lead.telefono))) {
    return res.status(400).json({ error: "invalid_fields", fields: missing });
  }

  let zoom = null;
  let zoomError = null;
  try {
    zoom = await addZoomRegistrant({ ...lead, paese_iso: iso });
  } catch (err) {
    zoomError = err.message;
    console.error("[register] zoom", zoomError);
  }

  // Se guarda siempre: si Zoom falló queda en Supabase con zoom_status='error' para reprocesar.
  try {
    await saveLead({
      ...lead,
      zoom_registrant_id: zoom && zoom.registrant_id ? String(zoom.registrant_id) : null,
      zoom_join_url: zoom ? zoom.join_url : null,
      zoom_status: zoom ? (zoom.rate_limited ? "duplicate" : "ok") : "error",
      zoom_error: zoomError,
    });
  } catch (err) {
    console.error("[register] supabase", err.message);
    // Si Zoom ya registró al usuario, para él es un éxito (le llega el email igual).
    if (!zoom) return res.status(500).json({ error: "save_failed" });
  }

  if (!zoom) return res.status(502).json({ error: "zoom_unavailable" });
  return res.status(200).json({ ok: true });
};
