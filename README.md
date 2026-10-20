# Object First — Webinar Landing

Landing estática (un solo `index.html`) del webinar
**"Sopravvivere agli attacchi informatici basati sull'IA: costruire la resilienza per garantire il ripristino e il benessere dei team IT"** — jueves 19 de noviembre de 2026, 11:00 CET.

- `index.html` → página completa (HTML + CSS + JS inline, sin build)
- `logo.png` (nav y footer), `favicon.svg`, `og-cover.png`, `images/` (fotos de los speakers) → assets
- `og-cover.png` → tarjeta 1200×630 para previews sociales (regenerada 20 Oct 2026)
- `api/register.js` → el form registra en Zoom Webinars y guarda en Supabase · `api/keepalive.js` → cron diario
- Docs internas, solo en local (repo público): `INTEGRACION_ZOOM.md` (técnico) · `PRESENTACION_ZOOM.md` (para el cliente)
- Ramas:
  - `main` → versión clara (producción, merge de `light-theme`)
  - `light-theme` → versión clara (fondos claros)

## Preview local

```bash
vercel dev          # sitio + /api con las variables de .env.local
# solo HTML/CSS: python -m http.server 8000
```

## Deploy

`vercel --prod` (proyecto `object-first`, no conectado a Git) → https://objectfirst.vercel.app/
