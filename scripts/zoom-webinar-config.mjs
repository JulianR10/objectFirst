// Uso: node --env-file=.env.local scripts/zoom-webinar-config.mjs dump|restore
// dump: guarda config + preguntas del webinar actual en zoom-backup/webinar.json
// restore: crea un webinar nuevo en la cuenta de las ZOOM_* actuales con esa config
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const FILE = "zoom-backup/webinar.json";
const { ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET, ZOOM_WEBINAR_ID } = process.env;

const tokenRes = await fetch(
  `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(ZOOM_ACCOUNT_ID)}`,
  { method: "POST", headers: { Authorization: "Basic " + Buffer.from(`${ZOOM_CLIENT_ID}:${ZOOM_CLIENT_SECRET}`).toString("base64") } }
);
const { access_token } = await tokenRes.json();
if (!access_token) throw new Error("Sin token de Zoom (revisar credenciales/scopes)");

const zoom = async (method, path, body) => {
  const r = await fetch("https://api.zoom.us/v2" + path, {
    method,
    headers: { Authorization: `Bearer ${access_token}`, "Content-Type": "application/json" },
    body: body && JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text}`);
  return text ? JSON.parse(text) : {};
};

const mode = process.argv[2];
if (mode === "dump") {
  const webinar = await zoom("GET", `/webinars/${ZOOM_WEBINAR_ID}`);
  const questions = await zoom("GET", `/webinars/${ZOOM_WEBINAR_ID}/registrants/questions`);
  mkdirSync("zoom-backup", { recursive: true });
  writeFileSync(FILE, JSON.stringify({ webinar, questions }, null, 2));
  console.log(`OK -> ${FILE} (${webinar.topic}, ${webinar.start_time})`);
} else if (mode === "restore") {
  const { webinar, questions } = JSON.parse(readFileSync(FILE, "utf8"));
  // campos de solo lectura que Zoom rechaza o ignora al crear
  for (const k of ["id", "uuid", "host_id", "host_email", "join_url", "registration_url", "start_url", "created_at", "status", "occurrences", "is_simulive"]) delete webinar[k];
  const created = await zoom("POST", "/users/me/webinars", webinar);
  await zoom("PATCH", `/webinars/${created.id}/registrants/questions`, {
    questions: questions.questions, custom_questions: questions.custom_questions,
  });
  console.log(`OK webinar nuevo: ${created.id}\nRegistro: ${created.registration_url}\nPoné ZOOM_WEBINAR_ID=${created.id}`);
} else {
  console.log("Uso: dump | restore");
}
