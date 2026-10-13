// Floor 2 Rafters: sends the weekly recap email (Mondays) and phone alerts. Runs on Supabase Edge Functions.
// Called by the database on a schedule (call_notify in schema.sql) with {"kind":"monday"} or {"kind":"streak"},
// and by the unsubscribe link in emails (GET ?u=…&k=…&s=… shows a confirm button; POST turns it off).
//
// Settings (Supabase → Edge Functions → Secrets). Each channel stays off until its keys are there:
//   NOTIFY_SECRET            any long random text; the same value goes in app_settings.notify_secret
//   RESEND_API_KEY           emails (same Resend account as the sign-in emails)
//   FCM_SERVICE_ACCOUNT      Android alerts: the Firebase service-account JSON, pasted whole
//   APNS_KEY, APNS_KEY_ID, APPLE_TEAM_ID   iPhone alerts: the .p8 key text, its key id, your Apple team id
//   SITE_URL                 optional, defaults to https://floor2rafters.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are filled in by Supabase automatically.
// Written as plain JavaScript inside a .ts file so it runs on Supabase (Deno) and in the Node tests.

const env = (k) => (typeof Deno !== "undefined" ? Deno.env.get(k) : process.env[k]) || "";
const SITE = () => env("SITE_URL") || "https://floor2rafters.com";
const FROM = "Floor 2 Rafters <info@floor2rafters.com>";
const BUNDLE = "com.floor2rafters.app";
const enc = new TextEncoder();

// ---------- small helpers ----------
const b64url = (buf) => {
  const bytes = typeof buf === "string" ? enc.encode(buf) : new Uint8Array(buf);
  let bin = ""; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const pemToDer = (pem) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "")), (c) => c.charCodeAt(0));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const html = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html; charset=utf-8" } });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

async function hmac(text) {
  const key = await crypto.subtle.importKey("raw", enc.encode(env("NOTIFY_SECRET")), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(text))).slice(0, 32);
}
async function same(a, b) { // constant-time compare
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
export async function unsubLink(userId, kind) {
  const base = env("SUPABASE_URL") + "/functions/v1/notify";
  return `${base}?u=${userId}&k=${kind}&s=${await hmac(userId + "|" + kind)}`;
}

// ---------- database (service role, REST) ----------
async function db(path, init = {}) {
  const r = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"), "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()));
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const rpc = (fn, args) => db("rpc/" + fn, { method: "POST", body: JSON.stringify(args) });

// ---------- what each fan gets ----------
export function compose(kind, t) {
  const d = t.detail || {}, out = { email: null, pushes: [] };
  if (kind === "streak") {
    out.pushes.push({ title: `Keep your ${d.streak}-day streak`, body: "One Head 2 Head pick keeps it alive.", nav: "pick" });
    return out;
  }
  const mv = d.moved, up = mv && mv.prev > mv.rank, n = mv ? Math.abs(mv.prev - mv.rank) : 0;
  const moveLine = mv ? `Your #1, ${mv.name}, ${up ? "climbed" : "slid"} ${n} spots to #${mv.rank} on the fans' board this week.` : "";
  if (d.board) out.pushes.push({ title: "Your weekly Fan Board recap", body: `Fans' #1 right now: ${d.top}. See who moved this week.`, nav: "board" });
  if (mv) out.pushes.push({ title: `${mv.name} ${up ? "▲" : "▼"}${n}`, body: moveLine, nav: "board" });
  if (t.want_email && t.email) {
    out.email = {
      subject: `The fans have spoken: ${d.top} is #1`,
      lines: [`${t.name ? t.name + ", here's" : "Here's"} your weekly Fan Board recap. ${Number(d.voters || 0).toLocaleString("en-US")} fans are ranking, and ${d.top} is the fans' #1 right now.`, moveLine].filter(Boolean),
    };
  }
  return out;
}
export function emailHTML(lines, unsub) {
  const p = lines.map((l) => `<tr><td style="padding:0 28px 14px 28px;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#A7ACCA;">${esc(l)}</td></tr>`).join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>Floor 2 Rafters</title></head>
<body style="margin:0;padding:0;background:#07080F;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#07080F;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#10121F;">
<tr><td style="height:4px;background:#3DE1FF;font-size:0;line-height:0;">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 8px 28px;"><img src="${SITE()}/icons/icon-192.png" width="56" height="56" alt="Floor 2 Rafters" style="display:block;border:0;"></td></tr>
<tr><td style="padding:12px 28px 16px 28px;font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-weight:800;font-size:34px;line-height:1;letter-spacing:.5px;color:#EEF1FF;text-transform:uppercase;">The fans have spoken.</td></tr>
${p}
<tr><td style="padding:8px 28px 28px 28px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="background:#3DE1FF;">
<a href="${SITE()}/" style="display:inline-block;padding:14px 28px;font-family:'Arial Narrow',Arial,Helvetica,sans-serif;font-weight:800;font-size:18px;letter-spacing:1px;color:#07080F;text-decoration:none;text-transform:uppercase;">See the Fan Board</a>
</td></tr></table></td></tr></table>
<p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#7C82A6;">You get this because the weekly recap is on in your F2R settings.<br><a href="${unsub}" style="color:#3DE1FF;text-decoration:none;">Stop the weekly recap</a> · <a href="${SITE()}" style="color:#3DE1FF;text-decoration:none;">floor2rafters.com</a></p>
</td></tr></table></body></html>`;
}

// ---------- senders ----------
async function sendEmails(batch) {
  if (!env("RESEND_API_KEY") || !batch.length) return { sent: 0, skipped: batch.length };
  let sent = 0;
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    const r = await fetch("https://api.resend.com/emails/batch", {
      method: "POST", headers: { authorization: "Bearer " + env("RESEND_API_KEY"), "content-type": "application/json" },
      body: JSON.stringify(chunk.map((m) => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html,
        headers: { "List-Unsubscribe": `<${m.unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }))),
    });
    if (r.ok) sent += chunk.length; else console.error("resend", r.status, await r.text());
  }
  return { sent, skipped: 0 };
}

