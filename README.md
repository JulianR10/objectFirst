# Object First — Webinar Italia (26/11/2026)

Sitio estático sin build + Vercel Functions. Proyecto Vercel `object-first`, repo `JulianR10/objectFirst`.

| Dominio | Página | Backend |
|---|---|---|
| www.objectfirst.online | `index.html`: landing + form de inscripción | `api/register.js` → Zoom + Supabase |
| ebook.objectfirst.online | `scarica/`: form → descarga del eBook Omdia | `api/ebook.js` → URL firmada (10 min) del PDF en bucket privado `ebook` |
| webinar.objectfirst.online | `on-demand/`: form o enlace de inscritos `?k=` → grabación | `api/ondemand.js` (env `ONDEMAND_VIDEO_URL`, `ONDEMAND_KEY`) |

Corte automático el **26/11 a las 12:00 CET**: `middleware.js` redirige la portada al on demand y `api/ondemand.js` empieza a entregar el vídeo.

- `vercel.json` → crons y redirecciones por host · `risorse.css` → estilos de `scarica/` y `on-demand/`
- `api/daily-export.js` → emails a 2Leap (calendario en `STOP_AT` y `REPORTS`) · `api/keepalive.js` → evita la pausa de Supabase Free
- `lib/leads-csv.js` → CSV de inscritos, descargas y leads del on demand · `lib/form.js` → validación compartida
- `scripts/export-leads.mjs` → export manual: `node --env-file=.env.local scripts/export-leads.mjs` → `exports/`
- Docs internas solo en local (repo público): `INTEGRACION_ZOOM.md`

## Desarrollo y deploy

`vercel dev` (sitio + `/api` con `.env.local`). Push a `main` → producción; otra rama → preview (sin env de Supabase: las APIs fallan ahí).
