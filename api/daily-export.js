"use strict";
/* GET /api/daily-export — lo llama el cron diario de Vercel (vercel.json) a las 07:00 y 13:00 UTC
   (8:00 y 14:00 Madrid; dos entradas con path distinto porque Hobby solo admite crons diarios).
   Manda por Resend a REPORT_RECIPIENTS:
   - hasta la mañana del webinar: el CSV de inscritos, sin datos del eBook a propósito
     (se presenta como novedad en el webinar);
   - después, solo en las fechas de REPORTS (envío de la mañana): el informe final y los semanales.
   Vercel firma el cron con "Authorization: Bearer CRON_SECRET": sin eso no se envía nada (datos personales). */

const { buildLeadsCsv, buildDownloadsCsv, buildViewsCsv } = require("../lib/leads-csv.js");

// Último envío diario: el de las 8:00 del 26/11 (día del webinar). En Hobby el cron puede llegar
// hasta 59 min tarde, por eso el corte es a las 10:00 y no a las 8:00; el de las 14:00 ya no sale.
const STOP_AT = Date.parse("2026-11-26T10:00:00+01:00");
const REPORTS = {
  "2026-11-27": "final",
  "2026-12-03": "weekly",
  "2026-12-10": "weekly",
  "2026-12-17": "weekly",
};
const DAY_MS = 24 * 60 * 60 * 1000;

const since = (rows, ms) => rows.filter((r) => Date.now() - new Date(r.created_at).getTime() < ms).length;
const attach = (filename, csv) => ({ filename, content: Buffer.from(csv).toString("base64") });

async function sendEmail(subject, lines, attachments) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.REPORT_FROM,
      to: process.env.REPORT_RECIPIENTS.split(",").map((s) => s.trim()).filter(Boolean),
      subject,
      html: `<p>${lines.join("<br>")}</p><p>In allegato ${attachments.length > 1 ? "i CSV completi" : "il CSV completo"}.</p>`,
      attachments,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status} ${await r.text().catch(() => "")}`);
}

async function dailyRegistrations(today) {
  const { csv, leads, attendance } = await buildLeadsCsv();
  const valid = leads.filter((l) => l.zoom_status !== "error");
  const fresh = since(valid, DAY_MS);
  const errors = leads.length - valid.length;
  await sendEmail(`Iscritti webinar 26/11 — ${today}: ${valid.length} (+${fresh})`, [
    `Iscritti totali: <b>${valid.length}</b>`,
    `Nuovi nelle ultime 24 ore: <b>${fresh}</b>`,
    ...(errors ? [`Registrazioni non riuscite su Zoom: <b>${errors}</b> (colonna zoom_status = error)`] : []),
    ...(attendance ? [`Partecipanti al webinar: <b>${attendance.size}</b>`] : []),
  ], [attach(`inscritos_${today}.csv`, csv)]);
  return { total: valid.length, fresh };
}

// final: inscritos con asistencia + eBook + on demand. weekly: eBook + on demand, con los nuevos de la semana.
async function report(kind, today) {
  const { csv, leads, attendance } = await buildLeadsCsv();
  const [downloads, views] = await Promise.all([buildDownloadsCsv(leads), buildViewsCsv(leads)]);
  const files = [
    attach(`ebook_descargas_${today}.csv`, downloads.csv),
    attach(`ondemand_leads_${today}.csv`, views.csv),
  ];
  if (kind === "final") {
    const valid = leads.filter((l) => l.zoom_status !== "error");
    await sendEmail(`Report finale webinar 26/11 — ${today}`, [
      `Iscritti: <b>${valid.length}</b>`,
      `Partecipanti al webinar: <b>${attendance ? attendance.size : "non disponibile"}</b>`,
      `Download eBook Omdia (persone): <b>${downloads.rows.length}</b>`,
      `Lead dal webinar on demand: <b>${views.rows.length}</b>`,
    ], [attach(`inscritos_${today}.csv`, csv), ...files]);
  } else {
    const week = 7 * DAY_MS;
    await sendEmail(`Webinar on demand ed eBook — settimana al ${today}`, [
      `Lead dal webinar on demand: <b>${views.rows.length}</b> (+${since(views.rows, week)} negli ultimi 7 giorni)`,
      `Download eBook Omdia (persone): <b>${downloads.rows.length}</b> (+${since(downloads.rows, week)} negli ultimi 7 giorni)`,
    ], files);
  }
  return { report: kind };
}

module.exports = async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false });
  }

  // "sv-SE" da el formato YYYY-MM-DD
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
  const morning = new URL(req.url || "/", "http://x").searchParams.get("slot") !== "pm";
  const kind = Date.now() < STOP_AT ? "daily" : morning && REPORTS[today];
  if (!kind) return res.status(200).json({ ok: true, skipped: true });

  try {
    const result = kind === "daily" ? await dailyRegistrations(today) : await report(kind, today);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error("[daily-export]", kind, err.message);
    return res.status(502).json({ ok: false });
  }
};
