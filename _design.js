/* ---------- design details: rolls, flicker, spotlight, court icons, pull to refresh ---------- */
// Big moments take turns: the Jumbotron flicker, the #1 reveal and a level-up never play on top of each other.
var FX={busy:false,q:[]};
function fx(run){FX.q.push(run);if(!FX.busy)fxNext();}
function fxNext(){var run=FX.q.shift();if(!run){FX.busy=false;return;}FX.busy=true;var ms=0;try{ms=run()||0;}catch(e){}setTimeout(fxNext,ms);}
function animOK(){return !window.__noAnim&&!reduceMotion();}
// Rank numbers roll to their new spot, like a shot clock, instead of jumping.
var RANKMEM={};
function rollRanks(app){var ctx=ui.nav+"|"+(ui.pick||"")+"|"+(ui.list||"")+"|"+(ui.tab||"")+"|"+(ui.gtab||"");
  app.querySelectorAll(".list").forEach(function(L,li){var k=ctx+"|"+li,old=RANKMEM[k]||{},now={};
    L.querySelectorAll(".r").forEach(function(r){var id=r.dataset.pid||r.dataset.id||r.dataset.rid,n=r.querySelector(".n");if(!id||!n)return;
      var v=parseInt(n.textContent,10);if(!v)return;now[id]=v;var o=old[id];
      if(o&&o!==v&&animOK()){var up=v<o;n.classList.add("rolling");n.innerHTML='<span class="roll"><i class="'+(up?'up':'dn')+'"><b>'+(up?o:v)+'</b><b>'+(up?v:o)+'</b></i></span>';}});
    RANKMEM[k]=now;});}
// The Jumbotron powers up row by row the first time you see it each visit.
var jtBooted=false;
function bootJumbo(app){var p=app.querySelector(".jt-panel");if(!p||jtBooted)return;jtBooted=true;if(!animOK())return;
  fx(function(){var q=document.querySelector(".jt-panel");if(q)q.classList.add("boot");return 950;});}
// The light from above leans toward the card under your thumb.
function wireSpot(app){var b=document.body;b.style.setProperty("--sx","50%");
  app.querySelectorAll(".h2h .pc").forEach(function(c){
    var on=function(){b.style.setProperty("--sx",c.classList.contains("rt")?"74%":"26%");},off=function(){b.style.setProperty("--sx","50%");};
    c.addEventListener("pointerenter",on);c.addEventListener("pointerdown",on);c.addEventListener("pointerleave",off);});}
// The scoreboard lights the floor: a faint blue glow falls on the top rows under it (phones and tablets; on computers the board sits beside the list).
function litList(app){if(ui.nav!=="board"||!app.querySelector(".jt"))return;var L=app.querySelector(".list");if(L)L.classList.add("jt-lit");}
// Tip-off: the first matchup of each visit, the two cards slide in from the sides and meet at the VS bar.
var tipped=false;
function tipOff(app){var h=app.querySelector(".h2h");if(!h||tipped)return;tipped=true;if(!animOK())return;h.classList.add("tipoff");setTimeout(function(){h.classList.remove("tipoff");},700);}
// Switching boards wipes the Jumbotron dot by dot, like an arena board changing graphics.
var jtTab=null;
function jtWipe(app){if(ui.nav!=="board")return;var p=app.querySelector(".jt-panel"),t=ui.tab;if(!p)return;var was=jtTab;jtTab=t;
  if(was===null||was===t||!animOK()||p.classList.contains("boot"))return;p.classList.add("wipe");setTimeout(function(){p.classList.remove("wipe");},560);}
// Seats farther from the lights: board rows get slightly dimmer the farther they sit from #1 (down to 80% at #45 and below).
function dimRows(app){if(ui.nav!=="board"&&ui.nav!=="groups")return;
  app.querySelectorAll(".list").forEach(function(L){var i=0;L.querySelectorAll(".r").forEach(function(r){var n=parseInt(r.dataset.rank||(r.querySelector(".n")||{}).textContent,10)||(++i);
    var d=Math.min(.2,Math.max(0,n-1)*.0045);if(d>0)r.style.setProperty("--far",(1-d).toFixed(3));});});}
// Long names always fit: a name line that's too wide shrinks just enough to stay on one line (never below 55% of its size).
var FIT=".ln,.nm,.mn-nm b";
function fitNames(root){var els=[].slice.call((root||document).querySelectorAll(FIT));
  els.forEach(function(e){if(e.style.fontSize)e.style.fontSize="";});           // 1) reset
  var m=els.map(function(e){var c=e.clientWidth;return c&&e.scrollWidth>c+1?[e,c,e.scrollWidth,parseFloat(getComputedStyle(e).fontSize)]:null;}); // 2) measure
  m.forEach(function(x){if(x)x[0].style.fontSize=Math.max(x[3]*.55,Math.floor(x[3]*x[1]/x[2]*10)/10).toFixed(1)+"px";});}               // 3) write
