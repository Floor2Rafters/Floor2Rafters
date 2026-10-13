// Copies the website (../public) into www/ for the app. The app ships these files inside it,
// so it opens fast and works on a bad connection; data still comes from Supabase.
// The two libraries the site loads from the internet (supabase-js and Sortable) are copied in from
// node_modules too, so the app never depends on a CDN being up.
import { cpSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
const src = new URL("../../public/", import.meta.url), dest = new URL("../www/", import.meta.url);
rmSync(dest, { recursive: true, force: true });
cpSync(src, dest, {
  recursive: true,
  filter: (p) => !/[\\/](_mock|\.well-known|sw\.js|vercel\.json)$/.test(p) && !/[\\/](_mock|\.well-known)[\\/]/.test(p)
});
const libs = [
  ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js", "../node_modules/@supabase/supabase-js/dist/umd/supabase.min.js", "vendor/supabase.min.js"],
  ["https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js", "../node_modules/sortablejs/Sortable.min.js", "vendor/Sortable.min.js"]
];
let html = readFileSync(new URL("index.html", dest), "utf8");
mkdirSync(new URL("vendor/", dest), { recursive: true });
for (const [cdn, local, out] of libs) {
  const from = new URL(local, import.meta.url);
  if (!existsSync(from)) { console.warn("Run npm install first: missing " + local); continue; }
  cpSync(from, new URL(out, dest));
  if (!html.includes(cdn)) throw new Error("index.html no longer loads " + cdn + "; update scripts/copy-web.mjs");
  html = html.replace(cdn, "/" + out);
}
writeFileSync(new URL("index.html", dest), html);
const cfg = readFileSync(new URL("config.js", dest), "utf8");
if (!/supabaseUrl:\s*"https:/.test(cfg)) console.warn("Heads up: public/config.js has no Supabase keys, so the app will run in demo mode.");
console.log("Copied the website into mobile/www.");
