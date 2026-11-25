"use strict";
/* POST /api/ondemand — página /on-demand/ (grabación del webinar).
   - { k }: enlace directo de los inscritos (Lemlist) → devuelve el vídeo sin form.
   - form (nombre, apellido, email, empresa, rol, consenso) → guarda el lead y devuelve el vídeo.
   El embed y la clave viven en env vars (ONDEMAND_VIDEO_URL, ONDEMAND_KEY): el repo es público. */

const { isWorkEmail, UTM_FIELDS, clean, readBody, insertRow } = require("../lib/form.js");

const REQUIRED = ["nome", "cognome", "email_aziendale", "azienda", "ruolo"];
// Antes de que termine el webinar no se entrega el embed a nadie (ni con clave ni con form).
// Desbloqueado el 25/11 para revisarlo con el cliente (antes: 2026-11-26T12:00:00+01:00).
const AVAILABLE_AT = Date.parse("2026-11-25T00:00:00+01:00");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "method_not_allowed" });
  }
  if (Date.now() < AVAILABLE_AT) return res.status(503).json({ error: "not_yet" });
  const video = process.env.ONDEMAND_VIDEO_URL;
  if (!video) return res.status(503).json({ error: "video_not_ready" });

  const b = readBody(req);
  if (b.k !== undefined) {
    const ok = Boolean(process.env.ONDEMAND_KEY) && b.k === process.env.ONDEMAND_KEY;
    return ok ? res.status(200).json({ ok: true, video }) : res.status(403).json({ error: "invalid_key" });
  }

  // Honeypot: el bot ve "éxito" pero no recibe el vídeo ni se guarda nada.
  if (b.sito_web) return res.status(200).json({ ok: true });

  const lead = {};
  for (const f of [...REQUIRED, ...UTM_FIELDS]) lead[f] = clean(b[f]);
  // Consenso obligatorio, igual que en el form del webinar (decisión del cliente).
  if (REQUIRED.some((f) => !lead[f]) || !isWorkEmail(lead.email_aziendale) || b.consent_marketing !== true) {
    return res.status(400).json({ error: "invalid_fields" });
  }

  try {
    await insertRow("ondemand_views", { ...lead, consent_marketing: true });
  } catch (err) {
    console.error("[ondemand]", err.message);
    return res.status(500).json({ error: "save_failed" });
  }
  return res.status(200).json({ ok: true, video });
};
