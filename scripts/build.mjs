/**
 * Build KENDALI App V2.6:
 *   app/ (bundle UI hasil Vite) + src/app-config.js + src/app-overrides.js  ->  public/
 * Folder public/ kemudian diunggah wrangler sebagai Static Assets.
 * Jangan mengedit public/ secara manual — selalu lewat `npm run build`.
 */
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const APP_VERSION = "APP-V2.6";
const root = process.cwd();
const appDir = path.join(root, "app");
const publicDir = path.join(root, "public");
const bundleName = "index-HRmtcOom.js";

if (!existsSync(path.join(appDir, "index.html"))) throw new Error("app/index.html tidak ditemukan");
if (!existsSync(path.join(appDir, "assets", bundleName))) throw new Error("Bundle KENDALI tidak ditemukan");

await rm(publicDir, { recursive: true, force: true });
await mkdir(publicDir, { recursive: true });
await cp(appDir, publicDir, { recursive: true });

await cp(path.join(root, "src", "app-config.js"), path.join(publicDir, "assets", "app-config.js"));
await cp(path.join(root, "src", "app-overrides.js"), path.join(publicDir, "assets", "app-overrides.js"));

const indexPath = path.join(publicDir, "index.html");
let html = await readFile(indexPath, "utf8");
const original = `<script type="module" crossorigin src="./assets/${bundleName}"></script>`;
if (!html.includes(original)) throw new Error("Tag script bundle tidak ditemukan di app/index.html");
html = html.replace(
  original,
  `<script src="./assets/app-config.js"></script>\n    ${original}\n    <script type="module" src="./assets/app-overrides.js"></script>`
);
await writeFile(indexPath, html, "utf8");

const manifest = {
  builtAt: new Date().toISOString(),
  appVersion: APP_VERSION,
  frontend: "KENDALI existing UI + source extension layer",
  backend: "Cloudflare Worker",
  database: "D1",
  files: "R2",
  auth: "Cloudflare Access (single login)",
  singleDeploy: true
};
await writeFile(path.join(publicDir, "app-build.json"), JSON.stringify(manifest, null, 2));
console.log("KENDALI App build selesai:", manifest.appVersion);
