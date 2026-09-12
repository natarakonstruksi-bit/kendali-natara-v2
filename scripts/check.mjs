/**
 * Preflight KENDALI App V2.6 — dijalankan sebelum build/deploy.
 * Memastikan file wajib ada dan bundle frontend memang versi Cloudflare (bukan Supabase lama).
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const BUNDLE = "app/assets/index-HRmtcOom.js";

const required = [
  "app/index.html",
  BUNDLE,
  "migrations/0001_cf01_foundation.sql",
  "migrations/0005_full_ui_cloudflare_adapter.sql",
  "migrations/0006_import_46_projects.sql",
  "migrations/0008_link_project_assignment_usernames.sql",
  "migrations/0009_cloudflare_access_sso.sql",
  "src/worker.js",
  "src/app-config.js",
  "src/app-overrides.js",
  "scripts/build.mjs",
  "wrangler.jsonc"
];

for (const rel of required) {
  if (!existsSync(path.join(root, rel))) {
    throw new Error(`File wajib tidak ditemukan: ${rel}`);
  }
}

const bundle = await readFile(path.join(root, BUNDLE), "utf8");

const mustInclude = [
  ["window.location.origin", "Adapter Cloudflare same-origin belum aktif"],
  ["pmUsername:z.pmUsername===O?C:z.pmUsername", "Cascade username ke proyek belum aktif"],
  ["Penugasan Karyawan ke Proyek", "UI Penugasan Proyek V2.5 belum aktif"],
  ["Superintendent / PM", "Kolom assignment pada Master Proyek belum aktif"],
  ['typeof x!=="object"', "Matcher assignment aman V2.5.1 belum aktif"],
  ["/api/access/session", "SSO Cloudflare Access session belum aktif"],
  ["Login otomatis", "UI single login belum aktif"],
  ["Tidak ada password KENDALI.", "Form karyawan masih memakai password lama"]
];
const mustExclude = [
  ["disabled:!!r", "Username karyawan masih terkunci pada mode edit"],
  ["https://fsymvtwwpkzmrizaxblg.supabase.co", "Koneksi Supabase lama masih ada di bundle"]
];

for (const [token, message] of mustInclude) {
  if (!bundle.includes(token)) throw new Error(`Preflight gagal: ${message}`);
}
for (const [token, message] of mustExclude) {
  if (bundle.includes(token)) throw new Error(`Preflight gagal: ${message}`);
}

// Worker harus bisa di-parse sebagai ES module.
try {
  await import(path.join(root, "src", "worker.js"));
} catch (e) {
  throw new Error(`src/worker.js gagal dimuat: ${e.message}`);
}

console.log("KENDALI APP-V2.6 preflight OK");
