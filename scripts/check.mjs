import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const required = [
  "app/index.html",
  "app/assets/index-HRmtcOom.js",
  "migrations/0005_full_ui_cloudflare_adapter.sql",
  "migrations/0006_import_46_projects.sql",
  "migrations/0007_import_23_karyawan.sql",
  "migrations/0008_link_project_assignment_usernames.sql",
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

const bundle = await readFile(path.join(root, "app/assets/index-HRmtcOom.js"), "utf8");
if (!bundle.includes("window.location.origin")) throw new Error("Adapter Cloudflare same-origin belum aktif");
if (bundle.includes("disabled:!!r")) throw new Error("Username karyawan masih terkunci");
if (!bundle.includes("pmUsername:z.pmUsername===O?C:z.pmUsername")) {
  throw new Error("Cascade username ke proyek belum aktif");
}

console.log("KENDALI APP-V2.3 preflight OK");
