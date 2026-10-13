// Floor 2 Rafters: Stripe tells this function when someone buys, renews or cancels F2R Pro,
// and it keeps the pro table up to date. Runs on Supabase Edge Functions (deploy with JWT check off).
// Settings (Supabase → Edge Functions → Secrets):
//   STRIPE_WEBHOOK_SECRET   the "Signing secret" (whsec_…) from Stripe → Developers → Webhooks → your endpoint
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are filled in by Supabase automatically.
// Events to send it: checkout.session.completed, customer.subscription.created, customer.subscription.updated, customer.subscription.deleted

const env = (k) => (typeof Deno !== "undefined" ? Deno.env.get(k) : process.env[k]) || "";
const enc = new TextEncoder();
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

// Stripe signs each call: header "t=TIMESTAMP,v1=HEX". We check it so nobody else can make themselves Pro.
export async function verify(payload, header, secret, toleranceSec = 300) {
  const parts = Object.fromEntries((header || "").split(",").map((p) => p.split("=")).filter((p) => p.length === 2).map(([k, v]) => [k.trim(), v]));
  const sigs = (header || "").split(",").filter((p) => p.trim().startsWith("v1=")).map((p) => p.trim().slice(3));
  const t = Number(parts.t);
  if (!t || !sigs.length || !secret) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(t + "." + payload)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === mac.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ mac.charCodeAt(i)), 0) === 0);
}

async function db(path, init = {}) {
  const r = await fetch(env("SUPABASE_URL") + "/rest/v1/" + path, {
    ...init,
    headers: { apikey: env("SUPABASE_SERVICE_ROLE_KEY"), authorization: "Bearer " + env("SUPABASE_SERVICE_ROLE_KEY"), "content-type": "application/json", ...(init.headers || {}) },
  });
  if (!r.ok) throw new Error(path + " " + r.status + " " + (await r.text()));
  const t = await r.text(); return t ? JSON.parse(t) : null;
}
const iso = (sec) => (sec ? new Date(sec * 1000).toISOString() : null);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function apply(event) {
  const o = event.data && event.data.object;
  if (!o) return "ignored";
  if (event.type === "checkout.session.completed") {
    const uid = o.client_reference_id;
    if (!uid || !UUID.test(uid)) return "no user on this checkout (was the payment link opened from the app?)";
    if (o.mode && o.mode !== "subscription") return "ignored";
    await db("pro?on_conflict=user_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates" },
      body: JSON.stringify({ user_id: uid, status: "active", stripe_customer: o.customer, stripe_subscription: o.subscription,
        current_period_end: new Date(Date.now() + 35 * 864e5).toISOString(), updated_at: new Date().toISOString() }) });
    return "pro on";
  }
  if (event.type.startsWith("customer.subscription.")) {
    const rows = await db("pro?select=user_id&stripe_customer=eq." + encodeURIComponent(o.customer));
    if (!rows.length) throw new Error("retry: checkout not recorded yet for " + o.customer); // Stripe retries later
    const item = o.items && o.items.data && o.items.data[0];
    const end = o.current_period_end || (item && item.current_period_end);
    const interval = item && item.price && item.price.recurring && item.price.recurring.interval;
    const status = event.type === "customer.subscription.deleted" ? "canceled" : o.status;
    await db("pro?stripe_customer=eq." + encodeURIComponent(o.customer), { method: "PATCH",
      body: JSON.stringify({ status, plan: interval || null, current_period_end: iso(end), stripe_subscription: o.id, updated_at: new Date().toISOString() }) });
    return "pro " + status;
  }
  return "ignored";
}

export async function handle(req) {
  if (req.method !== "POST") return json({ error: "not found" }, 404);
  const payload = await req.text();
  if (!(await verify(payload, req.headers.get("stripe-signature"), env("STRIPE_WEBHOOK_SECRET")))) return json({ error: "bad signature" }, 400);
  try { return json({ ok: true, result: await apply(JSON.parse(payload)) }); }
  catch (e) { console.error(e); return json({ error: String(e.message || e) }, 500); }
}

if (typeof Deno !== "undefined") Deno.serve(handle);
