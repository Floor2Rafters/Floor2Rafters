/* ---------- Display ads (website only) ----------
   Off while config.js → ads is null. One slot on the Fan Board, after the top 10. Never in the pick game,
   never in the phone apps (store rules), never for F2R Pro. */
function adsOn(){return !!(CFG.ads&&CFG.ads.client&&CFG.ads.slot)&&!NATIVE&&!isPro()&&!demo;}
var adsLoaded=false;
function adHTML(){if(!adsOn())return "";
  return '<div class="adslot" aria-label="Advertisement"><span class="adlab">AD</span><ins class="adsbygoogle" style="display:block" data-ad-client="'+esc(CFG.ads.client)+'" data-ad-slot="'+esc(CFG.ads.slot)+'" data-ad-format="auto" data-full-width-responsive="true"></ins></div>';}
function fillAds(){if(!adsOn())return;var slots=document.querySelectorAll("ins.adsbygoogle:not([data-adsbygoogle-status])");if(!slots.length)return;
  if(!adsLoaded){adsLoaded=true;var s=document.createElement("script");s.async=true;s.crossOrigin="anonymous";
    s.src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client="+encodeURIComponent(CFG.ads.client);document.head.appendChild(s);}
  slots.forEach(function(){try{(window.adsbygoogle=window.adsbygoogle||[]).push({});}catch(e){}});}
