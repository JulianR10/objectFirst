"use strict";
/* GET /api/keepalive — lo llama el cron diario de Vercel (vercel.json).
   Una lectura mínima evita que Supabase Free pause el proyecto tras 7 días sin actividad. */

module.exports = async function handler(req, res) {
  try {
    const r = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/webinar_registrations_italia?select=zoom_status&limit=1`,
      {
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      }
    );
    if (!r.ok) throw new Error(`Supabase ${r.status}`);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[keepalive]", err.message);
    return res.status(502).json({ ok: false });
  }
};