let fcmToken = null;
async function fcmAccess() {
  if (fcmToken && fcmToken.exp > Date.now() + 60000) return fcmToken;
  const sa = JSON.parse(env("FCM_SERVICE_ACCOUNT")), now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(sa.private_key), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const jwt = head + "." + claim + "." + b64url(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, enc.encode(head + "." + claim)));
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=" + jwt });
  const j = await r.json(); if (!j.access_token) throw new Error("FCM auth failed: " + JSON.stringify(j));
  fcmToken = { token: j.access_token, project: sa.project_id, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmToken;
}
let apnsJwt = null;
async function apnsAuth() {
  if (apnsJwt && apnsJwt.exp > Date.now()) return apnsJwt.jwt;
  const head = b64url(JSON.stringify({ alg: "ES256", kid: env("APNS_KEY_ID") })), claim = b64url(JSON.stringify({ iss: env("APPLE_TEAM_ID"), iat: Math.floor(Date.now() / 1000) }));
  const key = await crypto.subtle.importKey("pkcs8", pemToDer(env("APNS_KEY")), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const jwt = head + "." + claim + "." + b64url(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + claim)));
  apnsJwt = { jwt, exp: Date.now() + 40 * 60000 }; // Apple wants a new one at most every hour
  return jwt;
}
// Returns "ok", "gone" (token no longer valid: delete it), "off" (no keys) or "error"
async function sendPush(t, msg) {
  try {
    if (t.platform === "android") {
      if (!env("FCM_SERVICE_ACCOUNT")) return "off";
      const a = await fcmAccess();
      const r = await fetch(`https://fcm.googleapis.com/v1/projects/${a.project}/messages:send`, {
        method: "POST", headers: { authorization: "Bearer " + a.token, "content-type": "application/json" },
        body: JSON.stringify({ message: { token: t.token, notification: { title: msg.title, body: msg.body }, data: { nav: msg.nav }, android: { notification: { color: "#8B5CF6" } } } }),
      });
      if (r.ok) return "ok";
      const e = await r.text(); return r.status === 404 || /UNREGISTERED|INVALID_ARGUMENT/.test(e) ? "gone" : (console.error("fcm", r.status, e), "error");
    }
    if (!env("APNS_KEY") || !env("APNS_KEY_ID") || !env("APPLE_TEAM_ID")) return "off";
    const r = await fetch("https://api.push.apple.com/3/device/" + t.token, {
      method: "POST", headers: { authorization: "bearer " + (await apnsAuth()), "apns-topic": BUNDLE, "apns-push-type": "alert", "content-type": "application/json" },
      body: JSON.stringify({ aps: { alert: { title: msg.title, body: msg.body }, sound: "default" }, nav: msg.nav }),
    });
    if (r.ok) return "ok";
    const e = await r.text(); return r.status === 410 || /BadDeviceToken|Unregistered/.test(e) ? "gone" : (console.error("apns", r.status, e), "error");
  } catch (e) { console.error("push", e); return "error"; }
}

