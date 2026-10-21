"use strict";
/* Arma el CSV de inscritos desde Supabase, con la asistencia de Zoom si el webinar ya pasó.
   Lo usan scripts/export-leads.mjs (local) y api/daily-export.js (cron diario).
   Separador ";" para Excel en español/italiano. La asistencia necesita el scope
   report:read:list_webinar_participants:admin en la app de Zoom. */

const TABLE = "webinar_registrations_italia";
const env = process.env;

// Orden de columnas en el CSV; las que no estén acá se agregan al final.
const FIRST = [
  "created_at", "nome", "cognome", "email_aziendale", "telefono", "azienda", "ruolo", "paese", "provincia",
  "consent_marketing", "asistio", "minutos_conectado", "primera_conexion",
  "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "referrer", "landing_url",
  "zoom_status",
];

async function fetchLeads() {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/${TABLE}?select=*&order=id.asc&limit=1000&offset=${offset}`,
      { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` } }
    );
    if (!res.ok) throw new Error(`Supabase ${res.status} ${await res.text()}`);
    const page = await res.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

async function zoomToken() {
  const basic = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_ACCOUNT_ID)}`,
    { method: "POST", headers: { Authorization: `Basic ${basic}` } }
  );
  if (!res.ok) throw new Error(`Zoom token ${res.status}`);
  return (await res.json()).access_token;
}

// Devuelve Map email → { seconds, firstJoin }, o null si todavía no hay datos de asistencia.
async function fetchAttendance() {
  const token = await zoomToken();
  const byEmail = new Map();
  let next = "";
  do {
    const res = await fetch(
      `https://api.zoom.us/v2/report/webinars/${env.ZOOM_WEBINAR_ID}/participants?page_size=300&next_page_token=${next}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.warn(`Asistencia no disponible (Zoom ${res.status}: ${data.message || "sin detalle"}).`);
      if (res.status === 404) console.warn("Normal antes del webinar: Zoom solo tiene el informe cuando la sesión terminó.");
      if (res.status === 400 || res.status === 401) console.warn("Si el webinar ya pasó, falta el scope report:read:list_webinar_participants:admin.");
      return null;
    }
    // Una persona que se reconecta aparece varias veces: se suman los segundos.
    for (const p of data.participants || []) {
      const email = (p.user_email || "").toLowerCase();
      if (!email) continue;
      const prev = byEmail.get(email) || { seconds: 0, firstJoin: p.join_time };
      prev.seconds += p.duration || 0;
      if (p.join_time < prev.firstJoin) prev.firstJoin = p.join_time;
      byEmail.set(email, prev);
    }
    next = data.next_page_token || "";
  } while (next);
  return byEmail;
}

const cell = (v) => {
  if (v === null || v === undefined) return "";
  let s = typeof v === "boolean" ? (v ? "Sì" : "No") : String(v);
  // Texto del form público: que Excel no lo ejecute como fórmula (=HYPERLINK…, +, -, @).
  // Los teléfonos (+34…) solo llevan dígitos y separadores: inofensivos, se dejan igual.
  if (/^[=+\-@\t\r]/.test(s) && !/^\+?[\d\s().-]+$/.test(s)) s = "'" + s;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// Una fila por persona: el form guarda cada envío y Zoom no distingue mayúsculas.
// Se queda el primer envío, salvo que ese haya fallado en Zoom y uno posterior no.
function dedupeByEmail(leads) {
  const byEmail = new Map();
  for (const l of leads) {
    const key = (l.email_aziendale || "").toLowerCase();
    const prev = byEmail.get(key);
    if (!prev || (prev.zoom_status === "error" && l.zoom_status !== "error")) byEmail.set(key, l);
  }
  return [...byEmail.values()];
}

// csv ya incluye el BOM para que Excel lea bien los acentos.
async function buildLeadsCsv() {
  const leads = dedupeByEmail(await fetchLeads());
  const attendance = await fetchAttendance().catch((err) => {
    console.warn(`Asistencia no disponible (${err.message}).`);
    return null;
  });

  for (const lead of leads) {
    const a = attendance && attendance.get((lead.email_aziendale || "").toLowerCase());
    lead.asistio = attendance ? (a ? "Sì" : "No") : "";
    lead.minutos_conectado = a ? Math.round(a.seconds / 60) : "";
    lead.primera_conexion = a ? a.firstJoin : "";
  }

  const keys = new Set(leads.flatMap(Object.keys));
  const columns = [...FIRST.filter((k) => keys.has(k)), ...[...keys].filter((k) => !FIRST.includes(k))];
  const csv = [columns, ...leads.map((l) => columns.map((c) => l[c]))].map((r) => r.map(cell).join(";")).join("\r\n");
  return { csv: "﻿" + csv, leads, attendance };
}

module.exports = { buildLeadsCsv, dedupeByEmail, cell };
