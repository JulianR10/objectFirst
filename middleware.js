/* Routing Middleware, solo en "/": cuando termina el webinar (26/11 12:00 CET),
   la portada deja de mostrar el form de inscripción y lleva a la grabación.
   Antes de esa hora, y en cualquier otro host (previews, subdominios), no hace nada. */

const SWITCH_AT = Date.parse("2026-11-26T12:00:00+01:00");
const HOSTS = new Set(["www.objectfirst.online", "objectfirst.online"]);

export const config = { matcher: "/", runtime: "nodejs" };

export default function middleware(request) {
  const url = new URL(request.url);
  if (Date.now() < SWITCH_AT || !HOSTS.has(url.hostname)) return; // sin respuesta: sigue a index.html
  // Mantiene la query (utm de los enlaces viejos de LinkedIn y emails).
  return Response.redirect(`https://webinar.objectfirst.online/on-demand/${url.search}`, 307);
}
