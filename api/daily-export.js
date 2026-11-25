"use strict";
/* GET /api/daily-export — lo llama el cron diario de Vercel (vercel.json) a las 07:00 y 13:00 UTC
   (8:00 y 14:00 Madrid; dos entradas con path distinto porque Hobby solo admite crons diarios).
   Manda por Resend el CSV completo de inscritos a REPORT_RECIPIENTS, hasta la mañana del webinar.
   Sin datos del eBook a propósito: se presenta como novedad en el webinar (ver scripts/export-leads.mjs).
   Vercel firma el cron con "Authorization: Bearer CRON_SECRET": sin eso no se envía nada (datos personales). */

const { buildLeadsCsv } = require("../lib/leads-csv.js");

// Último envío: el de las 8:00 del 26/11 (día del webinar). En Hobby el cron puede llegar
// hasta 59 min tarde, por eso el corte es a las 10:00 y no a las 8:00; el de las 14:00 ya no sale.
const STOP_AT = Date.parse("2026-11-26T10:00:00+01:00");
const DAY_MS = 24 * 60 * 60 * 1000;

module.exports = async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }

  // "sv-SE" da el formato YYYY-MM-DD
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  if (Date.now() >= STOP_AT) return res.status(200).json({ ok: true, skipped: true });

  try {
    const { csv, leads, attendance } = await buildLeadsCsv();
    const valid = leads.filter((l) => l.zoom_status !== "error");
    const fresh = valid.filter((l) => Date.now() - new Date(l.created_at).getTime() < DAY_MS).length;
    const errors = leads.length - valid.length;

    const lines = [
      `Iscritti totali: <b>${valid.length}</b>`,
      `Nuovi nelle ultime 24 ore: <b>${fresh}</b>`,
      ...(errors ? [`Registrazioni non riuscite su Zoom: <b>${errors}</b> (colonna zoom_status = error)`] : []),
      ...(attendance ? [`Partecipanti al webinar: <b>${attendance.size}</b>`] : []),
    ];

    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.REPORT_FROM,
        to: process.env.REPORT_RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean),
        subject: `Iscritti webinar 26/11 — ${today}: ${valid.length} (+${fresh})`,
        html: `<p>${lines.join("<br>")}</p><p>In allegato il CSV completo.</p>`,
        attachments: [{ filename: `inscritos_${today}.csv`, content: Buffer.from(csv).toString("base64") }],
      }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status} ${await r.text().catch(() => "")}`);
    return res.status(200).json({ ok: true, total: valid.length, fresh });
  } catch (err) {
    console.error("[daily-export]", err.message);
    return res.status(502).json({ ok: false });
  }
};
