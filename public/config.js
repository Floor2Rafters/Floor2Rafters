// Paste your Supabase project's URL and "anon public" key here (Supabase → Project Settings → API).
// These two values are safe to publish; your data is protected by the database's security rules.
// Leave them empty to run in demo mode (picks saved on this device only).
window.F2R_CONFIG = {
  supabaseUrl: "https://hmbcijcpsjulvddwlbtd.supabase.co",
  supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtYmNpamNwc2p1bHZkZHdsYnRkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTE4NDg3MTEsImV4cCI6MjEwNzQyNDcxMX0.pkZzriqeg_5RupTPnDRGFN7xh_KfyAkTxeiUqRsEKbI",
  google: true, // set to false if you haven't turned on Google sign-in yet
  statsLabel: "2025-26 regular season", // shown with player stats; change when the new season's stats go in

  // Sponsor spot: "Fan Board presented by…" under the scoreboard, on the #1 reveal and on the board posts.
  // Off while this is null. When you sell it, replace null with something like:
  //   sponsor: { name: "Joe's Pizza", url: "https://joespizza.com", logo: "/brand/sponsors/joes.png", handle: "@joespizza", boards: "all" }
  // logo is optional (a wide image about 3x as wide as tall; put the file in public/brand/sponsors/).
  // boards: "all", or only some boards, e.g. ["overall","goat"]. Set on: false to pause it without deleting it.
  sponsor: null,

  // F2R Pro (paid tier). Off while this is null. When Stripe is set up (README, "F2R Pro"), replace null with:
  //   pro: { monthly: "https://buy.stripe.com/…", yearly: "https://buy.stripe.com/…", portal: "https://billing.stripe.com/p/login/…",
  //          price: "$2.99 a month", priceYear: "$19.99 a year" }
  // yearly/priceYear are optional. The phone apps never sell Pro; they show it to fans who already have it.
  pro: null,

  // Display ads (website only; never in the phone apps or for Pro fans). Off while null.
  // After Google AdSense approves floor2rafters.com: ads: { client: "ca-pub-…", slot: "…" }  and fill in public/ads.txt.
  ads: null
};
