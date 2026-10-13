/* ---------- F2R Pro: the paid tier ----------
   Sold on the website with Stripe payment links (config.js → pro). Off while pro is null.
   The phone apps never sell it (store rules); they show Pro if you already have it. */
var PRO=null; // {status, plan, current_period_end} for the signed-in fan
function isPro(){if(!PRO)return false;if(["active","trialing","past_due"].indexOf(PRO.status)<0)return false;
  return !PRO.current_period_end||new Date(PRO.current_period_end).getTime()>Date.now()-3*864e5;}
function proOn(){return !!(CFG.pro&&CFG.pro.monthly);}
async function loadPro(){PRO=null;if(!sb||!user||demo)return;try{var r=await sb.from("pro").select("status,plan,current_period_end").maybeSingle();PRO=r.data||null;}catch(e){}}
var PRO_PERKS=[["Start more groups","Up to 10 private groups, each up to 50 people (free: 1 group of 12)."],
  ["Full rank history","Every week a player has been on the board, not just the last 6."],
  ["No ads","Nothing but the board."],
  ["PRO tag","On your profile and in your groups."]];
function proLink(base){if(!base||!user)return base||"#";var sep=base.indexOf("?")<0?"?":"&";
  return base+sep+"client_reference_id="+encodeURIComponent(user.id)+(user.email?"&prefilled_email="+encodeURIComponent(user.email):"");}
function proHTML(){var X='<button class="x" data-close aria-label="Close">×</button>',c=CFG.pro||{};
  var h='<div class="sheet-card pro" role="dialog" aria-modal="true" aria-labelledby="pr-t">'+X+'<span class="kicker purple">F2R Pro</span>';
  if(isPro()){
    h+='<h2 id="pr-t" class="h1">You\'re Pro.</h2><p class="sub">'+(PRO.current_period_end?'Renews or ends '+esc(new Date(PRO.current_period_end).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}))+'. ':'')+'Thanks for backing Floor 2 Rafters.</p>';
    h+=perksHTML();
    if(!NATIVE&&c.portal)h+='<a class="btn tint sm" href="'+esc(c.portal+(user&&user.email?(c.portal.indexOf("?")<0?"?":"&")+"prefilled_email="+encodeURIComponent(user.email):""))+'" target="_blank" rel="noopener">Manage or cancel</a>';
    else if(NATIVE)h+='<p class="note">Manage it at floor2rafters.com → Me → F2R Pro.</p>';
    return h+'</div>';}
  h+='<h2 id="pr-t" class="h1">Run your own league.</h2><p class="sub">The game stays free. Pro is for fans who run the group chat.</p>'+perksHTML();
  if(!user){h+='<button class="btn" data-signin>Sign in to go Pro</button>';return h+'</div>';}
  h+='<div class="pro-buy"><a class="btn" href="'+esc(proLink(c.monthly))+'" data-probuy>'+esc(c.price||"Go Pro")+'</a>'+
    (c.yearly?'<a class="btn tint" href="'+esc(proLink(c.yearly))+'" data-probuy>'+esc(c.priceYear||"Pay yearly")+'</a>':'')+'</div>'+
    '<p class="note">Secure checkout by Stripe. Cancel any time; Pro runs to the end of what you paid for.</p></div>';
  return h;}
function perksHTML(){return '<ul class="perks">'+PRO_PERKS.map(function(p){return '<li><b>'+p[0]+'</b><span>'+p[1]+'</span></li>';}).join("")+'</ul>';}
function proTag(){return isPro()?' <span class="protag">PRO</span>':'';}
// Back from Stripe: floor2rafters.com/?pro=thanks (set as the payment link's success page). The webhook can take a few seconds.
async function proReturnOnBoot(){var q=null;try{q=new URLSearchParams(location.search).get("pro");}catch(e){}if(q!=="thanks")return;
  try{history.replaceState(null,"","/");}catch(e){}
  for(var i=0;i<6&&!isPro();i++){await loadPro();if(isPro())break;await new Promise(function(r){setTimeout(r,2500);});}
  ui.nav="me";render();toast(isPro()?"Welcome to F2R Pro.":"Payment received. Pro turns on in a minute; pull to refresh if it doesn't.");}
