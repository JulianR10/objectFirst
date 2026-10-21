/* Exporta los inscritos de Supabase a CSV, con la asistencia de Zoom si el webinar ya pasó.
   Uso:  node --env-file=.env.local scripts/export-leads.mjs
   Sale en exports/inscritos_<fecha>.csv. La lógica vive en lib/leads-csv.js (la comparte el cron diario). */

import { mkdirSync, writeFileSync } from "node:fs";
import leadsCsv from "../lib/leads-csv.js";

const { csv, leads, attendance } = await leadsCsv.buildLeadsCsv();

mkdirSync("exports", { recursive: true });
const file = `exports/inscritos_${new Date().toISOString().slice(0, 10)}.csv`;
writeFileSync(file, csv);
console.log(`${leads.length} inscritos → ${file}${attendance ? ` (${attendance.size} asistentes en Zoom)` : ""}`);