// ---------- the job ----------
export async function run(kind) {
  if (!env("RESEND_API_KEY") && !env("FCM_SERVICE_ACCOUNT") && !env("APNS_KEY")) return { off: true, note: "No email or push keys yet, nothing sent." };
  const targets = await rpc("notify_targets", { p_kind: kind });
  const emails = [], logs = [], gone = [], stats = { fans: targets.length, emails: 0, pushes: 0, pushOff: 0, pushErrors: 0 };
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  for (const t of targets) {
    const m = compose(kind, t);
    if (m.email) emails.push({ to: t.email, subject: m.email.subject, unsub: await unsubLink(t.user_id, "monday"), lines: m.email.lines });
    for (const p of m.pushes) for (const tok of t.tokens || []) {
      const r = await sendPush(tok, p);
      if (r === "ok") stats.pushes++; else if (r === "off") stats.pushOff++; else if (r === "gone") gone.push(tok.token); else stats.pushErrors++;
    }
    logs.push({ user_id: t.user_id, kind, ref: kind === "monday" ? String(t.detail.week) : today });
  }
  for (const e of emails) e.html = emailHTML(e.lines, e.unsub);
  const er = await sendEmails(emails); stats.emails = er.sent;
  if (gone.length) await db("push_tokens?token=in.(" + gone.map((g) => '"' + g.replace(/"/g, "") + '"').join(",") + ")", { method: "DELETE" });
  if (logs.length) await db("notify_log", { method: "POST", headers: { Prefer: "resolution=ignore-duplicates" }, body: JSON.stringify(logs) });
  stats.removedTokens = gone.length;
  return stats;
}

export async function handle(req) {
  const url = new URL(req.url);
  // Unsubscribe link from an email. Opening the link (GET) only shows a confirm button, because mail
  // security scanners (Outlook Safe Links, company gateways) open every link in an email by themselves.
  // Only a POST turns the email off: the confirm button, or the one-click button mail apps show.
  if (url.searchParams.get("u")) {
    const u = url.searchParams.get("u"), k = url.searchParams.get("k"), s = url.searchParams.get("s") || "";
    if (!/^[0-9a-f-]{36}$/.test(u) || !["monday", "moved", "streak"].includes(k) || !(await same(s, await hmac(u + "|" + k))))
      return html("<p>That link didn't work. Turn emails off in the app: Me → Settings.</p>", 400);
    const page = (h, p, extra) => html(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${h}</title><body style="margin:0;background:#07080F;color:#EEF1FF;font-family:Helvetica,Arial,sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center;padding:24px"><div><h1 style="font-family:'Arial Narrow',Arial,sans-serif;text-transform:uppercase">${h}</h1><p style="color:#A7ACCA">${p}</p>${extra}</div></body>`);
    if (req.method !== "POST")
      return page("Stop the weekly recap?", "Tap the button to stop the weekly recap emails.",
        `<form method="post"><button type="submit" style="font:700 16px Helvetica,Arial,sans-serif;background:#8B5CF6;color:#fff;border:0;border-radius:10px;padding:14px 22px;cursor:pointer">Stop the emails</button></form><p><a style="color:#3DE1FF" href="${SITE()}">Never mind, back to Floor 2 Rafters</a></p>`);
    await rpc("set_notify", { p_user: u, p_kind: k, p_on: false });
    return page("You're off the list.", "No more weekly recap emails. Turn them back on any time in Me → Settings.", `<p><a style="color:#3DE1FF" href="${SITE()}">Back to Floor 2 Rafters</a></p>`);
  }
  if (req.method !== "POST") return json({ error: "not found" }, 404);
  if (!env("NOTIFY_SECRET") || !(await same(req.headers.get("x-notify-secret") || "", env("NOTIFY_SECRET")))) return json({ error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (!["monday", "streak"].includes(body.kind)) return json({ error: "kind must be monday or streak" }, 400);
  return json(await run(body.kind));
}

if (typeof Deno !== "undefined") Deno.serve(handle);
