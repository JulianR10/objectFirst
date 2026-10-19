# Object First — Webinar Landing

Landing estática (un solo `index.html`) del webinar
**"Sopravvivere agli attacchi informatici basati sull'IA: costruire la resilienza per garantire il ripristino e il benessere dei team IT"** — jueves 19 de noviembre de 2026, 11:00 CET.

- `index.html` → página completa (HTML + CSS + JS inline, sin build)
- `logo.png`, `logo.svg`, `favicon.svg`, `og-cover.png` → assets
- `og-cover.png` → tarjeta 1200×630 para previews sociales (regenerada 20 Oct 2026)
- Form → Supabase (`webinar_registrations_italia`); integración Zoom pendiente
- Ramas:
  - `main` → versión oscura (actual)
  - `light-theme` → versión clara (fondos claros)

## Preview local

```bash
python -m http.server 8000
# http://127.0.0.1:8000/
```

## Deploy

Vercel (estático, sin build). Deploy actual: https://objectfirst.vercel.app/