var fitT=null,fitW=window.innerWidth;window.addEventListener("resize",function(){if(window.innerWidth===fitW)return;fitW=window.innerWidth;clearTimeout(fitT);fitT=setTimeout(function(){fitNames();},150);});
// Scoreboard animations pause while it's scrolled out of view.
var jtObs=null;
function jtIdle(app){if(jtObs){jtObs.disconnect();jtObs=null;}var j=app.querySelector(".jt");if(!j||!("IntersectionObserver" in window))return;
  jtObs=new IntersectionObserver(function(es){es.forEach(function(e){e.target.classList.toggle("idle",!e.isIntersecting);});});jtObs.observe(j);}
try{document.fonts.ready.then(function(){fitNames();});}catch(e){}
function designPass(app){fitNames(app);dimRows(app);rollRanks(app);bootJumbo(app);jtWipe(app);wireSpot(app);litList(app);tipOff(app);jtIdle(app);}

// Pull down to refresh (the phone app and home-screen app; browsers have their own). A small banner drops, then snaps up.
var ptr={y0:null,d:0,busy:false};
function ptrOn(){try{return NATIVE||window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches||window.__ptr;}catch(e){return NATIVE;}}
function ptrEl(){var el=document.getElementById("ptr");if(!el){el=document.createElement("div");el.id="ptr";el.className="ptr";el.setAttribute("aria-hidden","true");
  el.innerHTML='<svg width="30" height="40" viewBox="0 0 44 62"><path d="M3 2 H41 V60 L22 50 L3 60 Z" fill="#1E1740" stroke="#8B5CF6" stroke-width="3"/><path class="pc1" d="M10 38 L22 31 L34 38" fill="none" stroke="#3DE1FF" stroke-width="4"/><path class="pc2" d="M10 27 L22 20 L34 27" fill="none" stroke="#3DE1FF" stroke-width="4"/></svg><span>Pull to refresh</span>';document.body.appendChild(el);}return el;}
function ptrInit(){if(!ptrOn())return;document.documentElement.style.overscrollBehaviorY="contain";var el=ptrEl();
  window.addEventListener("touchstart",function(e){if(ptr.busy||ui.sheet||window.scrollY>0){ptr.y0=null;return;}ptr.y0=e.touches[0].clientY;ptr.d=0;},{passive:true});
  window.addEventListener("touchmove",function(e){if(ptr.y0==null)return;ptr.d=Math.max(0,Math.min(110,(e.touches[0].clientY-ptr.y0)*.5));
    el.style.transform="translateY("+(ptr.d-70)+"px)";el.classList.toggle("ready",ptr.d>=64);el.querySelector("span").textContent=ptr.d>=64?"Let go to refresh":"Pull to refresh";},{passive:true});
  window.addEventListener("touchend",function(){if(ptr.y0==null)return;ptr.y0=null;if(ptr.d>=64)ptrRefresh();else el.style.transform="";},{passive:true});}
async function ptrRefresh(){var el=ptrEl();ptr.busy=true;el.classList.add("busy");el.querySelector("span").textContent="Refreshing…";el.style.transform="translateY(0)";haptic();
  boards={};G.board={};G.list=null;ADM=null;HIST={};try{if(user)await loadPro();}catch(e){}render();
  await new Promise(function(r){setTimeout(r,700);});el.classList.remove("busy","ready");el.classList.add("snap");el.style.transform="";ptr.busy=false;setTimeout(function(){el.classList.remove("snap");},400);}

/* ---------- LED ticker crawl across the top of the Fan Board ---------- */
function crawlItems(key,b,rows,hasPrev,voters){var out=[],nm=function(r){return lastName(P[r.player_id].n);},bn=key==="overall"?"":(isGoat(key)?"ALL-TIME ":POSL[key]+" ");
  if(rows[0])out.push(["FANS' "+bn+"#1: "+nm(rows[0]),"white"]);
  if(hasPrev){var m=moverLists(rows);
    m.up.slice(0,3).forEach(function(r){out.push(["▲"+(r.prev_rank-r.rank)+" "+nm(r),"blue"]);});
    m.dn.slice(0,3).forEach(function(r){out.push(["▼"+(r.rank-r.prev_rank)+" "+nm(r),"down"]);});
    m.nw.slice(0,2).forEach(function(r){out.push(["NEW #"+r.rank+" "+nm(r),"purple"]);});}
  if(voters)out.push([fmt(voters)+(voters===1?" FAN RANKING":" FANS RANKING"),"soft"]);
  out.push(["LIVE","blue"]);
  return out;}
function crawlHTML(key,b,rows,hasPrev,voters){if(!rows.length)return "";var it=crawlItems(key,b,rows,hasPrev,voters);
  var run=it.map(function(x){return '<span class="c-'+x[1]+'">'+esc(x[0])+'</span>';}).join('<i aria-hidden="true">·</i>')+'<i aria-hidden="true">·</i>';
  var secs=Math.max(18,Math.round(it.map(function(x){return x[0];}).join("   ").length*0.32));
  return '<div class="crawl" role="marquee" aria-label="'+esc(it.map(function(x){return x[0];}).join(", "))+'"><div class="crawl-in" style="--secs:'+secs+'s" aria-hidden="true"><span class="crawl-run">'+run+'</span><span class="crawl-run">'+run+'</span></div></div>';}

