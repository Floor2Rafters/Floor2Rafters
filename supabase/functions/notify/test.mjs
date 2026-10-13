// Tests for the notify function with fake services and real key signing. Run from this folder:  cp index.ts notify.copy.mjs && node test.mjs
import { generateKeyPairSync, createVerify, createPublicKey, verify as cverify } from "node:crypto";
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), ec = generateKeyPairSync("ec", { namedCurve: "P-256" });
Object.assign(process.env, { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "svc", NOTIFY_SECRET: "s3cret-s3cret",
  RESEND_API_KEY: "re_x", FCM_SERVICE_ACCOUNT: JSON.stringify({ client_email: "a@b.iam", project_id: "f2r-proj", private_key: rsa.privateKey.export({ type: "pkcs8", format: "pem" }) }),
  APNS_KEY: ec.privateKey.export({ type: "pkcs8", format: "pem" }), APNS_KEY_ID: "KEY123", APPLE_TEAM_ID: "TEAM123" });
const calls = [];
const targets = [
  { user_id: "00000001-1111-1111-1111-111111111111", email: "a@x.com", name: "Kail", tokens: [{ token: "andtok", platform: "android" }, { token: "iostok", platform: "ios" }], want_email: true, want_push: true, detail: { week: "2026-10-26", top: "Shai Gilgeous-Alexander", voters: 1280, board: true, moved: { name: "Tyrese Haliburton", rank: 9, prev: 4 } } },
  { user_id: "00000002-1111-1111-1111-111111111111", email: "b@x.com", name: null, tokens: [{ token: "deadtok", platform: "android" }], want_email: false, want_push: true, detail: { week: "2026-10-26", top: "Shai Gilgeous-Alexander", voters: 1280, board: false, moved: { name: "Jalen Brunson", rank: 3, prev: 7 } } },
];
globalThis.fetch = async (url, init = {}) => {
  calls.push({ url, init });
  const ok = (b) => new Response(JSON.stringify(b), { status: 200 });
  if (url.includes("/rpc/notify_targets")) return ok(targets);
  if (url.includes("/rpc/set_notify")) return new Response(null, { status: 204 });
  if (url.includes("oauth2.googleapis.com")) {
    const jwt = new URLSearchParams(init.body).get("assertion").split(".");
    const okSig = cverify("sha256", Buffer.from(jwt[0] + "." + jwt[1]), rsa.publicKey, Buffer.from(jwt[2], "base64url"));
    if (!okSig) return new Response("bad sig", { status: 400 });
    return ok({ access_token: "ya29", expires_in: 3600 });
  }
  if (url.includes("fcm.googleapis.com")) { const b = JSON.parse(init.body); return b.message.token === "deadtok" ? new Response('{"error":{"status":"NOT_FOUND","details":[{"errorCode":"UNREGISTERED"}]}}', { status: 404 }) : ok({ name: "m1" }); }
  if (url.includes("api.push.apple.com")) {
    const jwt = init.headers.authorization.split(" ")[1].split(".");
    const okSig = cverify("sha256", Buffer.from(jwt[0] + "." + jwt[1]), { key: ec.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(jwt[2], "base64url"));
    return okSig ? new Response("", { status: 200 }) : new Response("bad", { status: 403 });
  }
  if (url.includes("api.resend.com")) return ok({ data: [] });
  if (url.includes("/rest/v1/push_tokens")) return new Response(null, { status: 204 });
  if (url.includes("/rest/v1/notify_log")) return new Response("", { status: 201 });
  return new Response("?", { status: 500 });
};
const M = await import("./notify.copy.mjs");
let fails = 0; const ok = (n, c, x) => { console.log((c ? "PASS " : "FAIL ") + n + (x !== undefined ? "  (" + x + ")" : "")); if (!c) fails++; };
const req = (body, secret) => new Request("https://proj.supabase.co/functions/v1/notify", { method: "POST", headers: { "x-notify-secret": secret, "content-type": "application/json" }, body: JSON.stringify(body) });
ok("wrong secret refused", (await M.handle(req({ kind: "monday" }, "nope"))).status === 401);
const r = await (await M.handle(req({ kind: "monday" }, "s3cret-s3cret"))).json();
ok("monday run stats", r.fans === 2 && r.emails === 1 && r.pushes === 4 && r.removedTokens === 1 && r.pushErrors === 0, JSON.stringify(r));
const em = JSON.parse(calls.find((c) => c.url.includes("resend")).init.body);
ok("one email, to the fan with Monday on", em.length === 1 && em[0].to[0] === "a@x.com" && em[0].subject.includes("Shai"), em[0].subject);
ok("email has unsubscribe header + moved line", em[0].headers["List-Unsubscribe"].includes("functions/v1/notify?u=") && em[0].html.includes("slid 5 spots to #9"));
const fcmBodies = calls.filter((c) => c.url.includes("fcm.googleapis.com/v1/projects/f2r-proj")).map((c) => JSON.parse(c.init.body).message.notification.title);
ok("android pushes: board + moved", fcmBodies.includes("Your weekly Fan Board recap") && fcmBodies.includes("Tyrese Haliburton ▼5"), fcmBodies.join(" / "));
ok("user with board off gets only moved push", calls.filter((c) => c.url.includes("fcm") && JSON.parse(c.init.body).message.token === "deadtok").length === 1);
ok("apns signed and sent", calls.filter((c) => c.url.includes("api.push.apple.com/3/device/iostok")).length === 2);
ok("dead token deleted", calls.some((c) => c.url.includes("push_tokens?token=in.") && c.init.method === "DELETE"));
const logBody = JSON.parse(calls.find((c) => c.url.includes("notify_log")).init.body);
ok("logged per fan for the week", logBody.length === 2 && logBody[0].ref === "2026-10-26");
const link = em[0].headers["List-Unsubscribe"].slice(1, -1);
const before = calls.length;
const u0 = await M.handle(new Request(link));
ok("opening unsubscribe link only asks (scanner-safe)", u0.status === 200 && (await u0.text()).includes('method="post"') && !calls.slice(before).some((c) => c.url.includes("set_notify")));
const u1 = await M.handle(new Request(link, { method: "POST", body: "List-Unsubscribe=One-Click" }));
ok("unsubscribe confirm (POST) works", u1.status === 200 && calls.slice(before).some((c) => c.url.includes("set_notify")));
const bad = await M.handle(new Request(link.replace(/s=.{4}/, "s=AAAA")));
ok("tampered unsubscribe refused", bad.status === 400);
const s = M.compose("streak", { detail: { streak: 4 } });
ok("streak push", s.pushes[0].title === "Keep your 4-day streak" && !s.email);
delete process.env.RESEND_API_KEY; delete process.env.FCM_SERVICE_ACCOUNT; delete process.env.APNS_KEY; calls.length = 0;
const r2 = await (await M.handle(req({ kind: "monday" }, "s3cret-s3cret"))).json();
ok("no keys: nothing sent, nothing logged", r2.off === true && !calls.some(c=>c.url.includes("notify_log")), JSON.stringify(r2));
console.log(fails ? fails + " FAILED" : "ALL PASSED");
