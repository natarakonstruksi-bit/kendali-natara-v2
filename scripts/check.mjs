import { readFile } from "node:fs/promises";

const bundle = await readFile("app/assets/index-HRmtcOom.js", "utf8");
const worker = await readFile("src/worker.js", "utf8");
const checks = {
  noOldSupabaseProject: !bundle.includes("fsymvtwwpkzmrizaxblg.supabase.co"),
  cloudflareSameOrigin: bundle.includes("window.location.origin"),
  usernameEditable: !bundle.includes('value:i.username,onChange:l("username"),disabled:!!r'),
  d1Adapter: worker.includes("app_records"),
  r2Adapter: worker.includes("env.FILES"),
  projectCollection: worker.includes('"projects"'),
  userCollection: worker.includes('"users"')
};
console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some(v => !v)) process.exit(1);