/* ---------- desktop: fill the left column under the Jumbotron ---------- */
function deskSideHTML(key,b,rows,hasPrev){if(!rows.length)return "";var h='<div class="desk-side">';
  var mine=me.l[key]&&me.l[key][0];
  if(mine!=null&&P[mine]){var p=isGoat(key)?asGoat(P[mine]):P[mine],r=fanRank(key,mine);
    h+='<button class="ds-card ds-me" data-pid="'+mine+'" style="--tc:'+tc(p)+'"><span class="kicker purple">Your #1'+(key==="overall"?"":" · "+(isGoat(key)?"All-Time":POSL[key]))+'</span><b>'+esc(p.n)+'</b><small>'+(r?"The fans have him #"+r.rank+".":"Not on the fans\' board yet.")+'</small></button>';}
  else h+='<button class="ds-card ds-me" data-pick="'+(key==="overall"?firstOpen():key)+'"><span class="kicker purple">Your #1</span><b>Not set yet</b><small>Build your list and see how it stacks up.</small></button>';
  if(hasPrev){var m=moverLists(rows),row=function(r,up){var p=isGoat(key)?asGoat(P[r.player_id]):P[r.player_id];return '<button class="ds-mv" data-pid="'+r.player_id+'" style="--tc:'+tc(p)+'"><span class="'+(up?'up':'dn')+'">'+(up?'▲'+(r.prev_rank-r.rank):'▼'+(r.rank-r.prev_rank))+'</span><b>'+esc(p.n)+'</b><small>#'+r.rank+'</small></button>';};
    h+='<div class="ds-card"><span class="kicker blue">Biggest movers · last 7 days</span><div class="ds-mvs">'+m.up.slice(0,3).map(function(r){return row(r,true);}).join("")+m.dn.slice(0,3).map(function(r){return row(r,false);}).join("")+'</div></div>';}
  h+='<div class="ds-card ds-cd"><span class="kicker">Fans ranking now</span><b class="ds-led">'+fmt((b&&b.voters)||0)+'</b><small>The board updates live as fans pick.</small></div>';
  return h+'</div>';}

/* ---------- screen changes slide instead of cutting ---------- */
var NAVORDER=["home","board","groups","group","pick","lists","me","settings","feedback","admin"],lastNav=null;
function navSlide(app){var a=NAVORDER.indexOf(lastNav),b=NAVORDER.indexOf(ui.nav);
  if(lastNav&&lastNav!==ui.nav&&animOK()){var c=b>=a?"enter-r":"enter-l";app.classList.add(c);setTimeout(function(){app.classList.remove(c);},260);}
  lastNav=ui.nav;}

// Sticky mini scoreboard: scroll past the Jumbotron and it shrinks into a slim bar at the top (fans' #1 + LIVE). Tap it to jump back up.
var miniObs=null;
function miniBar(){var b=document.getElementById("mini");if(!b){b=document.createElement("button");b.id="mini";b.className="mscore";b.type="button";b.tabIndex=-1;b.setAttribute("aria-hidden","true");
  b.onclick=function(){window.scrollTo({top:0,behavior:animOK()?"smooth":"auto"});};document.body.appendChild(b);}return b;}
function miniOff(){if(miniObs){miniObs.disconnect();miniObs=null;}var b=document.getElementById("mini");if(b){b.classList.remove("on");b.tabIndex=-1;b.setAttribute("aria-hidden","true");}}
function wireMini(app){miniOff();var jt=app.querySelector(".jt");if(ui.nav!=="board"||!jt||!JT||!JT.rows.length||!("IntersectionObserver" in window))return;
  var r=JT.rows[0],p=isGoat(JT.key)?asGoat(P[r.player_id]):P[r.player_id];if(!p)return;var b=miniBar(),last=String(p.n).split(" ").slice(1).join(" ")||p.n;
  b.style.setProperty("--tc",tc(p));b.setAttribute("aria-label","Fans' #1 "+JT.label.replace(" · ","")+": "+p.n+". Live. Back to the top");
  b.innerHTML='<span class="mn-in"><span class="mn-rk">1</span><span class="mn-nm"><b>'+esc(last)+'</b><small>'+esc(JT.label.replace(" · ",""))+(p.t?' · '+esc(p.t):'')+' · '+fmt(r.points)+' PTS</small></span><span class="mn-live"><i></i>LIVE</span></span>';
  fitNames(b);miniObs=new IntersectionObserver(function(es){var e=es[es.length-1],on=!e.isIntersecting&&e.boundingClientRect.bottom<=0;
    b.classList.toggle("on",on);b.tabIndex=on?0:-1;b.setAttribute("aria-hidden",on?"false":"true");},{threshold:0});
  miniObs.observe(jt.querySelector(".jt-panel")||jt);}
