# Object First — Webinar Landing

Landing estática (un solo `index.html`) del webinar
**"Perché la resilienza dei dati è fondamentale per la sopravvivenza aziendale"**.

- `index.html` → página completa (HTML + CSS + JS inline, sin build)
- `logo.png`, `favicon.svg`, `og-cover.png` → assets
- Form → Supabase (`webinar_registrations_italia`)
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
