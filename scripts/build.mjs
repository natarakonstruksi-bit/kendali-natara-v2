import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const appDir = path.join(root, "app");
const publicDir = path.join(root, "public");
const bundle = path.join(appDir, "assets", "index-HRmtcOom.js");

if (!existsSync(path.join(appDir, "index.html"))) {
  throw new Error("app/index.html tidak ditemukan");
}
if (!existsSync(bundle)) {
  throw new Error("Bundle KENDALI tidak ditemukan");
}

const bundleText = await readFile(bundle, "utf8");
const forbidden = [
  "https://fsymvtwwpkzmrizaxblg.supabase.co"
];
for (const token of forbidden) {
  if (bundleText.includes(token)) {
    throw new Error(`Build dibatalkan: koneksi lama masih ditemukan: ${token}`);
  }
}
if (!bundleText.includes("window.location.origin")) {
  throw new Error("Build dibatalkan: adapter same-origin Cloudflare belum aktif");
}
if (bundleText.includes("disabled:!!r")) {
  throw new Error("Build dibatalkan: username karyawan masih terkunci pada mode edit");
}
if (!bundleText.includes("pmUsername:z.pmUsername===O?C:z.pmUsername")) {
  throw new Error("Build dibatalkan: cascade perubahan username ke assignment proyek belum aktif");
}

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(appDir, publicDir, { recursive: true });

await cp(path.join(root, "src", "app-config.js"), path.join(publicDir, "assets", "app-config.js"));
await cp(path.join(root, "src", "app-overrides.js"), path.join(publicDir, "assets", "app-overrides.js"));

const indexPath = path.join(publicDir, "index.html");
let html = await readFile(indexPath, "utf8");
html = html.replace(
  '<script type="module" crossorigin src="./assets/index-HRmtcOom.js"></script>',
  '<script src="./assets/app-config.js"></script>\n    <script type="module" crossorigin src="./assets/index-HRmtcOom.js"></script>\n    <script type="module" src="./assets/app-overrides.js"></script>'
);
await writeFile(indexPath, html, "utf8");

const manifest = {
  builtAt: new Date().toISOString(),
  appVersion: "APP-V2.3",
  frontend: "KENDALI existing UI + source extension layer",
  backend: "Cloudflare Worker",
  database: "D1",
  files: "R2",
  singleDeploy: true
};
await writeFile(path.join(publicDir, "app-build.json"), JSON.stringify(manifest, null, 2));
console.log("KENDALI App build selesai:", manifest.appVersion);
