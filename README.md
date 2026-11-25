# Object First — Webinar Landing

Landing estática (un solo `index.html`) del webinar
**"Sopravvivere agli attacchi informatici basati sull'IA: costruire la resilienza per garantire il ripristino e il benessere dei team IT"** — jueves 26 de noviembre de 2026, 11:00 CET.

- `index.html` → página completa (HTML + CSS + JS inline, sin build)
- `logo.png` (nav y footer), `favicon.svg`, `og-cover.png`, `images/` (fotos de los speakers) → assets
- `og-cover.png` → tarjeta 1200×630 para previews sociales (regenerada 4 Nov 2026: fecha 26 nov; logo corregido; URLs con ?v=3 para refrescar caché)
- `scarica/` → eBook Omdia en **ebook.objectfirst.online** (`api/ebook.js`: PDF en bucket privado de Supabase, URL firmada)
- `on-demand/` → grabación en **webinar.objectfirst.online** (`api/ondemand.js`; env `ONDEMAND_VIDEO_URL`, `ONDEMAND_KEY` para el enlace de inscritos `?k=`)
- `middleware.js` → desde el 26/11 12:00 CET la portada redirige al on demand · `risorse.css` → estilos de las dos páginas
- `api/register.js` → el form registra en Zoom Webinars y guarda en Supabase · `api/keepalive.js` y `api/daily-export.js` → crons diarios
- Docs internas, solo en local (repo público): `INTEGRACION_ZOOM.md` (resumen para el cliente + técnico)
- Ramas:
  - `main` → versión clara (producción, merge de `light-theme`)
  - `light-theme` → versión clara (fondos claros)

## Preview local

```bash
vercel dev          # sitio + /api con las variables de .env.local
# solo HTML/CSS: python -m http.server 8000
```

## Deploy

Proyecto Vercel `object-first`, conectado a GitHub (`JulianR10/objectFirst`):

- push a `main` → deploy de **producción** → https://www.objectfirst.online/
- push a cualquier otra rama → deploy de preview con URL propia
