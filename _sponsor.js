/* ---------- Sponsor spot: "Fan Board presented by…" ----------
   Off until you sell it. To switch it on, fill in `sponsor` in config.js (see the example there). */
function spon(key){var s=CFG.sponsor;if(!s||!s.name||s.on===false)return null;
  if(key&&s.boards&&s.boards!=="all"&&[].concat(s.boards).indexOf(key)<0)return null;return s;}
var sponSeen={};
function sponLog(kind,key){if(demo||!sb)return;if(kind==="view"){if(sponSeen[key])return;sponSeen[key]=1;}
  try{sb.rpc("log_sponsor",{p_kind:kind,p_key:key||"overall"}).then(function(){},function(){});}catch(e){}}
function sponsorHTML(key){var s=spon(key);if(!s)return "";
  var inner='<span class="spon-k">FAN BOARD PRESENTED BY</span>'+(s.logo?'<img src="'+esc(s.logo)+'" alt="'+esc(s.name)+'" height="22">':'<b>'+esc(s.name)+'</b>');
  return s.url?'<a class="spon" href="'+esc(s.url)+'" target="_blank" rel="sponsored noopener" data-spon="'+key+'">'+inner+'</a>':'<div class="spon">'+inner+'</div>';}
function wireSponsor(root,key){if(!spon(key))return;sponLog("view",key);
  var a=root.querySelector("[data-spon]");if(a)a.addEventListener("click",function(){sponLog("tap",key);});}
