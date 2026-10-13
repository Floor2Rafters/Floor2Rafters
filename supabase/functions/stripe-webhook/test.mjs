// Tests for the Stripe webhook with fake Stripe calls. Run from this folder:  cp index.ts webhook.copy.mjs && node test.mjs
import { createHmac } from "node:crypto";
Object.assign(process.env, { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc", STRIPE_WEBHOOK_SECRET: "whsec_test" });
const rows = {}, calls = [];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, init }); const u = new URL(url);
  if (u.pathname.endsWith("/pro") && init.method === "POST") { const b = JSON.parse(init.body); rows[b.user_id] = { ...rows[b.user_id], ...b }; return new Response(null, { status: 201 }); }
  if (u.pathname.endsWith("/pro") && init.method === "PATCH") { const c = u.searchParams.get("stripe_customer").slice(3); for (const k in rows) if (rows[k].stripe_customer === c) Object.assign(rows[k], JSON.parse(init.body)); return new Response(null, { status: 204 }); }
  if (u.pathname.endsWith("/pro")) { const c = u.searchParams.get("stripe_customer").slice(3); return new Response(JSON.stringify(Object.values(rows).filter((r) => r.stripe_customer === c))); }
  return new Response("?", { status: 500 });
};
const M = await import("./webhook.copy.mjs");
let fails = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  (" + x + ")" : "")); if (!c) fails++; };
const sign = (body, t = Math.floor(Date.now() / 1000), secret = "whsec_test") => `t=${t},v1=${createHmac("sha256", secret).update(t + "." + body).digest("hex")}`;
const send = (ev, sig) => { const body = JSON.stringify(ev); return M.handle(new Request("https://x/functions/v1/stripe-webhook", { method: "POST", headers: { "stripe-signature": sig || sign(body) }, body })); };
const uid = "00000001-1111-1111-1111-111111111111";
ok("unsigned call refused", (await send({ type: "checkout.session.completed" }, "t=1,v1=abc")).status === 400);
ok("wrong secret refused", (await send({ type: "x" }, sign("{}", undefined, "whsec_other"))).status === 400);
ok("old signature refused", (await send({ type: "x" }, sign(JSON.stringify({ type: "x" }), Math.floor(Date.now() / 1000) - 3600))).status === 400);
const early = await send({ type: "customer.subscription.created", data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ current_period_end: 1893456000, price: { recurring: { interval: "month" } } }] } } } });
ok("subscription before checkout: asks Stripe to retry", early.status === 500);
let r = await send({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: uid, customer: "cus_1", subscription: "sub_1" } } });
ok("checkout turns Pro on", r.status === 200 && rows[uid].status === "active" && rows[uid].stripe_customer === "cus_1");
r = await send({ type: "customer.subscription.updated", data: { object: { id: "sub_1", customer: "cus_1", status: "active", items: { data: [{ current_period_end: 1893456000, price: { recurring: { interval: "year" } } }] } } } });
ok("renewal sets plan and end date", rows[uid].plan === "year" && rows[uid].current_period_end === "2030-01-01T00:00:00.000Z", rows[uid].current_period_end);
r = await send({ type: "customer.subscription.deleted", data: { object: { id: "sub_1", customer: "cus_1", status: "canceled", items: { data: [{}] } } } });
ok("cancel turns Pro off", rows[uid].status === "canceled");
r = await send({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: "not-a-user", customer: "cus_2" } } });
ok("checkout without a user is ignored safely", r.status === 200 && !rows["not-a-user"]);
console.log(fails ? fails + " FAILED" : "ALL PASSED");
