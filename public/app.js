(function(){
/* Floor 2 Rafters — web app. Plain JavaScript, no build step.
   Data lives in Supabase (see /supabase). Without config.js keys it runs in demo mode on this device only. */
"use strict";
var CFG=window.F2R_CONFIG||{};
// Inside the iPhone/Android app (Capacitor)? Native touches are optional extras; the website works without them.
var NATIVE=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
var NP=(NATIVE&&window.Capacitor.Plugins)||{};
if(NATIVE)CFG.google=false; // Google sign-in needs a browser redirect; the app signs in with an email code
function haptic(){try{if(NP.Haptics)NP.Haptics.impact({style:"LIGHT"});}catch(e){}}
var POS=[["pg","PG","Point guards"],["sg","SG","Shooting guards"],["sf","SF","Small forwards"],["pf","PF","Power forwards"],["c","C","Centers"]];
var TABS=[["overall","Overall","Overall top 50"]].concat(POS).concat([["goat","All-Time","All-time top 10"]]);
var PICK=10, DEEP=50;
var POSL={};POS.forEach(function(p){POSL[p[0]]=p[1];});POSL.goat="All-Time";
function isGoat(k){return k==="goat";}
// Every list can grow to 50. 10 is the starting goal at each position; keep picking to add #11, #12 and on.
function cap(key){return DEEP;}

/* ---------- players (from the database; ids are permanent) ---------- */
var P=[], POOL={};
function loadPlayers(rows){
  P=[];POOL={goat:[]};POS.forEach(function(p){POOL[p[0]]=[];});var gl=[];
  rows.slice().sort(function(a,b){return (a.sort||0)-(b.sort||0)||a.id-b.id;}).forEach(function(r){
    var p={id:r.id,n:r.name,t:r.team||"",pos:r.pos,note:r.note||"",active:r.active!==false,
      s:r.pts==null?null:[r.games,+r.pts,+r.reb,+r.ast,+r.stl,+r.blk],goat:!!r.goat,c:r.career||null,j:r.jersey!=null&&r.jersey!==""?String(r.jersey):null};
    // Out for the season (note starts "Out for the season"): shown with an OUT tag, but left out of new Head 2 Head matchups.
    p.inj=/^out for the season/i.test(p.note);
    P[r.id]=p;if(p.active&&!p.inj&&POOL[p.pos])POOL[p.pos].push(r.id);if(p.goat)gl.push(p);});
  // All-time pool: everyone flagged goat (legends and current greats), in the curated order
  gl.forEach(function(p){if(p.c&&/[–-]$/.test(p.c.years||""))p.c.years+="now";}); // still playing: 2008–now
  POOL.goat=gl.sort(function(a,b){return ((a.c&&a.c.order)||0)-((b.c&&b.c.order)||0);}).map(function(p){return p.id;});
}
/* ---------- helpers ---------- */
var $=function(s,r){return (r||document).querySelector(s);};
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function f1(x){return (Math.round(x*10)/10).toFixed(1);}
var FMT=new Intl.DateTimeFormat("en-US",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23",weekday:"short"});
function et(ms){var o={};FMT.formatToParts(new Date(ms)).forEach(function(x){o[x.type]=x.value;});return o;}
var WD={Mon:0,Tue:1,Wed:2,Thu:3,Fri:4,Sat:5,Sun:6};
function dayKey(ms){var o=et(ms);return o.year+"-"+o.month+"-"+o.day;}
var MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dateLabel(iso){if(!iso)return "";var p=iso.split("-");return MON[+p[1]-1]+" "+(+p[2]);}
function initials(n){return n.split(/[\s-]+/).filter(Boolean).slice(0,2).map(function(w){return w[0];}).join("").toUpperCase();}

/* ---------- my state ---------- */
function blank(){var o={};TABS.forEach(function(p){o[p[0]]=[];});return o;}
var me={l:blank(),out:blank(),deep:{},xp:0,streak:0,last:""};
var LS="f2r-guest-v1";
// nav: board | pick | lists | me. tab = which Fan Board, pick = which list you're picking, list = which of your lists is open.
var ui={nav:"board",tab:"overall",pick:null,list:null,h2h:null,sheet:null};
try{var u0=JSON.parse(localStorage.getItem("f2r-ui2")||"null");if(u0){ui.nav=u0.nav||ui.nav;ui.tab=u0.tab||ui.tab;ui.pick=u0.pick||null;}}catch(e){}
function saveUI(){try{localStorage.setItem("f2r-ui2",JSON.stringify({nav:ui.nav,tab:ui.tab,pick:ui.pick}));}catch(e){}}

var LEVELS=[["Floor",0],["Bench",250],["Rotation",750],["Starter",2000],["All-Star",5000],["Rafters",10000]];
function level(xp){var i=0;LEVELS.forEach(function(l,j){if(xp>=l[1])i=j;});var nx=LEVELS[i+1];return {name:LEVELS[i][0],i:i,next:nx?nx[0]:null,toNext:nx?nx[1]-xp:0};}
// A streak only counts while it is alive: they picked today or yesterday (Eastern). Otherwise it has ended.
function streakNow(){var k=dayKey(Date.now()),y=dayKey(Date.now()-864e5);return (me.last===k||me.last===y)?(me.streak||0):0;}
function gainXP(n){var k=dayKey(Date.now()),y=dayKey(Date.now()-864e5);
  if(me.last!==k){me.streak=me.last===y?(me.streak||0)+1:1;me.last=k;}
  me.best=Math.max(me.best||0,me.streak||0);var old=level(me.xp||0).i;me.xp=(me.xp||0)+n;if(level(me.xp).i>old){if(typeof levelUpFx==="function")levelUpFx(level(me.xp).name);else toast("Level up: "+level(me.xp).name+"!");}}


// Overall: your own top 50 = the players in your five position top 10s, ranked against each other.
// Your position order is respected (your PG #3 always sits below your PG #2), which cuts the number of matchups.
function ovPool(){var o=[];for(var r=0;r<PICK;r++)POS.forEach(function(p){var id=me.l[p[0]][r];if(id!=null)o.push(id);});return o;}
// Your overall top 50 = your five position top 10s merged into one list.
// Your order inside each position always holds (your PG #3 never passes your PG #2).
// Across positions, the next spot goes to whichever position's next player rates higher:
// the fans' Overall board once real boards exist, otherwise a stats score (or, with no stats, his spot in the app's player list).
function baseVal(id){var b=boards.overall;
  if(b&&b.rows&&b.rows.length&&!b.sample){var r=fanRank("overall",id);if(r)return 100000-r.rank;}
  return statVal(id);}
function statVal(id){var p=P[id],s=p.s;
  if(s)return s[1]+1.2*s[2]+1.5*s[3]+2*s[4]+2*s[5];
  var pool=POOL[p.pos],i=pool.indexOf(id),near=[];
  for(var k=Math.max(0,i-3);k<=Math.min(pool.length-1,i+3);k++){var q=P[pool[k]];if(q.s)near.push(q.s[1]+1.2*q.s[2]+1.5*q.s[3]+2*q.s[4]+2*q.s[5]);}
  return near.length?near.reduce(function(a,b){return a+b;},0)/near.length*0.95:0;}
function syncOverall(){
  var heads=POS.map(function(p){return me.l[p[0]].slice(0,PICK);}),out=[],v={};
  heads.forEach(function(l){l.forEach(function(id){v[id]=baseVal(id);});});
  var pref=me.pref||{};
  function beats(x,y){if(pref[x+">"+y])return true;if(pref[y+">"+x])return false;return v[x]>v[y];}
  while(out.length<DEEP){var best=-1;
    for(var j=0;j<heads.length;j++)if(heads[j].length&&(best<0||beats(heads[j][0],heads[best][0])))best=j;
    if(best<0)break;out.push(heads[best].shift());}
  me.l.overall=out;}
function waiting(key){if(key==="overall"){var inL={};me.l.overall.forEach(function(id){inL[id]=1;});return ovPool().filter(function(id){return !inL[id];});}
  var seen={};me.l[key].forEach(function(id){seen[id]=1;});me.out[key].forEach(function(id){seen[id]=1;});return orderFor(key).filter(function(id){return !seen[id];});}
// Stars first: each position's players are sorted by star power (statVal), cut into tiers of 10,
// and shuffled inside each tier once per visit. New fans meet the big names first, and no two sessions run the same.
var ORDER={},TIER=10;
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1)),t=a[i];a[i]=a[j];a[j]=t;}return a;}
function orderFor(key){if(!ORDER[key]||ORDER[key].length!==POOL[key].length){var v={},a=POOL[key].slice();a.forEach(function(id){v[id]=statVal(id);});
  a.sort(function(x,y){return v[y]-v[x];});var out=[];for(var i=0;i<a.length;i+=TIER)out=out.concat(shuffle(a.slice(i,i+TIER)));ORDER[key]=out;}return ORDER[key];}
function flight(key,id){var L=me.l[key],C=cap(key);return L.length>=C?{key:key,cand:id,lo:0,hi:C,full:true,first:true}:{key:key,cand:id,lo:0,hi:L.length};}
function nextCand(key){var busy={};(ui.fly||[]).forEach(function(f){busy[f.cand]=1;});var w=waiting(key);for(var i=0;i<w.length;i++)if(!busy[w[i]])return w[i];return null;}
function h2hStart(key){if(key==="overall"){ui.h2h=null;return;}var w=waiting(key),L=me.l[key];ui.fly=[];
  if(!w.length){ui.h2h=null;return;}
  if(!L.length){if(w.length<2){L.push(w[0]);changed();ui.h2h=null;return;}ui.h2h={key:key,cand:w[1],seed:w[0],lo:0,hi:1};ui.fly=[ui.h2h];h2hMid();return;}
  for(var i=0;i<w.length&&ui.fly.length<2;i++)ui.fly.push(flight(key,w[i]));
  ui.h2h=ui.fly[0];h2hMid();}
// Opponent = a random player from the part of your list the new player could still land in (not always the middle),
// never the same opponent twice in a row when there's a choice.
var lastOpp=null,lastCand=null;
function h2hMid(){var h=ui.h2h,L=me.l[h.key],lo=h.lo,hi=h.hi,top=Math.min(hi,L.length)-1;
  if(h.seed!=null){h.mid=0;h.flip=Math.random()<.5;return;}
  if(h.full&&h.first)lo=Math.max(lo,top-2); // first test when your list is full: one of your bottom three
  var opts=[];for(var i=lo;i<=top;i++)opts.push(i);
  if(opts.length>1)opts=opts.filter(function(i){return L[i]!==lastOpp&&L[i]!==lastCand;});
  h.mid=opts.length?opts[Math.floor(Math.random()*opts.length)]:lo;h.first=false;h.flip=Math.random()<.5;}
function h2hOpp(h){return h.seed!=null?h.seed:me.l[h.key][h.mid];}
function h2hPick(candWins){haptic();var h=ui.h2h;if(h.rc)return rcPick(candWins);if(h.check)return ovCheckPick(candWins);
  var key=h.key,L=me.l[key],C=cap(key),before=L.length,msg=null;gainXP(10);lastOpp=h2hOpp(h);lastCand=h.cand;
  if(candWins)h.hi=h.mid;else h.lo=h.mid+1;
  var others=ui.fly.filter(function(f){return f!==h;});
  if(h.lo<h.hi&&!(h.full&&h.lo>=L.length)){ui.h2h=others[0]||h;h2hMid();render();return;} // not placed yet: switch to the other new player
  ui.fly=others;
  if(h.full&&h.lo>=C){me.out[key].push(h.cand);msg=null;} // lost to your #10: not in your top 10
  else{
    if(h.seed!=null)L.push(h.seed);
    var k=h.lo;L.splice(k,0,h.cand);msg=P[h.cand].n+" is your #"+(k+1)+".";
    ui.fly.forEach(function(f){if(k<f.lo){f.lo++;f.hi++;}else if(k<=f.hi)f.hi++;});
    if(L.length>C){var d=L.pop();me.out[key].push(d);msg+=" "+P[d].n+" drops out.";}
    ui.fly=ui.fly.filter(function(f){if(f.hi>L.length)f.hi=L.length;if(L.length>=C){f.full=true;if(f.hi>C)f.hi=C;}
      if(f.full&&f.lo>=C){me.out[key].push(f.cand);return false;}return true;});
    if(before<PICK&&L.length>=PICK){gainXP(25);msg="Your "+POSL[key]+" top 10 is set! Keep picking to add #11 and up, or lock it in.";if(firstTen())ui.first10=key;}
  }
  changed();
  while(ui.fly.length<2){var nc=nextCand(key);if(nc==null)break;ui.fly.push(flight(key,nc));}
  if(!ui.fly.length){ui.h2h=null;ui.hang=key;toast("Every "+POSL[key]+" checked. Your list is locked in.");render();return;}
  ui.h2h=ui.fly[0];h2hMid();if(ui.first10&&!ui.sheet){var fk=ui.first10;ui.first10=null;render();ui.shareKey=fk;ui.sheet="first10";renderSheet();return;}if(msg)toast(msg);render();}
function next(key){h2hStart(key);if(!ui.h2h&&!waiting(key).length)toast(key==="overall"?(me.l.overall.length>=DEEP?"Your overall top 50 is set!":"Everyone you've picked so far is ranked."):"Every "+POSL[key]+" checked. Your list is locked in.");render();}
function h2hSkip(){var h=ui.h2h,key=h.key;me.out[key].push(h.cand);ui.fly=(ui.fly||[]).filter(function(f){return f!==h;});changed();
  var nc=nextCand(key);if(nc!=null)ui.fly.push(flight(key,nc));ui.h2h=ui.fly[0]||null;if(ui.h2h)h2hMid();render();}
function lockIn(key){waiting(key).forEach(function(id){me.out[key].push(id);});ui.h2h=null;ui.hang=key;changed();gainXP(25);toast("Locked in. Your "+POSL[key]+" top "+me.l[key].length+" counts on the Fan Board now.");render();}
function recheck(key){me.out[key]=[];changed();h2hStart(key);render();}


// ---- Re-check a list head to head: a random pair of neighbors; if the lower one wins they swap.
// Fresh every session, so a list is never locked for good. Swaps open up new neighbor pairs, so it settles like a sort.
var rcLast=[];
function rcPairs(){var k=ui.rc.key,L=me.l[k],n=Math.min(L.length,Math.max(PICK,ui.rc.n||PICK)),out=[];
  for(var i=1;i<n;i++)if(!ui.rc.done[L[i-1]+"|"+L[i]])out.push(i);return out;}
function rcNext(){var L=me.l[ui.rc.key],all=rcPairs();
  if(!all.length){ui.h2h=null;return false;}
  var fresh=all.filter(function(i){return rcLast.indexOf(L[i])<0&&rcLast.indexOf(L[i-1])<0;});
  var pool=fresh.length?fresh:all,i=pool[Math.floor(Math.random()*pool.length)];
  ui.h2h={key:ui.rc.key,rc:true,i:i,cand:L[i],mid:i-1,flip:Math.random()<.5};rcLast=[L[i],L[i-1]];return true;}
function rcStart(key){ui.rc={key:key,done:{},moves:0,n:me.l[key].length};ui.ovCheck=false;ui.nav="pick";ui.pick=key;ui.h2h=null;rcLast=[];rcNext();render();window.scrollTo(0,0);}
function rcPick(candWins){var h=ui.h2h,k=h.key,L=me.l[k],i=h.i,a=L[i-1],b=L[i];gainXP(10);
  if(candWins){L[i-1]=b;L[i]=a;ui.rc.moves++;ui.rc.done[b+"|"+a]=1;changed();toast(lnm(P[b].n)+" moves up to #"+i+".");}
  else ui.rc.done[a+"|"+b]=1;
  if(!rcNext()){var m=ui.rc.moves;ui.rc=null;gainXP(25);toast(m?"Order checked. "+m+" move"+(m===1?"":"s")+" made.":"Order checked. Your list held up.");ui.nav="lists";ui.list=k;}
  render();}
function rcLeft(){return ui.rc?rcPairs().length:0;}

// ---- Check my top 50: neighbors from different positions, top to bottom ----
// Random order: any unchecked pair of neighbors from different positions, never repeating a name from the last matchup when there's a choice.
var ovLast=[];
function ovCheckNext(){var L=me.l.overall,pref=me.pref||{},all=[];
  for(var i=1;i<L.length;i++){var a=L[i-1],b=L[i];if(P[a].pos!==P[b].pos&&!pref[a+">"+b]&&!pref[b+">"+a])all.push(i);}
  if(!all.length){ui.h2h=null;return false;}
  var fresh=all.filter(function(i){return ovLast.indexOf(L[i])<0&&ovLast.indexOf(L[i-1])<0;});
  var pool=fresh.length?fresh:all,i=pool[Math.floor(Math.random()*pool.length)];
  ui.h2h={key:"overall",check:true,i:i,cand:L[i],mid:i-1,flip:Math.random()<.5};ovLast=[L[i],L[i-1]];return true;}
function ovCheckPick(candWins){var h=ui.h2h,L=me.l.overall,a=L[h.i-1],b=L[h.i];me.pref=me.pref||{};gainXP(10);
  if(candWins)me.pref[b+">"+a]=1;else me.pref[a+">"+b]=1;
  changed(); // rebuilds the overall with the new answer
  if(!ovCheckNext()){ui.ovCheck=false;gainXP(25);toast("Your top 50 is checked.");ui.nav="lists";ui.list="overall";}
  render();}
function ovCheckLeft(){var L=me.l.overall,pref=me.pref||{},n=0;for(var i=1;i<L.length;i++){var a=L[i-1],b=L[i];if(P[a].pos!==P[b].pos&&!pref[a+">"+b]&&!pref[b+">"+a])n++;}return n;}

/* ---------- brand helpers ---------- */
var TC={ATL:"#E03A3E",BOS:"#007A33",BKN:"#C9CBD0",CHA:"#00788C",CHI:"#CE1141",CLE:"#860038",DAL:"#00538C",DEN:"#FEC524",DET:"#C8102E",GSW:"#FFC72C",
  HOU:"#CE1141",IND:"#FDBB30",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",MIA:"#98002E",MIL:"#00471B",MIN:"#236192",NOP:"#85714D",NYK:"#F58426",
  OKC:"#EF3B24",ORL:"#0077C0",PHI:"#ED174C",PHX:"#E56020",POR:"#E03A3E",SAC:"#5A2D81",SAS:"#C4CED4",TOR:"#CE1141",UTA:"#6C3FA0",WAS:"#E31837"};
function tc(p){return TC[p&&p.t]||"#7C82A6";}
function bigPos(p){return p.pos==="pf"||p.pos==="c";}
function teamTag(p){return (p.inj?'<span class="tag" title="Out for the season">OUT</span>':'')+(p.t?'<span class="tm">'+esc(p.t)+'</span>':'');}
var CHEV={up:"M1 10 L8 3 L15 10",down:"M1 2 L8 9 L15 2"};
function chev(dir,w){w=w||12;return '<svg width="'+w+'" height="'+Math.round(w*.75)+'" viewBox="0 0 16 12" aria-hidden="true"><path d="'+CHEV[dir]+'" fill="none" stroke="currentColor" stroke-width="3.5"/></svg>';}
function moveHTML(prev,rank,hasPrev){
  if(!hasPrev)return "";
  if(prev==null)return '<span class="mv new">NEW</span>';
  var d=prev-rank;
  if(d>=5)return '<span class="mv up big" aria-label="up '+d+'"><span class="ch">'+chev("up")+'</span>'+d+'</span>'; // big climbs get a blue streak under the arrow
  if(d>0)return '<span class="mv up" aria-label="up '+d+'">'+chev("up")+d+'</span>';
  if(d<0)return '<span class="mv down" aria-label="down '+(-d)+'">'+chev("down")+(-d)+'</span>';
  return '<span class="mv" aria-label="no change">–</span>';}
function cutLine(){return '<div class="cut" aria-hidden="true"><span>▲ TOP 5</span></div>';}
function numCls(i){return "n"+(i<5?" t5":"");}
function ghost(rk){return '<span class="ghost" aria-hidden="true">'+rk+'</span>';}
function fmt(n){return Number(n||0).toLocaleString("en-US");}
// Two-line names (first / last). Each line stays on one line; fitNames() shrinks it just enough if it's too wide.
function splitName(n){var w=n.split(" ");if(w.length<2)return '<span class="ln">'+esc(n)+'</span>';return '<span class="ln">'+esc(w[0])+'</span><span class="ln">'+esc(w.slice(1).join(" "))+'</span>';}
function nbCls(n){return n.length>19?" xlong":n.length>14?" long":"";}
function statLine(p){var s=p.s;return s?f1(s[1])+" PTS · "+f1(s[2])+" REB · "+f1(s[3])+" AST":esc(p.note);}
function fix(o,cap){var out=blank();if(o)TABS.forEach(function(p){var seen={};out[p[0]]=(o[p[0]]||[]).filter(function(id){if(!P[id]||seen[id]||(p[0]==="goat"?!P[id].goat:(p[0]!=="overall"&&P[id].pos!==p[0])))return false;seen[id]=1;return true;}).slice(0,cap);});return out;}
var ICON={
  board:'<path d="M5 20V10M12 20V4M19 20v-7"/>',
  lists:'<path d="M5 6h14M5 12h14M5 18h9"/>',
  pick:'<path d="M4 6h7v12H4zM13 6h7v12h-7z"/>',
  me:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  groups:'<circle cx="8" cy="9" r="3"/><circle cx="16.5" cy="9" r="3"/><path d="M2.5 20c0-3 2.5-5 5.5-5s5.5 2 5.5 5M13 15.4c1-.3 2.1-.4 3.5-.4 3 0 5.5 2 5.5 5"/>'};
function icon(k){return '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true">'+ICON[k]+'</svg>';}

// All-time cards: career line and trophies
function careerLine(p){var c=p.c;if(!c)return "";return f1(c.pts)+" PTS · "+f1(c.reb)+" REB · "+f1(c.ast)+" AST";}
function trophies(p){var c=p.c;if(!c)return "";var t=[];if(c.rings)t.push(c.rings+"× champ");if(c.mvp)t.push(c.mvp+"× MVP");return t.join(" · ")||(c.allstar?c.allstar+"× All-Star":"");}
// All-Time awards, in scoreboard order. HOF is yes/no; active players can't be in yet.
var AWARDS=[["TITLES","rings"],["MVP","mvp"],["FINALS MVP","fmvp"],["DPOY","dpoy"],["ALL-STAR","allstar"],["ALL-NBA","allnba"],["ALL-DEFENSE","alldef"]]; // Hall of Fame shows as a tag on the card, not a row
function hofTag(p){var c=p&&p.c;if(!c||c.hof==null)return "";return c.hof?'<span class="hof">HALL OF FAME</span>':(p.active!==false&&/now$/.test(c.years||"")?'<span class="hof no">ACTIVE</span>':'');}
function awardBoard(a,b){
  var h='<div class="sb3"><div class="hd3"><span>'+esc(a.n.split(" ").slice(-1)[0])+'</span><span>AWARDS</span><span>'+esc(b.n.split(" ").slice(-1)[0])+'</span></div>';
  AWARDS.forEach(function(w){var k=w[1],x=a.c[k],y=b.c[k],hof=k==="hof";
    var xv=hof?(x?1:0):(+x||0),yv=hof?(y?1:0):(+y||0),ax=xv>yv?" w":"",bx=yv>xv?" w":"";
    var fx=hof?(x?"✓":"—"):String(xv),fy=hof?(y?"✓":"—"):String(yv);
    h+='<div class="r3"><b class="'+ax+'">'+fx+'</b><span>'+w[0]+'</span><b class="'+bx+'">'+fy+'</b></div>';});
  return h+'</div>';}
// In the all-time game a player shows with the team he played most for (LeBron = CLE), not his current team.
function asGoat(p){return p&&p.c&&p.c.team?Object.assign({},p,{t:p.c.team}):p;}

/* ---------- views: Pick, My Lists, Me ---------- */
function firstOpen(){for(var i=0;i<POS.length;i++)if(me.l[POS[i][0]].length<PICK)return POS[i][0];return "overall";}
function posDone(){var n=0;POS.forEach(function(p){if(me.l[p[0]].length>=PICK)n++;});return n;}
function poolSize(){var n=0;POS.forEach(function(p){n+=Math.min(me.l[p[0]].length,PICK);});return n;}
function listName(key){return key==="overall"?"overall top 50":POSL[key]+" top "+cap(key);}

function pickTabs(key){
  return '<nav class="tabs" aria-label="What you\'re ranking">'+POS.concat([["goat","ALL-TIME"]]).map(function(t){var k=t[0],done=k!=="overall"&&me.l[k].length>=PICK;
    return '<button class="tb'+(k==="overall"?" ov":isGoat(k)?" gt":"")+(done?" done":"")+'" data-pick="'+k+'" aria-pressed="'+(k===key)+'">'+(k==="overall"?"OVERALL":t[1])+'</button>';}).join("")+'</nav>';}

// Your list builds live under every matchup, so each tap visibly does something.
function soFarHTML(key){
  var L=me.l[key],C=Math.max(PICK,L.length),h='<span class="kicker">'+(key==="overall"?"Your overall list so far":"Your "+POSL[key]+" list so far")+(L.length>PICK?' · '+L.length+' ranked':'')+'</span><div class="list">';
  for(var i=0;i<C;i++){var id=L[i],p=isGoat(key)?asGoat(P[id]):P[id];
    var hl=ui.h2h&&(ui.h2h.check&&key==="overall"||ui.h2h.rc&&ui.h2h.key===key)&&(i===ui.h2h.i||i===ui.h2h.i-1);
    h+=p?'<div class="r mini'+(hl?' hl':'')+'" data-rid="'+id+'" style="--tc:'+tc(p)+'"><span class="'+numCls(i)+'">'+(i+1)+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span></span>'+(key==="overall"?'<span class="pp">'+POSL[p.pos]+'</span>':'')+teamTag(p)+'</div>'
      :'<div class="r mini slot"><span class="n">'+(i+1)+'</span><span class="who"><span class="nm">—</span></span></div>';
    if(i===4)h+=cutLine();if(i===9&&C>PICK)h+=cutLine().replace('▲ TOP 5','▲ TOP 10');}
  return h+'</div>';
}

function pickHTML(){
  if(ui.pick==="overall"&&ui.ovCheck)return ovCheckHTML();
  if(ui.rc&&ui.rc.key===ui.pick)return rcHTML(ui.pick);
  var key=ui.pick;if(!key||key==="overall")key=firstOpen()==="overall"?"pg":firstOpen();ui.pick=key;
  var L=me.l[key],C=cap(key),w=waiting(key),h='';
  if(w.length&&(!ui.h2h||ui.h2h.key!==key))h2hStart(key);
  var on=ui.h2h&&ui.h2h.key===key;
  h+='<div class="hrow"><h1 class="h1">Make your pick</h1><span class="meta">'+POSL[key]+' · '+(L.length<PICK?L.length+' of 10':L.length+' ranked')+'</span></div>';
  h+='<div class="bar"><i style="width:'+Math.min(100,L.length/PICK*100)+'%"></i></div>'+pickTabs(key);
  if(!on)return h+lockedHTML(key);
  if(L.length>=PICK)h+='<div class="card"><span class="big">'+(L.length>PICK?'Top '+L.length+' and counting':'Top 10 set')+'</span><p class="sub">It already counts on the Fan Board. Keep picking to add more players to your list, or lock it in. '+w.length+' '+POSL[key]+(w.length===1?"":"s")+' left to check.</p><button class="btn" data-lock>Lock in my top '+L.length+'</button></div>';
  return splitWrap(h+h2hHTML(key)+'<!--split-->'+soFarHTML(key));
}

function statsPanel(a,b,key){
  if(isGoat(key)&&a.c&&b.c){var rows=[["PTS","pts"],["REB","reb"],["AST","ast"],["STL","stl"],["BLK","blk"]];
    return '<div class="stats"><span class="kicker">Career · regular season per game</span>'+rows.map(function(r){
      var ra=a.c[r[1]],rb=b.c[r[1]],na=ra==null,nb=rb==null,x=+ra||0,y=+rb||0,cmp=!na&&!nb,wa=cmp&&x+y>0?Math.round(x/(x+y)*100):50,ax=cmp&&x>y?" win":"",bx=cmp&&y>x?" win":"";
      return '<div class="sr"><div class="l"><span class="tr"><b class="'+ax+'" style="width:'+(na?0:wa)+'%"></b></span><span class="v'+ax+'">'+(na?"—":f1(x))+'</span></div><span class="k">'+r[0]+'</span><div class="rr"><span class="v'+bx+'">'+(nb?"—":f1(y))+'</span><span class="tr"><b class="'+bx+'" style="width:'+(nb?0:100-wa)+'%"></b></span></div></div>';}).join("")+
      ((a.c.stl==null||b.c.stl==null)?'<p class="note center">— Steals and blocks weren\'t tracked before 1973-74.</p>':'')+'</div>'+awardBoard(a,b);}
  if(!a.s||!b.s)return '<div class="stats"><span class="kicker">Rookie or new to the list</span><p class="note center">'+esc(!a.s?a.n+": "+a.note:b.n+": "+b.note)+'</p></div>';
  var big=bigPos(a)||bigPos(b),rows=[["PTS",1],["REB",2],["AST",3],big?["BLK",5]:["STL",4]];
  return '<div class="stats"><span class="kicker">'+esc(CFG.statsLabel||"Last season")+' · per game</span>'+rows.map(function(r){
    var x=a.s[r[1]],y=b.s[r[1]],wa=x+y>0?Math.round(x/(x+y)*100):50,ax=x>y?" win":"",bx=y>x?" win":"";
    return '<div class="sr"><div class="l"><span class="tr"><b class="'+ax+'" style="width:'+wa+'%"></b></span><span class="v'+ax+'">'+f1(x)+'</span></div><span class="k">'+r[0]+'</span><div class="rr"><span class="v'+bx+'">'+f1(y)+'</span><span class="tr"><b class="'+bx+'" style="width:'+(100-wa)+'%"></b></span></div></div>';}).join("")+'</div>';
}
function rankNote(key,p){if(key!=="overall"){var r=me.l[key].indexOf(p.id);return r>-1?" · YOUR #"+(r+1):"";}var q=me.l[p.pos].indexOf(p.id);return q>-1?" · YOUR "+POSL[p.pos]+" #"+(q+1):"";}
function h2hHTML(key){
  var h=ui.h2h,c=isGoat(key)?asGoat(P[h.cand]):P[h.cand],o=isGoat(key)?asGoat(P[h2hOpp(h)]):P[h2hOpp(h)],a=h.flip?o:c,b=h.flip?c:o,left=waiting(key).length,ov=key==="overall";
  function pc(p,side,rt){return '<button class="pc'+(rt?" rt":"")+'" data-side="'+side+'" style="--tc:'+tc(p)+'" aria-label="Pick '+esc(p.n)+'"><span class="ph'+(p.j!=null?' jn':'')+'" aria-hidden="true">'+esc(p.j!=null?p.j:(p.t||POSL[p.pos]))+'</span>'+(isGoat(key)?hofTag(p):'')+'<span class="pn'+(p.n.split(" ").some(function(w){return w.length>9;})?" long":"")+'">'+splitName(p.n)+'</span><span class="ps">'+(isGoat(key)&&p.c?esc(p.c.years)+(trophies(p)?' · '+esc(trophies(p)):''):(p.t?esc(p.t)+' · ':'')+POSL[p.pos])+rankNote(key,p)+'</span></button>';}
  return '<section class="h2h'+(isGoat(key)?' gt':'')+'" aria-label="Head to head">'+
    '<div class="cards">'+pc(a,"a",false)+pc(b,"b",true)+'</div>'+
    '<div class="vs" aria-hidden="true"><span style="background:linear-gradient(90deg,transparent,'+tc(a)+')"></span><b>VS</b><span style="background:linear-gradient(90deg,'+tc(b)+',transparent)"></span></div>'+
    statsPanel(a,b,key)+
    '<div class="nbs"><button class="nb'+(ov?" blue":"")+nbCls(a.n)+'" data-side="a">'+esc(a.n)+'</button><button class="nb'+(ov?" blue":"")+nbCls(b.n)+'" data-side="b">'+esc(b.n)+'</button></div>'+
    '<div class="h2h-foot">'+(ov?'<span class="note">Each pick places a player in your top 50.</span><span class="note">'+left+' to place</span>':'<button class="link mute" data-skip>Skip '+esc(lnm(c.n))+'</button><span class="note">'+left+' '+(isGoat(key)?(left===1?"player":"players"):POSL[key]+(left===1?"":"s"))+' left to check</span>')+'</div>'+
    '</section>';
}
function lockedHTML(key){
  var L=me.l[key],C=cap(key),nx=null;ui.hangNow=ui.hang;ui.hang=null;
  for(var j=0;j<POS.length;j++){if(me.l[POS[j][0]].length<PICK&&POS[j][0]!==key){nx=POS[j];break;}}
  var h='<section class="locked card"><div class="hrow"><span class="kicker purple">Your '+POSL[key]+' top '+L.length+'</span><span class="xp">LOCKED</span></div><h2 class="h">Locked<br>in.</h2>'+
    '<p class="sub">Your list counts on the '+POSL[key]+' Fan Board now.'+(isGoat(key)?'':nx?' '+(5-posDone())+' position'+(5-posDone()===1?"":"s")+' to go.':' All five positions done.')+'</p></section>';
  h+='<div class="list">'+L.map(function(id,i){var p=isGoat(key)?asGoat(P[id]):P[id];return '<button class="r mini'+(ui.hangNow===key?' hang':'')+'" data-pid="'+id+'" style="--tc:'+tc(p)+';--i:'+i+'"><span class="'+numCls(i)+'">'+(i+1)+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span></span>'+teamTag(p)+'</button>'+(i===4&&L.length>5?cutLine():i===9&&L.length>10?cutLine().replace('▲ TOP 5','▲ TOP 10'):"");}).join("")+'</div>';
  var B=[];
  if(me.out[key].length&&L.length<DEEP)B.push(['keep','data-recheck','<span class="plus" aria-hidden="true">+</span>Keep going: add #'+(L.length+1)+' and up']);
  if(L.length)B.push(['','data-share="'+key+'"','Share my top 10']);
  if(L.length>1)B.push(['','data-rc="'+key+'"','Re-check my order head to head']);
  if(isGoat(key))B.push(['','data-go-board="goat"','See the All-Time Fan Board']);
  else B.push(nx?['','data-pick="'+nx[0]+'"','Next: your '+nx[1]+' top 10']:['','data-list="overall"','See my overall top 50']);
  // one main button (filled); the rest are outlined so the next step is obvious
  h+='<div class="acts">'+B.map(function(x,i){return '<button class="btn'+(i?' ghost':'')+(x[0]?' '+x[0]:'')+'" '+x[1]+'>'+x[2]+'</button>';}).join("")+'</div>';
  return h;
}

function rcHTML(key){
  if(!ui.h2h||!ui.h2h.rc)rcNext();
  var L=me.l[key],n=rcLeft(),g=isGoat(key),h='<div class="hrow"><h1 class="h1">Make your pick</h1><span class="meta">'+n+' check'+(n===1?'':'s')+' left</span></div>'+pickTabs(key);
  h+='<span class="kicker '+(g?'purple':'blue')+'">Re-check your '+(g?'All-Time':POSL[key])+' top '+Math.max(PICK,Math.min(L.length,ui.rc.n||PICK))+'</span>';
  if(!ui.h2h){ui.rc=null;return h+lockedHTML(key);}
  h+='<p class="note">Your #'+ui.h2h.i+' vs #'+(ui.h2h.i+1)+'. Tap who you\'d rank higher. If it\'s #'+(ui.h2h.i+1)+', they swap.</p>';
  return h+h2hHTML(key).replace(/<div class="h2h-foot">[\s\S]*?<\/div>/,'<div class="h2h-foot"><button class="link mute" data-rcdone>Looks right, I\'m done</button><span class="note">'+(ui.rc.moves?ui.rc.moves+' move'+(ui.rc.moves===1?'':'s')+' so far':'Nothing moved yet')+'</span></div>')+soFarHTML(key);
}
function ovCheckHTML(){
  if(!ui.h2h||!ui.h2h.check)ovCheckNext();
  var L=me.l.overall,h='<span class="kicker blue">Check your top 50</span><div class="hrow"><h1 class="h1">Make your pick</h1><span class="meta">'+ovCheckLeft()+' check'+(ovCheckLeft()===1?'':'s')+' left</span></div>';
  if(!ui.h2h){ui.ovCheck=false;return h+'<div class="card blue"><span class="big">All checked</span><p class="sub">Every cross-position neighbor in your top 50 has a pick.</p><button class="btn blue" data-list="overall">See my top 50</button></div>';}
  h+='<p class="note">Your #'+ui.h2h.i+' vs #'+(ui.h2h.i+1)+'. Tap who you\'d rank higher.</p>';
  return h+h2hHTML("overall").replace('<span class="note">Each pick places a player in your top 50.</span>','<button class="link mute" data-ovdone>Looks right, I\'m done</button>').replace(/<span class="note">\d+ to place<\/span>/,'')+soFarHTML("overall");
}
function myListsHTML(){
  if(ui.list)return listDetailHTML(ui.list);
  var L=me.l.overall,d=posDone(),h='<h1 class="h1">My lists</h1>';
  h+='<button class="card blue" data-list="overall"><span class="kicker blue">Your overall top 50</span><span class="big">'+(L.length?(L.length>=DEEP?"Top 50 set":L.length+" players so far"):"Builds itself")+'</span><span class="bar blue"><i style="width:'+(L.length/DEEP*100)+'%"></i></span><span class="sub" style="font-size:13px">Built automatically from your five position lists. Your vote on the Overall board. Open ›</span></button>';
  var G=me.l.goat,gd=G.length>=PICK;
  h+='<button class="card gt" data-'+(gd?'list':'pick')+'="goat"><span class="kicker purple">All-time top 10 · separate game</span><span class="big">'+(gd?'Top '+G.length+' locked':G.length?G.length+' of 10 picked':'Best players ever')+'</span><span class="bar"><i style="width:'+Math.min(100,G.length*10)+'%"></i></span><span class="sub" style="font-size:13px">Jordan, LeBron, Kareem, Curry… head to head. Your vote on the All-Time Fan Board. '+(gd?'Open ›':'Start ›')+'</span></button>';
  h+='<span class="kicker" style="margin-top:6px">Position top 10s · '+d+' of 5 done</span>';
  h+=POS.map(function(p){var n=me.l[p[0]].length,done=n>=PICK;
    return '<button class="card lcard" data-'+(done?"list":"pick")+'="'+p[0]+'"><span class="pos">'+p[1]+'</span><span class="mid"><span class="t">'+(done?"Top "+(n>PICK?n:10)+" locked":n?n+" of 10 picked":"Not started")+'</span><span class="bar thin"><i style="width:'+Math.min(100,n*10)+'%"></i></span></span><span class="go'+(done?" tint":"")+'">'+(done?"VIEW":n?"KEEP GOING":"START")+'</span></button>';}).join("");
  return h;
}
function listDetailHTML(key){
  var L=me.l[key],ov=key==="overall",w=waiting(key).length,h='<button class="back" data-list="">‹ My Lists</button>';
  if(ov)h+='<span class="kicker blue">Your vote on the Overall board</span>';
  h+='<div class="hrow"><h1 class="h1">'+(ov?"My top 50":"My "+POSL[key]+" top "+Math.max(PICK,L.length))+'</h1><span class="meta">'+(L.length?(ov?L.length+" of 50":"Drag to fine-tune"):"")+'</span></div>';
  if(ov)h+='<p class="note">Built automatically from your five position top 10s. Your order inside each position always holds; across positions it uses '+(boards.overall&&boards.overall.rows&&boards.overall.rows.length&&!boards.overall.sample?"the fans\' Overall board":"player stats")+'. Not quite right? Check it head to head, or reorder a position list.</p>';
  if(ov)h+='<div class="bar blue"><i style="width:'+(L.length/DEEP*100)+'%"></i></div>';
  if(!L.length)return h+'<div class="empty"><b>Nothing here yet.</b><br>'+(ov&&!poolSize()?"Fill a position top 10 first.":"Start picking and your list fills in.")+'</div><button class="btn" data-pick="'+(ov?firstOpen():key)+'">Start picking</button>';
  var b=boards[ov?"overall":key];ensureBoard(ov?"overall":key);
  if(b&&b.rows&&b.rows.length)h+='<p class="note">Tags show where the fans have each player. Hot take = 5+ spots off.</p>';
  h+='<div class="list" id="'+(ov?'ovlist':'mylist')+'">'+L.map(function(id,i){var p=isGoat(key)?asGoat(P[id]):P[id];
    return '<div class="r" data-id="'+id+'" style="--tc:'+tc(p)+'"><span class="'+numCls(i)+'">'+(i+1)+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span><span class="sc">'+(isGoat(key)&&p.c?esc(p.c.years)+' · '+esc(trophies(p)):(ov?POSL[p.pos]+' · ':'')+(p.t?esc(p.t):''))+'</span></span>'+fanTag(ov?"overall":key,id,i)+(ov?'':'<span class="grip" aria-hidden="true">⠿</span>')+'</div>';}).join("");
  if(!ov)for(var i=L.length;i<PICK;i++)h+='<div class="r slot"><span class="n">'+(i+1)+'</span><span class="who"><span class="nm">—</span></span></div>';
  h+='</div>';
  var acts=[];
  if(ov&&L.length>1&&ovCheckLeft())acts.push('<button class="btn blue sm" data-ovcheck>Check it head to head</button>');
  if(ov&&poolSize()<50&&firstOpen()!=="overall")acts.push('<button class="btn sm" data-pick="'+firstOpen()+'">Next: my '+POSL[firstOpen()]+' top 10</button>');
  else if(!ov&&w)acts.push('<button class="btn sm" data-pick="'+key+'">Keep picking</button>');
  else if(!ov&&me.out[key].length&&L.length<DEEP)acts.push('<button class="btn sm" data-recheck>Add more</button>');
  if(!ov&&L.length>1&&!w)acts.push('<button class="btn blue sm" data-rc="'+key+'">Re-check head to head</button>');
  if(L.length)acts.push('<button class="btn tint sm" data-share="'+key+'">Share</button>');
  if(acts.length)h+='<div class="btns">'+acts.join("")+'</div>';
  return h;
}

function hotTakes(){var b=boards.overall;if(!b||!b.rows||!b.rows.length)return null;var n=0;me.l.overall.forEach(function(id,i){var r=fanRank("overall",id);if(!r||Math.abs(r.rank-(i+1))>=5)n++;});return n;}
function displayName(){if(me.name)return me.name;if(!user)return "Guest";var e=(user.email||"fan").split("@")[0];return e.replace(/[._-]+/g," ").split(" ")[0]||"Fan";}
function meHTML(){
  var xp=me.xp||0,lv=level(xp),nxt=LEVELS[lv.i+1],base=LEVELS[lv.i][1],pct=nxt?Math.round((xp-base)/(nxt[1]-base)*100):100;
  var chevs='';for(var i=0;i<Math.max(1,Math.min(3,lv.i));i++)chevs+='<svg width="26" height="9" viewBox="0 0 26 9" aria-hidden="true"><path d="M2 8 L13 2 L24 8" fill="none" stroke="#3DE1FF" stroke-width="3"/></svg>';
  var h='<div class="prof"><div class="badge" aria-label="'+esc(lv.name)+' level">'+chevs+'</div><div><h1 class="name">'+esc(displayName())+proTag()+'</h1><span class="sub" style="font-size:13px">'+esc(lv.name)+(streakNow()>1?' · '+streakNow()+'-day streak':'')+'</span></div></div>';
  h+='<div class="xprow"><span>'+esc(lv.name).toUpperCase()+'</span><span>'+fmt(xp)+(nxt?' / '+fmt(nxt[1]):'')+' XP</span></div><div class="bar blue"><i style="width:'+pct+'%"></i></div>';
  h+='<p class="note">'+(nxt?fmt(nxt[1]-xp)+' XP to '+nxt[0]+'. Every pick is +10, every full top 10 +25.':'Top level. You live in the rafters.')+'</p>';
  var ht=hotTakes();
  h+='<div class="tiles"><div class="tile p"><b>'+posDone()+' / 5</b><span>TOP 10s LOCKED</span></div><div class="tile b"><b>'+me.l.overall.length+' / 50</b><span>OVERALL TOP 50</span></div><div class="tile"><b>'+streakNow()+'</b><span>DAY STREAK</span></div><div class="tile"><b>'+(ht==null?"—":ht)+'</b><span>HOT TAKES</span></div></div>';
  h+=badgesHTML();
  var one=me.l.overall[0];
  if(one!=null){var r=fanRank("overall",one);h+='<button class="card blue" data-pid="'+one+'"><span class="kicker blue">Your #1 overall</span><span class="big">'+esc(P[one].n)+'</span><span class="sub" style="font-size:13px">'+(r?"The fans have him #"+r.rank+".":"He's not on the fans' board yet.")+'</span></button>';}
  if(!user&&!demo)h+='<div class="nudge"><span>Sign in so your lists count on the Fan Board.</span><button class="link" data-signin>Sign in</button></div>';
  if(isAdmin||demo)h+='<span class="set-h">ADMIN</span><div class="menu adm-menu"><button data-nav="admin">Admin numbers<span>'+(demo?'Sample':'›')+'</span></button><button data-posts>Make board posts<span>›</span></button>'+'</div><span class="set-h">MORE</span>';
  h+='<div class="menu">'+
    '<button data-nav="groups">My groups<span>›</span></button>'+
    (proOn()&&(!NATIVE||isPro())?'<button data-pro>F2R Pro<span>'+(isPro()?'Active':'›')+'</span></button>':'')+
    '<button data-share-any>Share my lists<span>›</span></button>'+
    '<button data-how>How it works<span>›</span></button>'+
    '<button data-nav="settings">Settings<span>›</span></button>'+
    '<button data-nav="feedback">Send feedback<span>›</span></button>'+
    (user?'<button data-signout>Sign out<span>'+esc(user.email||"")+'</span></button>':demo?'':'<button data-signin>Sign in<span>›</span></button>')+
    '<a href="/privacy.html">Privacy<span>›</span></a><a href="/terms.html">Terms<span>›</span></a></div>';
  return h;
}


/* ---------- wiring ---------- */
function goPick(key){ui.rc=null;ui.nav="pick";ui.pick=key;ui.h2h=null;saveUI();render();window.scrollTo(0,0);}
function goList(key){ui.rc=null;ui.nav="lists";ui.list=key||null;ui.h2h=null;saveUI();render();window.scrollTo(0,0);}
function wire(app){
  app.querySelectorAll("[data-nav]").forEach(function(b){b.onclick=function(e){if(e&&e.preventDefault)e.preventDefault();var n=b.dataset.nav;hideAfter();if(n==="lists")ui.list=null;ui.nav=n;ui.h2h=null;saveUI();render();window.scrollTo(0,0);};});
  app.querySelectorAll("[data-tab]").forEach(function(b){b.onclick=function(){ui.tab=b.dataset.tab;saveUI();render();};});
  app.querySelectorAll("[data-pick]").forEach(function(b){b.onclick=function(e){e.stopPropagation();goPick(b.dataset.pick);};});
  app.querySelectorAll("[data-list]").forEach(function(b){b.onclick=function(){goList(b.dataset.list);};});
  app.querySelectorAll("[data-recheck]").forEach(function(b){b.onclick=function(){var k=ui.nav==="lists"?ui.list:ui.pick;recheck(k);goPick(k);};});
  var sk=$("[data-skip]",app);if(sk)sk.onclick=h2hSkip;
  var oc=$("[data-ovcheck]",app);if(oc)oc.onclick=function(){ui.ovCheck=true;ui.nav="pick";ui.pick="overall";ui.h2h=null;ovCheckNext();render();window.scrollTo(0,0);};
  app.querySelectorAll("[data-rc]").forEach(function(b){b.onclick=function(e){e.stopPropagation();rcStart(b.dataset.rc);};});
  var rd=$("[data-rcdone]",app);if(rd)rd.onclick=function(){var k=ui.rc&&ui.rc.key,m=ui.rc?ui.rc.moves:0;ui.rc=null;ui.h2h=null;toast(m?"Saved. "+m+" move"+(m===1?"":"s")+" made.":"No changes. Your list held up.");goList(k);};
  var od=$("[data-ovdone]",app);if(od)od.onclick=function(){ui.ovCheck=false;ui.h2h=null;goList("overall");};
  app.querySelectorAll("[data-side]").forEach(function(b){b.onclick=function(){pickTap(b.dataset.side);};});
  var ml=$("#mylist",app);
  if(ml&&window.Sortable)Sortable.create(ml,{draggable:".r[data-id]",delay:120,delayOnTouchOnly:true,animation:150,onStart:function(){dragging=true;},onEnd:function(){setTimeout(function(){dragging=false;},0);
    me.l[ui.list]=[].map.call(ml.querySelectorAll(".r[data-id]"),function(r){return +r.dataset.id;});changed();render();}});
}
var toastT=null, dragging=false;
function toast(m){if(window.__capT){window.__capT.push(m);return;}if(typeof hideAfter==="function")hideAfter();var t=$("#toast");t.textContent=m;t.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){t.hidden=true;},2800);}

function wirePages(app){
  app.querySelectorAll("[data-go-pick]").forEach(function(b){b.onclick=function(){var k=firstOpen();goPick(k==="overall"?"pg":k);};});
  app.querySelectorAll("[data-go-board]").forEach(function(b){b.onclick=function(){if(b.dataset.goBoard)ui.tab=b.dataset.goBoard;ui.nav="board";saveUI();render();window.scrollTo(0,0);};});
  app.querySelectorAll("[data-notify]").forEach(function(c){c.onchange=function(){me.notify=me.notify||{};me.notify[c.dataset.notify]=c.checked;changed();if(c.checked&&NATIVE)pushSetup(true);toast(c.checked?"Turned on.":"Turned off.");};});
  var dn=$("#dn",app);if(dn)dn.onchange=function(){var v=dn.value.trim().slice(0,20);me.name=v||null;changed();toast("Name saved.");};
  app.querySelectorAll("[data-kind]").forEach(function(c){c.onclick=function(){var t=$("#fbm",app);if(t)ui.fbText=t.value;ui.fbKind=c.dataset.kind;render();};});
  var fb=$("#fbm",app);if(fb)fb.oninput=function(){ui.fbText=fb.value;};
  var fs=$("[data-fb-send]",app);if(fs)fs.onclick=sendFeedback;
}

/* ---------- website front page, Settings, Feedback, rank history ---------- */

// Front page: what first-time visitors see at floor2rafters.com (and when they tap the logo).
function homeHTML(){
  ensureBoard("overall");var b=boards.overall,rows=b&&b.rows||[],voters=(b&&b.voters)||0;
  var top=rows.slice(0,5).map(function(r,i){var p=P[r.player_id];if(!p)return "";
    return '<button class="r tap" data-pid="'+r.player_id+'" style="--tc:'+tc(p)+'">'+ghost(r.rank)+'<span class="n t5">'+r.rank+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span><span class="sc">'+POSL[p.pos]+' · '+fmt(r.points)+' pts'+(voters?' · '+Math.round(r.votes/voters*100)+'% of fans':'')+'</span></span>'+teamTag(p)+'</button>';}).join("");
  var board=rows.length?'<div class="list">'+top+'</div><div class="cut" aria-hidden="true"><span>▲ TOP 5</span></div><span class="note">'+(b.sample?"Sample board. The real one goes live at launch.":liveLabel("overall",voters))+'</span>'
    :'<div class="empty"><b>No picks yet. Be the first.</b><br>The board goes live with the first fan\'s list.</div>';
  return '<div class="home">'+
    '<header class="hm-top"><nav class="hm-nav"><a href="#hm-board">Fan Board</a><a href="#hm-how">How it works</a>'+(user?'':'<button class="link" data-signin>Sign in</button>')+'<button class="btn sm" data-go-pick>Start ranking</button></nav></header>'+
    '<section class="hm-hero"><div class="hm-copy"><img src="/brand/mark.svg" alt="F2R" class="hm-mark" width="81" height="84"><span class="kicker blue">Fan-voted NBA rankings</span><h1 class="hm-h1">Floor 2<br>Rafters</h1>'+
      '<p class="hm-sub">Rank the NBA your way, from the Floor 2 the Rafters.</p>'+
      '<div class="hm-ctas"><button class="btn" data-go-pick>Start ranking</button><button class="btn tint" data-go-board>See the board</button></div>'+
      '</div>'+
      '<div class="hm-board" id="hm-board"><div class="hrow"><span class="hm-bt">Fan Board · Overall</span></div>'+board+'</div></section>'+
    '<section class="hm-how" id="hm-how"><div class="hm-howhd"><span class="kicker blue">How it works</span><h2 class="hm-h2">Three steps.<br>Your rankings.</h2></div><div class="hm-steps">'+
      '<div class="hm-step"><div class="hm-vis v1" aria-hidden="true">'+
        '<div class="mc a" style="--c:#F58426"><i>PG</i><b>Jalen<br>Brunson</b><s>NYK</s></div><span class="vs">VS</span>'+
        '<div class="mc b" style="--c:#552583"><i>PG</i><b>Luka<br>Doncic</b><s>LAL</s></div><span class="tap"></span></div>'+
        '<div class="hm-st"><span class="sn">01</span><h3>Head to head</h3><p>Two players check in side by side. Your decision determines where each one ranks.</p></div></div>'+
      '<div class="hm-step"><div class="hm-vis v2" aria-hidden="true"><div class="tabs"><span class="on">PG</span><span>SG</span><span>SF</span><span>PF</span><span>C</span><span class="gold">ALL-TIME</span></div>'+
        '<div class="ml"><span><b>1</b>Shai Gilgeous-Alexander</span><span><b>2</b>Luka Doncic</span><span><b>3</b>Jalen Brunson</span><span class="dim"><b>4</b>Tyrese Haliburton</span></div></div>'+
        '<div class="hm-st"><span class="sn">02</span><h3>Rank every position</h3><p>Build a top 10 at each of the five positions. Then take on the all‑time greats.</p></div></div>'+
      '<div class="hm-step bl"><div class="hm-vis v3" aria-hidden="true"><div class="ml"><span><b>1</b>Shai Gilgeous-Alexander<i>PG</i></span><span><b>2</b>Nikola Jokic<i>C</i></span><span><b>3</b>Giannis Antetokounmpo<i>PF</i></span><span class="dim"><b>50</b>…</span></div>'+
        '<span class="stamp"><i></i>Your vote · live</span></div>'+
        '<div class="hm-st"><span class="sn">03</span><h3>Make your top 50</h3><p>Your best from each position go head to head for one overall top 50. That list becomes your vote on the Fan Board.</p></div></div>'+
    '</div></section>'+
    '<section class="hm-fans"><div><h2 class="hm-h2">The fans<br>decide</h2><p class="hm-sub">No experts, no hot-take hosts. The board adds up every fan\'s lists, live: #1 on a list is worth 50 points, #50 is worth 1. The arrows show who the fans are buying and selling this week.</p></div>'+
      '<div class="hm-stats"><div><b class="blue">6</b><span>boards: Overall plus all five positions</span></div><div><b>LIVE</b><span>the board moves as fans pick, all season</span></div><div><b>50</b><span>players in your overall list</span></div><div><b class="purple">1 TAP</b><span>per pick, a few minutes per session</span></div></div></section>'+
    '<section class="hm-cta"><img src="/brand/mark.svg" alt="" width="115" height="120"><h2 class="hm-h2">Your #1 or theirs?</h2><p class="hm-sub">Your list counts the moment you save it.</p><button class="btn" data-go-pick>Start ranking</button></section>'+
    '<footer class="hm-foot"><img src="/brand/wordmark.svg" alt="Floor 2 Rafters" height="18"><span>@floor2rafters · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a></span><span>Not affiliated with the NBA or its teams.</span></footer>'+
  '</div>';
}

// Settings: account, notification switches (saved to your account), about, sign out, delete.
var NOTIFY=[["monday","Weekly recap","Mondays: the fans' #1 and who moved"],["moved","Your player moved","In the Monday recap, if your #1 rose or fell 3+ spots"],["streak","Streak reminder","One nudge if you haven't picked today"]];
function notifyOn(k){var n=me.notify||{};return n[k]!==undefined?n[k]:k!=="streak";}
function settingsHTML(){
  var h='<button class="back" data-nav="me">‹ Me</button><h1 class="h1">Settings</h1>';
  h+='<span class="set-h">ACCOUNT</span>';
  h+='<label class="set-row" for="dn"><span>Display name<small>Shown on your share images</small></span><input id="dn" class="set-in" maxlength="20" value="'+esc(me.name||(user?displayName():""))+'" placeholder="Your name" autocomplete="nickname"></label>';
  h+='<div class="set-row"><span>Email</span><span class="v">'+(user?esc(user.email||""):demo?"Demo mode":"Not signed in")+'</span></div>';
  h+='<span class="set-h">NOTIFICATIONS</span>';
  h+=NOTIFY.map(function(n){return '<label class="set-row" for="nt-'+n[0]+'"><span>'+n[1]+'<small>'+n[2]+'</small></span><input class="sw" id="nt-'+n[0]+'" data-notify="'+n[0]+'" type="checkbox"'+(notifyOn(n[0])?' checked':'')+'></label>';}).join("");
  h+='<p class="note">'+(NATIVE?'Alerts come to this phone. The weekly recap email goes to your sign-in email.':'The weekly recap email goes to your sign-in email, with a one-tap unsubscribe. In the phone app, alerts come to your phone.')+'</p>';
  h+='<span class="set-h">ABOUT</span>';
  h+='<div class="set-row"><span>Player stats</span><span class="v">'+esc(CFG.statsLabel||"Last regular season")+'</span></div>';
  h+='<a class="set-row" href="/privacy.html">Privacy policy<span class="v">›</span></a><a class="set-row" href="/terms.html">Terms<span class="v">›</span></a>';
  h+='<div class="set-acts">'+(user?'<button class="btn tint sm" data-signout>Sign out</button><button class="link center danger" data-delete>Delete my account and lists</button>':demo?'':'<button class="btn sm" data-signin>Sign in</button>')+'</div>';
  return h;
}

// Feedback: goes straight into the feedback table (falls back to email if that fails).
var FB_KINDS=[["bug","Bug"],["player","Wrong player info"],["idea","Idea"],["other","Other"]];
function feedbackHTML(){
  var k=ui.fbKind||"bug";
  return '<button class="back" data-nav="me">‹ Me</button><h1 class="h1">Talk your talk</h1>'+
    '<p class="sub">Something broken, a player on the wrong team, or an idea? It goes straight to the person building F2R.</p>'+
    '<span class="set-h">WHAT\'S IT ABOUT?</span><div class="chips">'+FB_KINDS.map(function(x){return '<button class="chip'+(x[0]===k?' on':'')+'" data-kind="'+x[0]+'" aria-pressed="'+(x[0]===k)+'">'+x[1]+'</button>';}).join("")+'</div>'+
    '<label class="set-h" for="fbm">YOUR MESSAGE</label><textarea id="fbm" class="input fb-in" maxlength="2000" placeholder="Tatum should be an SF, not a PF...">'+esc(ui.fbText||"")+'</textarea>'+
    '<button class="btn" data-fb-send>Send it</button><p class="note center">Or email <a href="'+esc(feedbackHref())+'">info@floor2rafters.com</a></p>';
}
async function sendFeedback(){
  var t=($("#fbm")||{}).value||"";t=t.trim();if(!t){toast("Write a quick note first.");return;}
  var row={user_id:user?user.id:null,kind:ui.fbKind||"bug",message:t.slice(0,2000),screen:(ui.navFrom||"me").slice(0,200),device:navigator.userAgent.slice(0,300)};
  var ok=false;
  if(sb){try{var r=await sb.from("feedback").insert(row);ok=!r.error;}catch(e){}}
  else{try{var q=JSON.parse(localStorage.getItem("f2r-feedback")||"[]");q.push(row);localStorage.setItem("f2r-feedback",JSON.stringify(q));ok=true;}catch(e){}}
  if(ok){ui.fbText="";toast("Got it. Thanks for the feedback!");ui.nav="me";render();}
  else{toast("Couldn't send. Opening email instead.");location.href=feedbackHref();}
}

// Rank by week on the player card: from the nightly snapshots, one point per week (real data only; demo shows last week and now).
var HIST={};
function mondayOf(iso){var d=new Date(iso+"T12:00:00Z"),dw=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-dw);return d.toISOString().slice(0,10);}
function loadHistory(id){
  if(HIST[id])return;var p=P[id];
  if(demo||!sb){var out={};["overall",p.pos].forEach(function(k){var b=boards[k],r=fanRank(k,id);out[k]=[];if(r&&r.prev_rank)out[k].push({w:b.prev,r:r.prev_rank});if(r)out[k].push({w:b.week,r:r.rank});});HIST[id]=out;return;}
  HIST[id]={loading:true};
  sb.from("rankings").select("week,key,rank").eq("player_id",id).in("key",["overall",p.pos]).order("week",{ascending:true}).then(function(res){
    var out={overall:[]};out[p.pos]=[];var wk={};(res.data||[]).forEach(function(x){var k=x.key+"|"+mondayOf(x.week);wk[k]=x;});Object.keys(wk).sort().forEach(function(k){var x=wk[k];(out[x.key]=out[x.key]||[]).push({w:x.week,r:x.rank});});Object.keys(out).forEach(function(k){out[k].sort(function(a,b){return a.w<b.w?-1:1;});});
    Object.keys(out).forEach(function(k){out[k]=out[k].slice(isPro()?-26:-6);});HIST[id]=out;if(ui.sheet==="player"&&ui.pid===id)renderSheet();});
}
function historyHTML(id){
  var p=P[id],h=HIST[id];if(!h)return "";if(h.loading)return '<p class="note">Loading rank history…</p>';
  function strip(k,label){var a=h[k]||[];if(!a.length)return "";
    return '<div class="hist"><span class="kicker">'+label+'</span><div class="hist-row">'+a.map(function(x,i){var last=i===a.length-1;
      return '<div class="hs'+(last?' now':'')+'"><b>'+x.r+'</b><span>'+(last?"NOW":"WK "+esc(dateLabel(x.w).toUpperCase()))+'</span></div>';}).join("")+'</div></div>';}
  var out=strip("overall","Rank by week · Overall")+strip(p.pos,"Rank by week · "+POSL[p.pos]);
  return out||'<p class="note">Rank history shows up after his first week on the board.</p>';
}


/* ---------- backend ---------- */
var sb=null, user=null, isAdmin=false, demo=!(CFG.supabaseUrl&&CFG.supabaseAnonKey);
var boards={}, saved={}, saveT=null, saving=false, again=false, ready=false;

function changed(){syncOverall();saveLocal();if(user){clearTimeout(saveT);saveT=setTimeout(flush,800);}}
function saveLocal(){if(user)return;try{localStorage.setItem(LS,JSON.stringify(me));}catch(e){}}
// Fan settings are saved as a patch: only what changed on this device since it last loaded or saved.
// So a phone that has been sitting in the background can't undo an email unsubscribe, or roll back XP or
// a streak picked up on another device. The database merges the patch (save_state in schema.sql).
var savedSt={};
function stateNow(){return {out:me.out,deep:me.deep,name:me.name||null,notify:me.notify||{},pref:me.pref||{},xp:me.xp||0,streak:me.streak||0,last:me.last||"",best:me.best||0,snap:me.snap||{},calls:me.calls||[]};}
function statePatch(){var cur=stateNow(),p={},n=0;
  Object.keys(cur).forEach(function(k){
    if(k==="notify"){var was={};try{was=JSON.parse(savedSt.notify||"{}");}catch(e){}var d={},m=0;Object.keys(cur.notify).forEach(function(x){if(was[x]!==cur.notify[x]){d[x]=cur.notify[x];m++;}});if(m){p.notify=d;n++;}return;}
    var j=JSON.stringify(cur[k]);if(savedSt[k]!==j){p[k]=cur[k];n++;}});
  if(p.streak!==undefined||p.last!==undefined){p.streak=cur.streak;p.last=cur.last;} // these two travel together
  return n?p:null;}
function markStateSaved(){var cur=stateNow();savedSt={};Object.keys(cur).forEach(function(k){savedSt[k]=JSON.stringify(cur[k]);});}
function applyState(st){st=st||{};me.out=fix(st.out,999);me.deep=st.deep||{};me.name=st.name||null;me.notify=st.notify||{};me.pref=st.pref||{};me.xp=st.xp||0;me.streak=st.streak||0;me.last=st.last||"";me.best=st.best||0;me.snap=st.snap||{};me.calls=st.calls||[];}
async function flush(){
  if(!user||!sb)return;
  if(saving){again=true;return;}
  saving=true;
  var now=new Date().toISOString(),rows=[];
  TABS.forEach(function(t){var k=t[0],v=me.l[k].slice(0,DEEP),j=JSON.stringify(v);if(saved[k]!==j)rows.push({user_id:user.id,key:k,player_ids:v,updated_at:now,_j:j});});
  try{
    if(rows.length){var r=await sb.from("lists").upsert(rows.map(function(x){return {user_id:x.user_id,key:x.key,player_ids:x.player_ids,updated_at:x.updated_at};}));if(r.error)throw r.error;rows.forEach(function(x){saved[x.key]=x._j;});}
    var patch=statePatch();
    if(patch){var st=await sb.rpc("save_state",{p_patch:patch});if(st.error)throw st.error;markStateSaved();}
  }catch(e){toast("Couldn't save. Check your connection and try again.");}
  saving=false;if(again){again=false;flush();}
}
// Picks made as a guest on this device are never thrown away when signing in. If the account already has lists,
// the guest picks are added after the account's own (players already on the list keep their account spot).
function mergeGuest(acct,guest){var gl=fix(guest.l,DEEP),go=fix(guest.out,999),added=0;
  TABS.forEach(function(t){var k=t[0];if(k==="overall")return;var have={};acct.l[k].forEach(function(id){have[id]=1;});
    gl[k].forEach(function(id){if(!have[id]&&acct.l[k].length<DEEP){acct.l[k].push(id);have[id]=1;added++;}});
    var inL={};acct.l[k].forEach(function(id){inL[id]=1;});var o={};acct.out[k].forEach(function(id){o[id]=1;});
    go[k].forEach(function(id){if(!inL[id]&&!o[id]){acct.out[k].push(id);o[id]=1;}});});
  Object.keys(guest.pref||{}).forEach(function(x){var y=x.split(">");if(!(y[1]+">"+y[0] in acct.pref))acct.pref[x]=guest.pref[x];});
  Object.keys(guest.deep||{}).forEach(function(x){if(!(x in acct.deep))acct.deep[x]=guest.deep[x];});
  acct.xp=(acct.xp||0)+(guest.xp||0);
  if((guest.last||"")>(acct.last||"")){acct.streak=guest.streak||0;acct.last=guest.last||"";}
  acct.best=Math.max(acct.best||0,guest.best||0,acct.streak||0);
  if(!acct.name&&guest.name)acct.name=guest.name;
  var seen={};acct.calls=(acct.calls||[]).concat(guest.calls||[]).filter(function(c){var j=JSON.stringify(c);if(seen[j])return false;seen[j]=1;return true;});
  return added;}
async function loadMine(){
  var res=await Promise.all([sb.from("lists").select("key,player_ids"),sb.from("user_state").select("data").maybeSingle()]);
  var lists=res[0].data||[],st=res[1].data&&res[1].data.data;
  var guest=null;try{guest=JSON.parse(localStorage.getItem(LS)||"null");}catch(e){}
  var hasGuest=guest&&guest.l&&TABS.some(function(t){return (guest.l[t[0]]||[]).length;});
  var o={};lists.forEach(function(r){o[r.key]=r.player_ids||[];});
  me.l=fix(o,DEEP);saved={};TABS.forEach(function(t){saved[t[0]]=JSON.stringify(me.l[t[0]]);});
  applyState(st);markStateSaved();
  if(hasGuest){
    if(!lists.length){ // first sign-in: the guest picks become the account's
      me.l=fix(guest.l,DEEP);applyState(Object.assign({},guest,{notify:Object.assign({},guest.notify||{},me.notify||{})}));saved={};savedSt={};
      toast("Your picks are saved to your account.");
    }else{
      var n=mergeGuest(me,guest);saved={};savedSt={};
      toast(n?"Added "+n+" pick"+(n===1?"":"s")+" from this device to your account.":"Signed in. Your account picks are loaded.");
    }
    try{localStorage.removeItem(LS);}catch(e){}
    syncOverall();flush();return;
  }
  syncOverall();
}
// Coming back to the app after a while: pick up settings changed elsewhere (an email unsubscribe, another device),
// unless this device has its own unsaved change for that setting.
var hiddenAt=0;
document.addEventListener("visibilitychange",async function(){
  if(document.hidden){hiddenAt=Date.now();return;}
  if(!user||!sb||!hiddenAt||Date.now()-hiddenAt<30000)return;hiddenAt=0;
  var r=await sb.from("user_state").select("data").maybeSingle();if(r.error||!r.data)return;
  var st=r.data.data||{},cur=stateNow(),dirty={};Object.keys(cur).forEach(function(k){if(savedSt[k]!==JSON.stringify(cur[k]))dirty[k]=1;});
  var keep={};Object.keys(dirty).forEach(function(k){keep[k]=cur[k];});
  applyState(st);markStateSaved();Object.keys(keep).forEach(function(k){me[k]=keep[k];});
  if(typeof render==="function")render();
});
async function loadBoard(key){
  if(demo||!sb)return;
  var r=await sb.rpc("get_board",{p_key:key});
  if(r.error){var o=boards[key];boards[key]=o&&o.rows?{week:o.week,prev:o.prev,voters:o.voters,rows:o.rows,at:Date.now()-90000,stale:true}:{error:true};return;} // offline: keep the last board we had
  var rows=r.data||[];
  boards[key]={week:rows[0]&&rows[0].week,prev:rows[0]&&rows[0].prev_week,voters:rows[0]?rows[0].voters:0,rows:rows,at:Date.now()};
  checkCalls(key);
  if(key==="overall"&&rows.length&&ready)changed();
}
// Until 10 fans have an overall list, the overall board leans on a starting top 50 from this season's stats (see supabase/schema.sql).
var SEED_FANS=10;
function liveLabel(key,voters){return key==="overall"&&voters<SEED_FANS?"Live · starting from stats until "+SEED_FANS+" fans vote":"Live · "+fmt(voters)+" fans ranking";}
function boardsStale(){return Object.keys(boards).some(function(k){var b=boards[k];return b&&b.at&&Date.now()-b.at>120000;});}
function ensureBoard(key){
  if(boards[key]&&!(boards[key].at&&Date.now()-boards[key].at>120000&&!boards[key].loading))return;
  if(boards[key]&&boards[key].at&&!demo){var old=boards[key];old.loading=false;loadBoard(key).then(render);return;}
  if(demo){if(CFG.sample!==false){boards[key]=sampleBoard(key);setTimeout(function(){checkCalls(key);},0);}return;}
  boards[key]={loading:true};loadBoard(key).then(render);
}

// Demo/preview only: believable sample boards so the fan features can be seen before real fans vote.
function sampleBoard(key){
  var seed=0;for(var i=0;i<key.length;i++)seed=seed*31+key.charCodeAt(i);
  function rnd(){seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;}
  var pool;if(key==="overall"){pool=[];var mx=0;POS.forEach(function(p){mx=Math.max(mx,POOL[p[0]].length);});for(var r=0;r<mx&&pool.length<75;r++)POS.forEach(function(p){var id=POOL[p[0]][r];if(id!=null&&pool.length<75)pool.push(id);});}
  else pool=POOL[key].slice(0,28);
  var scored=pool.map(function(id,i){return {id:id,s:(pool.length-i)*20+rnd()*90};}).sort(function(a,b){return b.s-a.s;});
  var prev=scored.map(function(x){return {id:x.id,s:x.s+(rnd()-.5)*140};}).sort(function(a,b){return b.s-a.s;});
  var pr={};prev.forEach(function(x,i){pr[x.id]=i+1;});
  var top=Math.round(scored[0].s*6.4);
  var rows=scored.slice(0,key==="overall"?60:25).map(function(x,i){var pv=pr[x.id];if(i>8&&rnd()<.08)pv=null;
    return {rank:i+1,player_id:x.id,points:Math.max(1,Math.round(top*Math.pow(.955,i))),firsts:i===0?41:i===1?27:i===2?12:i<6?Math.round(rnd()*6):0,votes:Math.round(128*Math.max(.12,.62-i*.025)),prev_rank:pv};});
  var o=et(Date.now()),mon=new Date(Date.UTC(+o.year,+o.month-1,+o.day-WD[o.weekday])),pm=new Date(mon.getTime()-7*864e5);
  return {week:mon.toISOString().slice(0,10),prev:pm.toISOString().slice(0,10),voters:128,rows:rows,sample:true};
}
function fanRank(key,id){var b=boards[key];if(!b||!b.rows)return null;for(var i=0;i<b.rows.length;i++)if(b.rows[i].player_id===id)return b.rows[i];return false;}
function fanTag(key,id,i){ensureBoard(key);var b=boards[key];if(!b||!b.rows||!b.rows.length)return "";
  var r=fanRank(key,id);var hot=!r||Math.abs(r.rank-(i+1))>=5;
  return '<span class="tag'+(hot?" hot":"")+'">'+(hot?"HOT TAKE · ":"")+(r?"FANS #"+r.rank:"FANS: NR")+'</span>';}
function moverLists(rows){
  return {
    up:rows.filter(function(r){return r.prev_rank!=null&&r.prev_rank>r.rank;}).sort(function(a,b){return (b.prev_rank-b.rank)-(a.prev_rank-a.rank)||a.rank-b.rank;}).slice(0,5),
    dn:rows.filter(function(r){return r.prev_rank!=null&&r.prev_rank<r.rank;}).sort(function(a,b){return (b.rank-b.prev_rank)-(a.rank-a.prev_rank)||a.rank-b.rank;}).slice(0,5),
    nw:rows.filter(function(r){return r.prev_rank==null;}).slice(0,5)};}
function moversSheet(key){
  var b=boards[key],m=moverLists(b&&b.rows||[]);
  function item(r,t){var p=P[r.player_id];if(p&&isGoat(key))p=asGoat(p);if(!p)return "";
    var d=t==="up"?'<span class="d" style="color:var(--blue)">'+chev("up",15)+(r.prev_rank-r.rank)+'</span>':t==="down"?'<span class="d" style="color:var(--down)">'+chev("down",15)+(r.rank-r.prev_rank)+'</span>':'<span class="d" style="color:var(--purple);font-size:15px">NEW</span>';
    return '<button class="mr r" data-pid="'+r.player_id+'" style="--tc:'+tc(p)+'"><span class="who"><span class="nm">'+esc(p.n)+'</span><span class="sc">Now #'+r.rank+(r.prev_rank?' · was #'+r.prev_rank:'')+(p.t?' · '+esc(p.t):'')+'</span></span>'+d+'</button>';}
  function col(t,list,k,c){return list.length?'<span class="mh" style="color:'+c+'">'+t+'</span>'+list.map(function(r){return item(r,k);}).join(""):"";}
  var any=m.up.length||m.dn.length||m.nw.length;
  return '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="mv-t"><button class="x" data-close aria-label="Close">×</button>'+
    '<h2 id="mv-t" class="h1">Movers</h2><span class="note">'+(key==="overall"?"Overall":POSL[key])+' board · last 7 days'+(b&&b.prev?' (since '+dateLabel(b.prev)+')':'')+'</span>'+
    (any?col("RISING",m.up,"up","var(--blue)")+col("FALLING",m.dn,"down","var(--down)")+col("NEW ON THE BOARD",m.nw,"new","var(--purple)"):'<p class="sub">Movement shows up after the board\'s first day.</p>')+'</div>';
}

/* ---------- Jumbotron ---------- */
function lastName(n){var w=n.split(" ");var l=w[w.length-1];if(/^(Jr\.?|Sr\.?|II|III|IV)$/.test(l)&&w.length>2)l=w[w.length-2];l=l.split("-")[0];return l.toUpperCase();}
function tickerItems(rows,hasPrev,voters){
  if(!hasPrev)return [[fmt(voters)+" FANS","soft"],["LIVE","blue"],["RANK YOURS","purple"]];
  var m=moverLists(rows),out=[];
  if(m.up[0])out.push(["▲"+(m.up[0].prev_rank-m.up[0].rank)+" "+lastName(P[m.up[0].player_id].n),"blue"]);
  if(m.dn[0])out.push(["▼"+(m.dn[0].rank-m.dn[0].prev_rank)+" "+lastName(P[m.dn[0].player_id].n),"down"]);
  if(m.nw[0])out.push(["NEW "+lastName(P[m.nw[0].player_id].n),"purple"]);
  if(!out.length)out.push([fmt(voters)+" FANS","soft"]);
  while(out.length>2&&out.map(function(x){return x[0];}).join("   ").length>32)out.pop(); // keep the ticker on one line
  return out;}
function tickerHTML(items){return '<div class="jt-tick">'+items.map(function(x){return '<span class="c-'+x[1]+'">'+esc(x[0])+'</span>';}).join("")+'</div>';}
// D: the scoreboard hangs from the rafters above the board
function jumboHTML(key,b,rows,hasPrev){
  var voters=(b&&b.voters)||0,label=(key==="overall"?"OVERALL":POSL[key].toUpperCase())+" · ";
  var inner;
  if(!rows.length){
    inner='<span class="jt-top">'+label+'LIVE</span><span class="jt-big">0</span><span class="jt-sub">NO PICKS YET · BE THE FIRST</span>';
    return '<div class="jt" aria-label="Fan Board scoreboard">'+jtFrame('<div class="jt-panel jt-col">'+inner+'</div>')+'</div>';}
  var n=Math.min(10,rows.length);JT={key:key,rows:rows,voters:voters,label:label,when:"LIVE",i:0,n:n};JT.m=n;
  var dots='';for(var d=0;d<JT.m;d++)dots+='<i'+(d===0?' class="on"':'')+'></i>';
  inner='<span class="jt-slot">'+jtSlot(0)+'</span>'+(JT.m>1?'<span class="jt-dots" aria-hidden="true">'+dots+'</span>':'')+tickerHTML(tickerItems(rows,hasPrev,voters));
  return '<button class="jt" data-reveal="'+key+'" aria-label="Fan Board scoreboard, cycling through the fans\' top '+n+'. Tap for the full reveal">'+jtFrame('<div class="jt-panel">'+inner+'</div>')+'</button>';}
// The scoreboard cycles through the fans' top 10 like an arena board: #1, #2, #3... every 4 seconds, then loops.
var JT=null,jtTimer=null;
function jtSlot(i){var r=JT.rows[i],p=isGoat(JT.key)?asGoat(P[r.player_id]):P[r.player_id],v=JT.voters;
  return '<span class="jt-top">FANS\' #'+r.rank+' · '+JT.label+JT.when+'</span>'+
    '<span class="jt-row"><span class="jt-big">'+r.rank+'</span><span class="jt-name">'+splitName(p.n)+'<small>'+(p.t?esc(p.t)+' · ':'')+fmt(r.points)+' PTS'+(v?' · '+Math.round(r.votes/v*100)+'% OF FANS':'')+'</small></span></span>';}
function startJumbo(){clearInterval(jtTimer);jtTimer=null;
  var el=document.querySelector(".jt-slot");if(!el||!JT||JT.m<2)return;
  try{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;}catch(e){}
  jtTimer=setInterval(function(){var s=document.querySelector(".jt-slot");if(!s||!JT){clearInterval(jtTimer);return;}
    if(document.hidden)return;
    s.classList.add("flip");
    setTimeout(function(){if(!JT||!s.isConnected)return;JT.i=(JT.i+1)%JT.m;s.innerHTML=jtSlot(JT.i);fitNames(s);s.classList.remove("flip");
      document.querySelectorAll(".jt-dots i").forEach(function(d,k){d.className=k===JT.i?"on":"";});},260);},4000);}
// The scoreboard as a real center-hung board: steel cables, a riveted top ring with a name plate, angled side screens,
// a recessed screen behind glass, an LED ribbon on the bottom ring and lamps that light the floor below.
// No internet: the scoreboard loses its feed. The screen goes dark with a flickering NO SIGNAL; the lights dim.
function offline(){try{return navigator.onLine===false;}catch(e){return false;}}
function noSignalHTML(){return '<div class="jt off" aria-label="Scoreboard: no signal. You\'re offline.">'+jtFrame('<div class="jt-panel jt-col jt-dead"><span class="jt-nosig">NO SIGNAL</span><span class="jt-sub">CHECK YOUR CONNECTION</span></div>')+'</div>';}
var keepSheet=false;
function renderKeepSheet(){keepSheet=true;try{render();}finally{keepSheet=false;}}
window.addEventListener("offline",function(){if(!ready)return;renderKeepSheet();toast("You're offline. The board will update when you're back.");});
window.addEventListener("online",function(){Object.keys(boards).forEach(function(k){var b=boards[k];if(b&&(b.error||b.stale))delete boards[k];});if(ready)renderKeepSheet();});
function jtFrame(panel){return '<span class="jt-truss" aria-hidden="true"></span><span class="jt-cable lf" aria-hidden="true"></span><span class="jt-cable rt" aria-hidden="true"></span>'+
  '<span class="jt-crown" aria-hidden="true"><span class="jt-ribbon up"></span></span>'+
  '<span class="jt-cap" aria-hidden="true"><span class="jt-plate">FLOOR 2 RAFTERS<i class="jt-tally"></i></span></span>'+
  '<span class="jt-body"><span class="jt-wing lf" aria-hidden="true"></span>'+panel+'<span class="jt-wing rt" aria-hidden="true"></span></span>'+
  '<span class="jt-cap b" aria-hidden="true"><span class="jt-ribbon"></span></span><span class="jt-light" aria-hidden="true"></span>'+
  '<span class="jt-pool" aria-hidden="true"><i class="jt-can" style="left:14%"></i><i class="jt-can" style="left:38%"></i><i class="jt-can" style="left:62%"></i><i class="jt-can" style="left:86%"></i></span>';}
// C: the full-screen #1 reveal, any time you tap the scoreboard
function revealHTML(key){
  var b=boards[key],rows=b&&b.rows||[];if(!rows.length)return "";
  var r=rows[0],p=isGoat(key)?asGoat(P[r.player_id]):P[r.player_id],voters=b.voters||0,mine=me.l[key][0],mr=mine!=null?fanRank(key,mine):null;
  var you=mine!=null?'<div class="rv-you"><span><span class="lab">YOUR #1</span><b>'+esc(P[mine].n)+'</b></span><span class="rv-fans">'+(mr?"FANS #"+mr.rank:"FANS: NR")+'</span></div>'
    :'<div class="rv-you"><span><span class="lab">YOUR #1</span><b>Not set yet</b></span><button class="link" data-pick="'+(key==="overall"?firstOpen():key)+'" style="padding:0">Build my list ›</button></div>';
  return '<div class="sheet-card reveal" role="dialog" aria-modal="true" aria-labelledby="rv-t"><button class="x" data-close aria-label="Close">×</button>'+
    '<img class="rv-logo" src="/brand/mark.svg" alt="" width="35" height="36">'+
    '<div class="rv-board" style="--tc:'+tc(p)+'"><span class="jt-top">'+(b.sample?"SAMPLE BOARD":"LIVE")+' · '+(key==="overall"?"OVERALL":POSL[key])+' · '+fmt(voters)+' FANS</span>'+
    '<span class="rv-num">#1</span><h2 id="rv-t" class="rv-name">'+splitName(p.n)+'</h2>'+
    '<span class="rv-meta">'+(p.t?esc(p.t)+' · ':'')+(voters?Math.round(r.votes/voters*100)+'% OF FANS · ':'')+fmt(r.firsts||0)+' #1 VOTES</span>'+
    tickerHTML(tickerItems(rows,!!b.prev,voters))+'</div>'+calledHTML(key)+(spon(key)?'<p class="rv-spon">Presented by <b>'+esc(spon(key).name)+'</b></p>':'')+you+
    '<button class="btn" data-close>See the full board</button><p class="note center">The board updates live as fans pick.</p></div>';}

/* ---------- rendering ---------- */
function headerHTML(){
  var lv=level(me.xp||0);
  return '<header class="top"><a class="brand" href="/" data-nav="home" aria-label="Floor 2 Rafters home"><img class="mk" src="/brand/mark.svg" alt="" width="33" height="34"><img class="wm" src="/brand/wordmark.svg" alt="Floor 2 Rafters" height="15"></a>'+
    '<div class="right">'+(user||demo||!ready?'<button class="lvl" data-nav="me" style="border:0;background:none;padding:0">'+esc(lv.name).toUpperCase()+'<small>'+fmt(me.xp||0)+' XP'+(streakNow()>1?' · '+streakNow()+'-day streak':'')+'</small></button>':'<button class="signin" data-signin>SIGN IN</button>')+'</div></header>';
}
function navHTML(){
  return '<nav class="nav" aria-label="Main">'+[["board","Board"],["groups","Groups"],["pick","Pick"],["lists","My Lists"],["me","Me"]].map(function(n){
    return '<button data-nav="'+n[0]+'"'+(ui.nav===n[0]||(n[0]==="groups"&&ui.nav==="group")?' aria-current="page"':'')+'>'+icon(n[0])+n[1]+'</button>';}).join("")+'</nav>';
}
// All-Time screens get the throwback look: warmer whites and a faint film grain, like old footage.
function throwbackOn(){return (ui.nav==="board"&&ui.tab==="goat")||(ui.nav==="pick"&&ui.pick==="goat")||(ui.nav==="lists"&&ui.list==="goat");}
function render(){JT=null;miniOff();document.body.classList.toggle("throwback",throwbackOn());
  var app=$("#app"),h=headerHTML();
  if(!ready){app.innerHTML=h+'<div class="empty">Loading…</div>';return;}
  if(ui.nav==="home"){app.className="app wide";app.innerHTML=homeHTML();wire(app);wireExtra(app);wirePages(app);renderSheet();return;}
  app.className="app";
  if(ui.nav==="pick")h+=pickHTML();
  else if(ui.nav==="settings")h+=settingsHTML();
  else if(ui.nav==="feedback")h+=feedbackHTML();
  else if(ui.nav==="lists")h+=myListsHTML();
  else if(ui.nav==="me")h+=meHTML();
  else if(ui.nav==="groups")h+=groupsHTML();
  else if(ui.nav==="group")h+=groupHTML();
  else if(ui.nav==="admin")h+=adminHTML();
  else h+=fansHTML(ui.tab);
  if(ui.nav!=="me"&&!user&&!demo&&(ui.nav==="pick"||ui.nav==="lists")&&TABS.some(function(t){return me.l[t[0]].length;}))h+='<div class="nudge"><span>Sign in so your picks count on the Fan Board.</span><button class="link" data-signin>Sign in</button></div>';
  if(demo)h+='<p class="note center">Demo mode: picks are saved on this device only.</p>';
  if(ui.nav==="board"||ui.nav==="me")h+='<footer class="foot"><button data-how>How it works</button> · <a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a><br>Floor 2 Rafters is a fan project and isn\'t affiliated with the NBA or any team.</footer>';
  app.innerHTML=h+navHTML();wire(app);wireExtra(app);wirePages(app);wireGroups(app);wireAdmin(app);designPass(app);navSlide(app);if(!keepSheet)renderSheet();startJumbo();wireMini(app);fillAds();
}

function fansHTML(key){return splitWrap(fansBody(key));}
// On a computer the board splits in two: scoreboard on the left, rankings on the right (phones: one column, unchanged)
function splitWrap(h){var i=h.indexOf('<!--split-->');if(i<0)return h;return '<div class="split"><div class="sp-l">'+h.slice(0,i)+'</div><div class="sp-r">'+h.slice(i+12)+'</div></div>';}
// Computers: pointing at a board row shows the player's points, rebounds and assists in place of the score line.
function hoverStats(p,key){var g=isGoat(key)&&p.c,v=g?[p.c.pts,p.c.reb,p.c.ast]:(p.s?[p.s[1],p.s[2],p.s[3]]:null);if(!v||v[0]==null)return "";
  return '<span class="hstat" aria-hidden="true">'+f1(v[0])+' PTS · '+f1(v[1])+' REB · '+f1(v[2])+' AST'+(g?' · career':'')+'</span>';}
function fansBody(key){
  ensureBoard(key);
  var b=boards[key],rows=b&&b.rows||[],voters=(b&&b.voters)||0,hasPrev=b&&b.prev;
  var h='<h1 class="sr-only">Fan Board</h1>';
  var off=offline()||(b&&(b.error||b.stale));
  h=(b&&!b.loading&&!b.error&&!off?crawlHTML(key,b,rows,hasPrev,voters):"")+h;
  if(off)h+=noSignalHTML();
  else if(b&&!b.loading&&!b.error)h+=jumboHTML(key,b,rows,hasPrev)+sponsorHTML(key);
  h+=deskSideHTML(key,b,rows,hasPrev);
  h+='<!--split-->';
  h+='<nav class="tabs" aria-label="Boards">'+TABS.map(function(t){return '<button class="tb'+(t[0]==="overall"?" ov":isGoat(t[0])?" gt":"")+'" data-tab="'+t[0]+'" aria-pressed="'+(t[0]===key)+'">'+(t[0]==="overall"?"OVERALL":isGoat(t[0])?"ALL-TIME":t[1])+'</button>';}).join("")+'</nav>';
  h+='<div class="hrow"><span class="kicker'+(b&&b.sample?"":" blue")+'">'+(b&&b.sample?"Sample board · real one at launch":liveLabel(key,voters))+'</span>'+
    (hasPrev&&rows.length?'<button class="link" data-movers style="padding:0;white-space:nowrap">Movers ›</button>':'')+'</div>';
  if(b&&b.loading)return h+'<div class="empty">Loading the board…</div>';
  if(b&&b.error)return h+'<div class="empty">The board comes back when you\'re online again.</div>';
  if(!rows.length){var mk=key==="overall"?firstOpen():key;
    return h+'<div class="empty"><b>'+'No picks yet. Be the first.</b><br>Your list counts on the board the moment you save it.</div><button class="btn'+(mk==="overall"?" blue":"")+'" data-pick="'+(mk==="overall"?"pg":mk)+'">'+(mk==="overall"?"Rank more players":isGoat(mk)?"Build my all-time top 10":"Build my "+POSL[mk]+" top 10")+'</button>';}
  h+='<div class="list">'+rows.map(function(r,i){var p=P[r.player_id];if(!p)return "";if(isGoat(key))p=asGoat(p);
    var pct=voters?Math.round(r.votes/voters*100):0;
    var sc=(key==="overall"?POSL[p.pos]+' · ':isGoat(key)&&p.c?esc(p.c.years)+' · ':'')+fmt(r.points)+' pts'+(pct?' · '+pct+'% of fans':'');
    var row='<button class="r tap'+(r.rank>=100?" wide":"")+'" data-pid="'+r.player_id+'" data-rank="'+r.rank+'" style="--tc:'+tc(p)+'">'+ghost(r.rank)+'<span class="'+numCls(i)+'">'+r.rank+'</span><span class="who">'+
      '<span class="nm">'+esc(p.n)+'</span><span class="sc">'+sc+'</span>'+hoverStats(p,key)+'</span>'+
      teamTag(p)+moveHTML(r.prev_rank,r.rank,hasPrev)+'</button>';
    return row+(i===4&&rows.length>5?cutLine():"")+(i===9&&rows.length>10?adHTML():"");}).join("")+'</div>';
  return h;
}

/* ---------- sheets ---------- */
function renderSheet(){
  var el=$("#sheet");
  if(ui.sheet!=="welcome")try{if(ui.sawWelcome)localStorage.setItem("f2r-seen","1");}catch(e){}
  el.classList.remove("tinted");
  if(!ui.sheet){el.hidden=true;el.innerHTML="";lastSheet=null;return;}
  // One pop-up at a time: a newly opened sheet clears the after-pick panel and any leftover toast.
  if(typeof hideAfter==="function")hideAfter();
  if(ui.sheet!==lastSheet){var ot=$("#toast");if(ot){ot.hidden=true;clearTimeout(toastT);}}
  el.hidden=false;
  var X='<button class="x" data-close aria-label="Close">×</button>';
  if(ui.sheet==="signin")el.innerHTML='<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sh-t">'+X+
    '<h2 id="sh-t" class="h1">Save your picks</h2><p class="sub">Sign in so your lists count on the Fan Board and follow you to any phone.</p>'+
    '<form data-email><label class="lbl" for="em">EMAIL</label><input id="em" class="input" type="email" required autocomplete="email" placeholder="you@example.com"><button class="btn" type="submit">Email me a sign-in link</button></form>'+
    (CFG.google!==false?'<div class="or"><span>OR</span></div><button class="btn white sm" data-google><svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" fill="#4285F4"/><path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" fill="#34A853"/><path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9z" fill="#FBBC05"/><path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6z" fill="#EA4335"/></svg>Continue with Google</button>':'')+
    '<p class="note">No password. By signing in you agree to the <a href="/terms.html">Terms</a> and <a href="/privacy.html">Privacy Policy</a>.</p></div>';
  else if(ui.sheet==="sent")el.innerHTML='<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="se-t">'+X+'<h2 id="se-t" class="h1">Check your email</h2><p class="sub">'+(NATIVE?'We sent a 6-digit code to <b style="color:var(--white)">'+esc(ui.sentTo||"you")+'</b>. Type it below.':'We sent a sign-in link to <b style="color:var(--white)">'+esc(ui.sentTo||"you")+'</b>. Tap it, or type the code from the email below.')+'</p>'+
    '<form data-code><label class="lbl" for="otp">CODE</label><input id="otp" class="input otp" inputmode="numeric" autocomplete="one-time-code" maxlength="10" placeholder="123456"><button class="btn" type="submit">Sign in</button></form>'+
    '<button class="link center" data-signin>Use a different email</button></div>';
  else if(ui.sheet==="welcome")el.innerHTML='<div class="sheet-card welcome" role="dialog" aria-modal="true" aria-labelledby="wl-t">'+X+
    '<img class="logo" src="/brand/mark.svg" alt="" width="81" height="84"><h2 id="wl-t" class="hero">Floor 2<br>Rafters</h2><p class="sub">Rank the NBA your way, from the Floor 2 the Rafters.</p>'+
    '<ol class="how"><li><span class="num">1</span><span><b>Head to head</b><span class="t">Two players check in side by side. Your decision determines where each one ranks.</span></span></li>'+
    '<li><span class="num">2</span><span><b>Rank every position</b><span class="t">Build a top 10 at each of the five positions. Then take on the all‑time greats.</span></span></li>'+
    '<li><span class="num">3</span><span><b>Make your top 50</b><span class="t">Your best from each position go head to head for one overall top 50. That list becomes your vote on the Fan Board.</span></span></li></ol>'+
    '<button class="btn" data-start>Start ranking</button><button class="btn tint sm" data-close>See the Fan Board</button>'+(!user&&!demo?'<button class="link center" data-signin>Already ranking? Sign in</button>':'')+'</div>';
  else if(ui.sheet==="player")el.innerHTML=playerCard(ui.pid);
  else if(ui.sheet==="movers")el.innerHTML=moversSheet(ui.tab);
  else if(ui.sheet==="reveal"){el.innerHTML=revealHTML(ui.rkey||"overall");setTimeout(function(){runReveal(el);},0);}
  else if(ui.sheet==="posts")el.innerHTML=postsHTML();
  else if(ui.sheet==="gnew")el.innerHTML=gNewHTML();
  else if(ui.sheet==="pushask")el.innerHTML=pushAskHTML();
  else if(ui.sheet==="pro")el.innerHTML=proHTML();
  else if(ui.sheet==="sharepick")el.innerHTML=sharePickHTML();
  else if(ui.sheet==="first10")el.innerHTML=first10HTML();
  else if(ui.sheet==="gjoin")el.innerHTML=gJoinHTML();
  el.onclick=function(e){if(e.target===el){ui.sheet=null;renderSheet();}};
  wireGroupSheets(el);
  el.querySelectorAll("[data-sharesize]").forEach(function(b){b.onclick=function(){var k=ui.shareKey;ui.sheet=null;renderSheet();shareCard(k,b.dataset.sharesize);};});
  var f1=$("[data-f10share]",el);if(f1)f1.onclick=function(){ui.sheet="sharepick";renderSheet();};
  var f2=$("[data-f10dare]",el);if(f2)f2.onclick=function(){dareFriend(ui.shareKey);};
  if(ui.sheet==="pushask")try{localStorage.setItem("f2r-pushask","1");}catch(e){}
  var py=$("[data-pushyes]",el);if(py)py.onclick=function(){ui.sheet=null;renderSheet();pushSetup(true);};
  el.querySelectorAll("[data-pkey]").forEach(function(b){b.onclick=function(){ensureBoard(b.dataset.pkey);makePosts(b.dataset.pkey);};});
  el.querySelectorAll("[data-psave]").forEach(function(b){b.onclick=function(){savePost(+b.dataset.psave);};});
  el.querySelectorAll("[data-pcopy]").forEach(function(b){b.onclick=function(){copyCaption(+b.dataset.pcopy);};});
  el.querySelectorAll("[data-close]").forEach(function(b){b.onclick=function(){ui.sheet=null;renderSheet();};});
  el.querySelectorAll("[data-pid]").forEach(function(b){b.onclick=function(){ui.sheet="player";ui.pid=+b.dataset.pid;renderSheet();};});
  var fc=$("[data-flipcard]",el),fb=$("[data-flip]",el);if(fc){var flip=function(){var on=fc.classList.toggle("flipped");fc.querySelector(".tc-front").setAttribute("aria-hidden",on?"true":"false");fc.querySelector(".tc-back").setAttribute("aria-hidden",on?"false":"true");if(fb)fb.textContent=on?"Flip back":(fb.dataset.l||fb.textContent);haptic();};if(fb){fb.dataset.l=fb.textContent;fb.onclick=flip;}fc.onclick=function(e){if(e.target.closest("button"))return;flip();};}
  // Player cards: the backdrop takes on the player's team color, so every card feels like his.
  if(fc){el.style.setProperty("--stc",fc.style.getPropertyValue("--tc")||"#7C82A6");el.classList.add("tinted");}
  el.querySelectorAll("[data-signin]").forEach(function(b){b.onclick=function(){ui.sheet="signin";renderSheet();};});
  el.querySelectorAll("[data-pick]").forEach(function(b){b.onclick=function(){ui.sheet=null;renderSheet();goPick(b.dataset.pick);};});
  el.querySelectorAll("[data-list]").forEach(function(b){b.onclick=function(){ui.sheet=null;renderSheet();goList(b.dataset.list);};});
  var g=$("[data-google]",el);if(g)g.onclick=function(){sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.origin+location.pathname}});};
  var f=$("[data-email]",el);if(f)f.onsubmit=async function(e){e.preventDefault();var em=$("#em",el).value.trim();var bt=$("button[type=submit]",f);
    // App Store / Play review account only: signs in with a password (reviewers can't read our email)
    if(em.toLowerCase()===(CFG.reviewEmail||"review@floor2rafters.com")){var pw=$("#pw",el);if(!pw){bt.insertAdjacentHTML("beforebegin",'<label class="lbl" for="pw">PASSWORD</label><input id="pw" class="input" type="password" autocomplete="current-password">');$("#pw",el).focus();bt.textContent="Sign in";return;}
      bt.disabled=true;var rp=await sb.auth.signInWithPassword({email:em,password:pw.value});if(rp.error){bt.disabled=false;toast("Wrong password.");}else{ui.sheet=null;renderSheet();toast("You're in.");}return;}
    bt.disabled=true;bt.textContent="Sending…";
    var r=await sb.auth.signInWithOtp({email:em,options:{emailRedirectTo:NATIVE?"https://floor2rafters.com/":location.origin+location.pathname}});
    if(r.error){bt.disabled=false;bt.textContent="Email me a sign-in link";toast("Couldn't send the link: "+r.error.message);}else{ui.sentTo=em;ui.sheet="sent";renderSheet();}};
  var cf=$("[data-code]",el);if(cf)cf.onsubmit=async function(e){e.preventDefault();var t=$("#otp",el).value.replace(/\D/g,"");if(t.length<6){toast("Type the code from the email.");return;}
    var bt=$("button[type=submit]",cf);bt.disabled=true;bt.textContent="Checking…";var r=await sb.auth.verifyOtp({email:ui.sentTo,token:t,type:"email"});
    if(r.error){bt.disabled=false;bt.textContent="Sign in";toast("That code didn't work. Check it, or send a new one.");}else{ui.sheet=null;renderSheet();toast("You're in. Your picks are saved.");}};
  var stb=$("[data-start]",el);if(stb)stb.onclick=function(){ui.sheet=null;renderSheet();goPick(firstOpen()==="overall"?"pg":firstOpen());};
  var card=el.querySelector(".sheet-card");var first=el.querySelector("input");if(first)first.focus();else if(card){card.setAttribute("tabindex","-1");card.focus();}
  fitNames(el);
  // Broadcast wipe: a pop-up arrives with a quick diagonal wipe led by a purple-to-blue bar, like a TV graphic.
  if(card&&ui.sheet!==lastSheet&&ui.sheet!=="reveal"&&typeof animOK==="function"&&animOK()){card.classList.add("wipe-in");setTimeout(function(){card.classList.remove("wipe-in");},520);}
  lastSheet=ui.sheet;
}
var lastSheet=null;
function signinOrDemo(){if(demo){toast("Sign-in turns on once the Supabase keys are added.");return;}ui.sheet="signin";renderSheet();}
function wireExtra(app){
  app.querySelectorAll("[data-pro]").forEach(function(b){b.onclick=function(){ui.sheet="pro";renderSheet();};});
  app.querySelectorAll("[data-signin]").forEach(function(b){b.onclick=signinOrDemo;});
  app.querySelectorAll("[data-pid]").forEach(function(b){b.onclick=function(){ui.sheet="player";ui.pid=+b.dataset.pid;renderSheet();};});
  if(ui.nav==="lists")app.querySelectorAll("#mylist .r[data-id],#ovlist .r[data-id]").forEach(function(r){r.onclick=function(){if(dragging)return;ui.sheet="player";ui.pid=+r.dataset.id;renderSheet();};});
  app.querySelectorAll("[data-share]").forEach(function(b){b.onclick=function(){ui.shareKey=b.dataset.share;ui.sheet="sharepick";renderSheet();};});
  var sa=$("[data-share-any]",app);if(sa)sa.onclick=function(){var k=me.l.overall.length>=5?"overall":null;if(!k)POS.forEach(function(p){if(!k&&me.l[p[0]].length>=PICK)k=p[0];});if(!k){toast("Fill a top 10 first, then share it.");return;}shareCard(k);};
  var lk=$("[data-lock]",app);if(lk)lk.onclick=function(){lockIn(ui.pick);};
  app.querySelectorAll("[data-how]").forEach(function(b){b.onclick=function(){ui.sheet="welcome";renderSheet();};});
  if(ui.nav==="board")wireSponsor(app,ui.tab||"overall");
  var pb=$("[data-posts]",app);if(pb)pb.onclick=function(){ui.sheet="posts";makePosts(ui.tab||"overall");};
  var mv=$("[data-movers]",app);if(mv)mv.onclick=function(){ui.sheet="movers";renderSheet();};
  app.querySelectorAll("[data-reveal]").forEach(function(b){b.onclick=function(){ui.sheet="reveal";ui.rkey=b.dataset.reveal;renderSheet();};});
  var so=$("[data-signout]",app);if(so)so.onclick=async function(){if(pushTok)try{await sb.rpc("delete_push_token",{p_token:pushTok});}catch(e){}pushTok=null;await sb.auth.signOut();};
  var del=$("[data-delete]",app);if(del)del.onclick=async function(){
    if(!del.dataset.sure){del.dataset.sure="1";del.textContent="Tap again to delete your account and all your lists";return;}
    del.disabled=true;var r=await sb.rpc("delete_my_account");if(r&&r.error){toast("Couldn't delete. Email info@floor2rafters.com and we'll do it.");del.disabled=false;return;}
    try{localStorage.removeItem(LS);}catch(e){}await sb.auth.signOut();toast("Your account and lists are deleted.");};
}
document.addEventListener("keydown",function(e){if(e.key==="Escape"&&ui.sheet){ui.sheet=null;renderSheet();}});

function playerCard(id){
  var p=P[id];if(!p)return "";if(p.goat&&(!p.active||(ui.nav==="board"&&ui.tab==="goat")||(ui.nav==="pick"&&ui.pick==="goat")||(ui.nav==="lists"&&ui.list==="goat")))return legendCard(asGoat(p));ensureBoard(p.pos);ensureBoard("overall");if(p.goat)ensureBoard("goat");loadHistory(id);
  var s=p.s;
  var stats=s?[["PTS",f1(s[1])],["REB",f1(s[2])],["AST",f1(s[3])],["STL",f1(s[4])],["BLK",f1(s[5])],["G",s[0]]]:null;
  function fr(key,label){var b=boards[key];var r=fanRank(key,id);
    if(!b||!b.rows||!b.rows.length)return '<div class="cell"><span>'+label+'</span><b>—</b><small>No picks yet</small></div>';
    if(!r)return '<div class="cell"><span>'+label+'</span><b>NR</b><small>Not ranked yet</small></div>';
    var mv=r.prev_rank==null?(b.prev?"New in the last 7 days":""):r.prev_rank>r.rank?"Up "+(r.prev_rank-r.rank)+" in 7 days":r.prev_rank<r.rank?"Down "+(r.rank-r.prev_rank)+" in 7 days":"No change in 7 days";
    return '<div class="cell"><span>'+label+'</span><b>#'+r.rank+'</b><small>'+fmt(r.points)+' pts'+(mv?' · '+mv:'')+'</small></div>';}
  var mp=me.l[p.pos].indexOf(id),mo=me.l.overall.indexOf(id);
  var front='<div class="tc-top"><span class="tc-team">'+esc(p.t||"FA")+'</span><span class="tc-pos">'+POSL[p.pos]+'</span></div>'+
    '<h2 id="pc-t" class="pname">'+splitName(p.n)+'</h2>'+
    (stats?'<div class="sts">'+stats.map(function(x){return '<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>';}).join("")+'</div><span class="tc-lab">'+esc(CFG.statsLabel||"Last regular season")+' · per game</span>':'<p class="sub">'+esc(p.note)+'</p>')+
    '<div class="cells">'+fr("overall","FANS · OVERALL")+fr(p.pos,"FANS · "+POSL[p.pos])+'</div>';
  var back='<div class="tc-top"><span class="tc-team">'+esc(p.t||"FA")+'</span><span class="tc-pos">RANK HISTORY</span></div>'+
    '<h2 class="pname sm">'+splitName(p.n)+'</h2>'+historyHTML(id)+
    '<div class="cells"><div class="cell mine"><span>YOU · '+POSL[p.pos]+'</span><b>'+(mp>-1?"#"+(mp+1):"—")+'</b><small>'+(mp>-1?"Your list":"Not on your list")+'</small></div>'+
    '<div class="cell mine"><span>YOU · OVERALL</span><b>'+(mo>-1?"#"+(mo+1):"—")+'</b><small>'+(mo>-1?"Your top 50":"Not in your top 50")+'</small></div></div>';
  return tradingCard(p,front,back,'<button class="btn sm" data-'+(mp>-1?"list":"pick")+'="'+p.pos+'">'+(mp>-1?"My "+POSL[p.pos]+" list":"Pick "+POSL[p.pos]+"s")+'</button>');
}

// Trading card: team-color frame, flips to the back with one tap
function tradingCard(p,front,back,btn,flipLabel){var wm=esc(p.j!=null?p.j:(p.t||""));
  return '<div class="sheet-card tcard-wrap" role="dialog" aria-modal="true" aria-labelledby="pc-t"><button class="x" data-close aria-label="Close">×</button>'+
    '<div class="tcard" style="--tc:'+tc(p)+'" data-flipcard><div class="tc-in">'+
    '<div class="tc-face tc-front"><span class="ph'+(p.j!=null?' jn':'')+'" aria-hidden="true">'+wm+'</span><i class="tc-foil" aria-hidden="true"></i>'+front+'</div>'+
    '<div class="tc-face tc-back" aria-hidden="true"><span class="ph" aria-hidden="true">'+wm+'</span>'+back+'</div></div></div>'+
    '<div class="btns"><button class="btn tint sm" data-flip>'+(flipLabel||"Flip: rank history")+'</button>'+btn+'</div></div>';}
function legendCard(p){ensureBoard("goat");var id=p.id,c=p.c||{},b=boards.goat,r=fanRank("goat",id),mi=me.l.goat.indexOf(id);
  var fans=!b||!b.rows||!b.rows.length?'<b>—</b><small>No picks yet</small>':r?'<b>#'+r.rank+'</b><small>'+fmt(r.points)+' pts</small>':'<b>NR</b><small>Not ranked yet</small>';
  var cells=[["PTS",f1(c.pts)],["REB",f1(c.reb)],["AST",f1(c.ast)],["STL",c.stl==null?"—":f1(c.stl)],["BLK",c.blk==null?"—":f1(c.blk)],["GAMES",fmt(c.g||0)]];
  var aw='<div class="sb3 one">'+AWARDS.map(function(w){var v=c[w[1]];return '<div class="r3"><span>'+w[0]+'</span><b class="'+((w[1]==="hof"?v:+v)?" w":"")+'">'+(w[1]==="hof"?(v?"✓":"—"):(+v||0))+'</b></div>';}).join("")+'</div>';
  var front='<div class="tc-top"><span class="tc-team">'+esc(p.t||"")+'</span><span class="tc-pos">'+POSL[p.pos]+' · '+esc(c.years||"")+'</span></div>'+
    '<h2 id="pc-t" class="pname">'+splitName(p.n)+'</h2>'+hofTag(p)+
    '<div class="sts">'+cells.map(function(x){return '<div><b>'+x[1]+'</b><span>'+x[0]+'</span></div>';}).join("")+'</div><span class="tc-lab">Career · regular season per game'+(c.stl==null?' · no steals/blocks before 1973-74':'')+'</span>'+
    '<div class="cells"><div class="cell"><span>FANS · ALL-TIME</span>'+fans+'</div><div class="cell mine"><span>YOU · ALL-TIME</span><b>'+(mi>-1?"#"+(mi+1):"—")+'</b><small>'+(mi>-1?"Your list":"Not on your list")+'</small></div></div>';
  var back='<div class="tc-top"><span class="tc-team">'+esc(p.t||"")+'</span><span class="tc-pos">AWARDS · HONORS</span></div><h2 class="pname sm">'+splitName(p.n)+'</h2>'+aw+'<span class="tc-lab">NBA numbers only</span>';
  return tradingCard(p,front,back,'<button class="btn sm" data-'+(mi>-1?"list":"pick")+'="goat">'+(mi>-1?"My all-time list":"Rank all-time greats")+'</button>',"Flip: awards");}

/* ---------- share card (1080x1350, made for Instagram) ---------- */
function loadImg(src){return new Promise(function(res){var i=new Image();i.onload=function(){res(i);};i.onerror=function(){res(null);};i.src=src;});}
async function shareCard(key,size){
  var L=me.l[key].slice(0,10);if(!L.length)return;var story=size==="story",oy=story?230:0;
  var D='"Saira Condensed","Arial Narrow",sans-serif',B='"Helvetica Neue",Helvetica,Inter,Arial,sans-serif';
  try{await Promise.all([document.fonts.load('800 104px "Saira Condensed"'),document.fonts.load('600 34px Inter')]);}catch(e){}
  var mark=await loadImg("/brand/mark.svg");
  // Drawn at 2x (2160 wide) so text and the logo stay crisp on phone screens and after apps compress the image.
  var S=2,W=1080,H=story?1920:1350,c=document.createElement("canvas");c.width=W*S;c.height=H*S;var x=c.getContext("2d");x.scale(S,S);
  x.imageSmoothingEnabled=true;x.imageSmoothingQuality="high";
  x.fillStyle="#07080F";x.fillRect(0,0,W,H);
  // purple spotlight from the top
  x.save();x.translate(W/2,-166);x.scale(1,940/(W*1.1));var g=x.createRadialGradient(0,0,0,0,0,W*1.1);
  g.addColorStop(0,"rgba(139,92,246,.5)");g.addColorStop(.45,"rgba(42,30,92,.25)");g.addColorStop(.75,"rgba(7,8,15,0)");x.fillStyle=g;x.fillRect(-W,-200,W*2,H*3);x.restore();
  var who=user?displayName().toUpperCase()+"'S":"MY";
  x.textBaseline="alphabetic";x.textAlign="left";
  x.fillStyle="#8B5CF6";x.font="700 24px "+B;x.letterSpacing="3px";
  x.fillText(who+" "+(key==="overall"?"OVERALL":POSL[key].toUpperCase())+" TOP 10",64,96+oy);x.letterSpacing="0px";
  x.fillStyle="#EEF1FF";x.font="800 104px "+D;x.fillText("MY TOP 10.",62,196+oy);
  if(mark)x.drawImage(mark,W-64-144,52+oy,144,150);
  var y=250+oy,rowH=story?88:76,gap=story?16:14;
  L.forEach(function(id,i){var p=isGoat(key)?asGoat(P[id]):P[id],col=tc(p);
    var gr=x.createLinearGradient(64,0,64+(W-128)*.3,0);gr.addColorStop(0,mix(col,.2));gr.addColorStop(1,"#161A2E");
    x.fillStyle=gr;x.fillRect(64,y,W-128,rowH);x.fillStyle=col;x.fillRect(64,y,8,rowH);
    x.save();x.beginPath();x.rect(64,y,W-128,rowH);x.clip();x.globalAlpha=.2;x.fillStyle="#3DE1FF";x.font="800 130px "+D;x.textAlign="right";x.textBaseline="middle";x.fillText(String(i+1),W-64-170,y+rowH/2+6);x.restore();
    x.textBaseline="middle";x.textAlign="left";x.fillStyle=i<5?"#3DE1FF":"#EEF1FF";x.font="800 52px "+D;x.fillText(String(i+1),96,y+rowH/2+3);
    x.fillStyle="#EEF1FF";x.font="600 34px "+B;var nm=p.n;while(x.measureText(nm).width>600&&nm.length>4)nm=nm.slice(0,-2);if(nm!==p.n)nm+="…";x.fillText(nm,184,y+rowH/2+1);
    x.fillStyle="rgba(238,241,255,.6)";x.font="600 26px "+B;x.textAlign="right";x.fillText(isGoat(key)&&p.c?trophies(p).toUpperCase():(key==="overall"?POSL[p.pos]+" · ":"")+(p.t||""),W-64-26,y+rowH/2+1);
    y+=rowH+gap;
    if(i===4){x.fillStyle="#262A44";x.fillRect(64,y+6,380,2);x.fillRect(W-64-380,y+6,380,2);x.fillStyle="#3DE1FF";x.font="700 20px "+B;x.textAlign="center";x.fillText("▲ TOP 5",W/2,y+8);y+=26;}
  });
  x.textAlign="left";x.textBaseline="alphabetic";x.fillStyle="#262A44";x.fillRect(64,H-112,W-128,2);
  x.font="800 44px "+D;var hx=64;[["FLOOR ","#EEF1FF"],["2","#8B5CF6"],[" RAFTERS","#EEF1FF"]].forEach(function(s){x.fillStyle=s[1];x.fillText(s[0],hx,H-56);hx+=x.measureText(s[0]).width;});
  x.fillStyle="#A7ACCA";x.font="600 26px "+B;x.textAlign="right";x.fillText("floor2rafters.com",W-64,H-60);
  var blob=await new Promise(function(r){c.toBlob(r,"image/png");});
  var name="f2r-my-"+key+"-top-10"+(story?"-story":"")+".png",file=null;try{file=new File([blob],name,{type:"image/png"});}catch(e){}
  var text="My "+(key==="overall"?"overall":POSL[key])+" top 10. Rank yours at floor2rafters.com";
  if(NATIVE&&NP.Share&&NP.Filesystem){try{var b64=await new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(",")[1]);};fr.onerror=rej;fr.readAsDataURL(blob);});
    var w=await NP.Filesystem.writeFile({path:name,data:b64,directory:"CACHE"});await NP.Share.share({title:"My top 10",text:text,files:[w.uri]});return;}catch(e){if(e&&/cancel/i.test(String(e.message||e)))return;}}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:text});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},4000);toast("Image saved. Post it and tag @floor2rafters.");
}
// team color mixed into the row color (same as the CSS color-mix team glow)
function mix(hex,amt){var a=parseInt(hex.slice(1),16),r=a>>16,g=a>>8&255,b=a&255,R=0x16,G=0x1A,Bb=0x2E;
  return "rgb("+Math.round(r*amt+R*(1-amt))+","+Math.round(g*amt+G*(1-amt))+","+Math.round(b*amt+Bb*(1-amt))+")";}


/* ---------- feedback ---------- */
function feedbackHref(){
  var to=CFG.feedbackEmail||"info@floor2rafters.com";
  var body="What happened or what would make F2R better:\n\n\n---\nScreen: "+ui.nav+" / "+(ui.nav==="board"?ui.tab:(ui.pick||ui.list||""))+(user?"\nSigned in":"\nGuest")+"\nDevice: "+navigator.userAgent;
  return "mailto:"+to+"?subject="+encodeURIComponent("F2R feedback")+"&body="+encodeURIComponent(body);
}

/* ---------- boot ---------- */
async function boot(){
  render();
  if(NATIVE){try{if(NP.StatusBar)NP.StatusBar.setStyle({style:"DARK"});if(NP.SplashScreen)NP.SplashScreen.hide();}catch(e){}}
  try{
    if(demo){var pj=await fetch("players.json");loadPlayers(await pj.json());}
    else{
      sb=window.supabase.createClient(CFG.supabaseUrl,CFG.supabaseAnonKey);
      var pr=await sb.from("players").select("*");if(pr.error)throw pr.error;loadPlayers(pr.data);
    }
  }catch(e){$("#app").innerHTML='<div class="empty">Couldn\'t load Floor 2 Rafters. Check your connection and refresh.</div>';return;}
  try{var g=JSON.parse(localStorage.getItem(LS)||"null");if(g){me.l=fix(g.l,DEEP);me.out=fix(g.out,999);me.deep=g.deep||{};me.name=g.name||null;me.notify=g.notify||{};me.pref=g.pref||{};me.xp=g.xp||0;me.streak=g.streak||0;me.last=g.last||"";me.best=g.best||0;me.snap=g.snap||{};me.calls=g.calls||[];}}catch(e){}
  syncOverall();
  if(sb){
    var s=await sb.auth.getSession();user=s.data.session&&s.data.session.user||null;
    if(user){await loadMine();await loadPro();signedInExtras().then(render);}
    sb.auth.onAuthStateChange(async function(ev,session){
      var nu=session&&session.user||null;if((nu&&nu.id)===(user&&user.id))return;
      user=nu;ui.sheet=null;ui.h2h=null;isAdmin=false;G={list:null,loading:false,board:{},members:{}};
      PRO=null;ADM=null;if(user){await loadMine();await loadPro();signedInExtras().then(render);toast("Signed in. Your picks now count.");groupLinkAfterSignIn();if(NATIVE)setTimeout(function(){pushSetup(false);},1500);}
      else{me={l:blank(),out:blank(),deep:{},xp:0,streak:0,last:"",best:0,snap:{},calls:[]};saved={};savedSt={};ui.nav="board";toast("Signed out.");}
      render();});
  }
  var seen=false;try{seen=!!localStorage.getItem("f2r-seen");}catch(e){}
  var any=TABS.some(function(t){return me.l[t[0]].length;});
  if(!seen&&!any){ui.nav="home";ui.revealChecked=true;try{localStorage.setItem("f2r-seen","1");}catch(e){}} // first visit: the front page first
  groupLinkOnBoot();
  ptrInit();
  ready=true;render();
  proReturnOnBoot();
  if(NATIVE)nativeHooks();
  if(!NATIVE&&"serviceWorker" in navigator&&location.protocol==="https:")navigator.serviceWorker.register("sw.js").catch(function(){});
}
boot();

/* ---------- phone app only ---------- */
// Android back button: close a sheet, then step back through the app, then leave the app from the Board.
function goBack(){
  if(ui.sheet){ui.sheet=null;renderSheet();return true;}
  if(ui.nav==="pick"&&ui.h2h){ui.h2h=null;render();return true;}
  if(ui.nav==="group"){ui.nav="groups";render();return true;}
  if(ui.nav==="settings"||ui.nav==="feedback"){ui.nav="me";render();return true;}
  if(ui.nav==="lists"&&ui.list){ui.list=null;render();return true;}
  if(ui.nav!=="board"){ui.nav="board";render();return true;}
  return false;}
function nativeHooks(){var A=NP.App;if(!A)return;
  try{A.addListener("backButton",function(){if(!goBack())A.exitApp();});}catch(e){}
  // A tapped invite link (floor2rafters.com/join/CODE) opens the app here
  try{A.addListener("appUrlOpen",function(ev){var c=joinCodeFrom(ev&&ev.url||"");if(c){openJoin(c);render();}});}catch(e){}
  pushSetup(false);
  // Coming back to the app: the boards are live, so refresh them if they're more than a couple of minutes old
  try{A.addListener("resume",function(){if(!demo&&boardsStale()){boards={};G.board={};render();}});}catch(e){}
}

// Phone alerts. Asks the phone's permission only after a "Want a heads-up?" sheet or a Settings switch.
var pushTok=null,pushWired=false;
async function pushSetup(ask){
  var PN=NP.PushNotifications;if(!NATIVE||!PN||!user||demo||!sb)return;
  if(!pushWired){pushWired=true;
    PN.addListener("registration",function(t){pushTok=t.value;sb.rpc("save_push_token",{p_token:t.value,p_platform:window.Capacitor.getPlatform()==="ios"?"ios":"android"});});
    PN.addListener("pushNotificationActionPerformed",function(a){var n=a&&a.notification&&a.notification.data&&a.notification.data.nav;ui.sheet=null;ui.nav=n==="pick"?"pick":"board";if(n!=="pick")ui.tab="overall";render();});}
  try{var p=await PN.checkPermissions();
    if(p.receive==="granted"){await PN.register();return;}
    if(p.receive==="denied"){if(ask)toast("Turn on notifications for Floor 2 Rafters in your phone's settings.");return;}
    if(!ask){var asked=null;try{asked=localStorage.getItem("f2r-pushask");}catch(e){}if(!asked&&!ui.sheet){ui.sheet="pushask";renderSheet();}return;}
    var q=await PN.requestPermissions();if(q.receive==="granted")await PN.register();}catch(e){}}
function pushAskHTML(){return '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="pa-t"><button class="x" data-close aria-label="Close">×</button>'+
  '<h2 id="pa-t" class="h1">Know when your #1 moves</h2><p class="sub">A weekly recap on Mondays, with a heads-up if your #1 climbed or slid 3+ spots that week. That\'s it. Change it any time in Settings.</p>'+
  '<button class="btn" data-pushyes>Turn on alerts</button><button class="btn tint sm" data-close>Not now</button></div>';}

/* ---------- Board post maker (admins): the live Fan Board as ready-to-post images, any day ---------- */
var PF='"Saira Condensed","Arial Narrow",sans-serif',PB='"Helvetica Neue",Helvetica,Inter,Arial,sans-serif';
var POST_KINDS=[
  {id:"feed",label:"Instagram post",size:"1080 × 1350",w:1080,h:1350},
  {id:"story",label:"Story · TikTok · Reels",size:"1080 × 1920",w:1080,h:1920},
  {id:"movers",label:"Who moved",size:"1080 × 1350",w:1080,h:1350},
  {id:"x",label:"X post",size:"1600 × 900",w:1600,h:900}];
function pBg(x,W,H){x.fillStyle="#07080F";x.fillRect(0,0,W,H);
  x.save();x.translate(W/2,-H*.12);x.scale(1,(H*.7)/(W*1.1));var g=x.createRadialGradient(0,0,0,0,0,W*1.1);
  g.addColorStop(0,"rgba(139,92,246,.5)");g.addColorStop(.45,"rgba(42,30,92,.25)");g.addColorStop(.75,"rgba(7,8,15,0)");x.fillStyle=g;x.fillRect(-W,-H,W*2,H*3);x.restore();}
function pText(x,t,X,Y,font,color,align,spacing){x.font=font;x.fillStyle=color;x.textAlign=align||"left";x.textBaseline="alphabetic";try{x.letterSpacing=(spacing||0)+"px";}catch(e){}x.fillText(t,X,Y);try{x.letterSpacing="0px";}catch(e){}}
// Footer lockup: the brand name, with the purple 2 (no longer the "Head 2 Head" tagline).
function pH2H(x,X,Y,size,align){var segs=[["FLOOR ","#EEF1FF"],["2","#8B5CF6"],[" RAFTERS","#EEF1FF"]];x.font="800 "+size+"px "+PF;var w=segs.reduce(function(s,a){return s+x.measureText(a[0]).width;},0),hx=align==="right"?X-w:align==="center"?X-w/2:X;
  segs.forEach(function(s){x.fillStyle=s[1];x.textAlign="left";x.fillText(s[0],hx,Y);hx+=x.measureText(s[0]).width;});}
function pMove(r){if(r.prev_rank==null)return {t:"NEW",c:"#3DE1FF"};var d=r.prev_rank-r.rank;return d>0?{t:"▲"+d,c:"#3DE1FF"}:d<0?{t:"▼"+(-d),c:"#FF5A4D"}:{t:"–",c:"#7C82A6"};}
function pRow(x,key,r,X,Y,Wd,Hh,s,hasPrev,voters){var p=isGoat(key)?asGoat(P[r.player_id]):P[r.player_id];if(!p)return;var col=tc(p);
  var gr=x.createLinearGradient(X,0,X+Wd*.3,0);gr.addColorStop(0,mix(col,.2));gr.addColorStop(1,"#161A2E");x.fillStyle=gr;x.fillRect(X,Y,Wd,Hh);x.fillStyle=col;x.fillRect(X,Y,8*s,Hh);
  x.save();x.beginPath();x.rect(X,Y,Wd,Hh);x.clip();x.globalAlpha=.2;x.fillStyle="#3DE1FF";x.font="800 "+Math.round(130*s)+"px "+PF;x.textAlign="right";x.textBaseline="middle";x.fillText(String(r.rank),X+Wd-170*s,Y+Hh/2+6*s);x.restore();
  x.textBaseline="middle";x.textAlign="left";x.fillStyle=r.rank<=5?"#3DE1FF":"#EEF1FF";x.font="800 "+Math.round(52*s)+"px "+PF;x.fillText(String(r.rank),X+30*s,Y+Hh/2+3*s);
  x.fillStyle="#EEF1FF";x.font="600 "+Math.round(32*s)+"px "+PB;var nm=p.n;while(x.measureText(nm).width>Wd*.55&&nm.length>4)nm=nm.slice(0,-2);if(nm!==p.n)nm+="…";x.fillText(nm,X+108*s,Y+Hh/2-12*s);
  x.fillStyle="#A7ACCA";x.font="400 "+Math.round(22*s)+"px "+PB;x.fillText(fmt(r.points)+" pts"+(voters?" · "+Math.round(r.votes/voters*100)+"% of fans":""),X+108*s,Y+Hh/2+22*s);
  x.textAlign="right";x.fillStyle="rgba(238,241,255,.6)";x.font="600 "+Math.round(24*s)+"px "+PB;x.fillText(p.t||"",X+Wd-(hasPrev?92:26)*s,Y+Hh/2+1);
  if(hasPrev){var m=pMove(r);x.fillStyle=m.c;x.font="800 "+Math.round(30*s)+"px "+PF;x.fillText(m.t,X+Wd-22*s,Y+Hh/2+2*s);}
  x.textBaseline="alphabetic";}
function pTop5Line(x,X,Y,Wd,s){x.fillStyle="#262A44";x.fillRect(X,Y,Wd*.38,2);x.fillRect(X+Wd*.62,Y,Wd*.38,2);pText(x,"▲ TOP 5",X+Wd/2,Y+7*s,"700 "+Math.round(20*s)+"px "+PB,"#3DE1FF","center",2);}
function pSpon(x,key,X,Y,align){var s=spon(key);if(!s)return;pText(x,"FAN BOARD PRESENTED BY "+s.name.toUpperCase(),X,Y,"700 22px "+PB,"#A7ACCA",align,3);}
function pBoardName(key){return key==="overall"?"OVERALL":isGoat(key)?"ALL-TIME":POSL[key];}
function pWeek(b){return b.week?dateLabel(b.week).toUpperCase():"LIVE";}
async function drawPost(kind,key){
  var b=boards[key],rows=(b&&b.rows)||[],voters=b.voters||0,hasPrev=!!b.prev,mark=await loadImg("/brand/mark.svg");
  try{await Promise.all([document.fonts.load('800 104px "Saira Condensed"'),document.fonts.load('600 34px Inter')]);}catch(e){}
  var k=POST_KINDS.filter(function(z){return z.id===kind;})[0],W=k.w,H=k.h,c=document.createElement("canvas");c.width=W;c.height=H;var x=c.getContext("2d");pBg(x,W,H);
  var top=rows[0],p1=top&&(isGoat(key)?asGoat(P[top.player_id]):P[top.player_id]);
  if(kind==="feed"){
    if(mark)x.drawImage(mark,64,52,90,94);
    pText(x,"FAN BOARD · "+pBoardName(key)+" · "+pWeek(b),W-64,100,"700 22px "+PB,"#3DE1FF","right",3);
    pText(x,"THE FANS HAVE",62,250,"800 112px "+PF,"#EEF1FF");pText(x,"SPOKEN.",62,352,"800 112px "+PF,"#EEF1FF");
    pText(x,fmt(voters)+" fans ranked "+(key==="overall"?"every position":isGoat(key)?"the all-time greats":"their "+POSL[key]+"s")+". Here's the top 5.",64,408,"500 28px "+PB,"#A7ACCA");
    var y=456;rows.slice(0,5).forEach(function(r){pRow(x,key,r,64,y,W-128,124,1.12,hasPrev,voters);y+=142;});
    pSpon(x,key,W/2,H-140,"center");x.fillStyle="#262A44";x.fillRect(64,H-112,W-128,2);pH2H(x,64,H-54,46);pText(x,"@floor2rafters · floor2rafters.com",W-64,H-60,"600 26px "+PB,"#A7ACCA","right");
  }else if(kind==="story"){
    if(mark)x.drawImage(mark,W/2-62,230,124,129);
    pText(x,"FANS' #1 · "+pBoardName(key)+" · "+pWeek(b),W/2,440,"700 26px "+PB,"#3DE1FF","center",3);
    x.fillStyle="#10121F";x.fillRect(72,480,W-144,470);x.strokeStyle="#3DE1FF";x.globalAlpha=.6;x.lineWidth=3;x.strokeRect(73.5,481.5,W-147,467);x.globalAlpha=1;
    if(p1){pText(x,"1",W/2,720,"800 260px "+PF,"#3DE1FF","center");var parts=p1.n.toUpperCase().split(" ");pText(x,parts[0],W/2,810,"800 84px "+PF,"#EEF1FF","center");pText(x,parts.slice(1).join(" "),W/2,890,"800 84px "+PF,"#EEF1FF","center");
      pText(x,(p1.t||"")+" · "+fmt(top.points)+" PTS"+(voters?" · "+Math.round(top.votes/voters*100)+"% OF FANS":""),W/2,932,"600 26px "+PB,"#A7ACCA","center",2);}
    var y2=992;rows.slice(1,5).forEach(function(r){pRow(x,key,r,72,y2,W-144,104,1.02,hasPrev,voters);y2+=118;});
    x.fillStyle="#8B5CF6";x.fillRect(72,1480,W-144,104);pText(x,"RANK YOURS · FLOOR2RAFTERS.COM",W/2,1548,"800 44px "+PF,"#EEF1FF","center",1);
    pH2H(x,W/2,1660,56,"center");pSpon(x,key,W/2,1430,"center");
  }else if(kind==="movers"){
    var m=moverLists(rows);if(mark)x.drawImage(mark,64,52,90,94);
    pText(x,pBoardName(key)+" · "+pWeek(b),W-64,100,"700 22px "+PB,"#3DE1FF","right",3);
    pText(x,"WHO MOVED.",62,250,"800 120px "+PF,"#EEF1FF");
    pText(x,"BIGGEST RISERS",64,330,"700 24px "+PB,"#3DE1FF","left",3);
    var y3=360;(m.up||[]).slice(0,3).forEach(function(r){pRow(x,key,r,64,y3,W-128,110,1.06,true,voters);y3+=124;});
    if(!(m.up||[]).length){pText(x,"No risers this week.",64,y3+40,"500 28px "+PB,"#A7ACCA");y3+=80;}
    y3+=50;pText(x,"BIGGEST DROPS",64,y3,"700 24px "+PB,"#FF5A4D","left",3);y3+=22;
    (m.dn||[]).slice(0,3).forEach(function(r){pRow(x,key,r,64,y3,W-128,110,1.06,true,voters);y3+=124;});
    if(!(m.dn||[]).length)pText(x,"No drops this week.",64,y3+40,"500 28px "+PB,"#A7ACCA");
    x.fillStyle="#262A44";x.fillRect(64,H-112,W-128,2);pH2H(x,64,H-54,46);pText(x,"Too high? Too low? Rank yours.",W-64,H-60,"600 26px "+PB,"#A7ACCA","right");
  }else{
    if(mark)x.drawImage(mark,80,70,110,114);
    pText(x,"FAN BOARD · "+pBoardName(key),80,250,"700 26px "+PB,"#3DE1FF","left",3);
    pText(x,"THE FANS",76,370,"800 120px "+PF,"#EEF1FF");pText(x,"HAVE SPOKEN.",76,480,"800 120px "+PF,"#EEF1FF");
    pText(x,(b.week?dateLabel(b.week):"Live")+" · "+fmt(voters)+" fans ranking",80,540,"500 30px "+PB,"#A7ACCA");
    pSpon(x,key,80,H-170,"left");pH2H(x,80,H-90,56);pText(x,"floor2rafters.com",80,H-48,"600 28px "+PB,"#A7ACCA");
    var y4=110;rows.slice(0,5).forEach(function(r){pRow(x,key,r,760,y4,W-840,112,1.05,hasPrev,voters);y4+=128;});
  }
  return c;
}
function postCaption(kind,key){var s=spon(key),cap=postCaption0(kind,key);return s?cap+"\n\nFan Board presented by "+(s.handle||s.name):cap;}
function postCaption0(kind,key){
  var b=boards[key],rows=(b&&b.rows)||[],nm=function(r){var p=r&&P[r.player_id];return p?p.n:"";},bn=key==="overall"?"Overall":isGoat(key)?"All-Time":POSL[key],m=moverLists(rows);
  var tags=key==="goat"?"#NBA #GOAT #basketball":"#NBA #basketball #hoops";
  if(kind==="movers"){var u=m.up&&m.up[0],d=m.dn&&m.dn[0];
    return "Who moved on the "+bn+" Fan Board this week 📈📉\n"+(u?"Biggest riser: "+nm(u)+" (up "+(u.prev_rank-u.rank)+")\n":"")+(d?"Biggest drop: "+nm(d)+" (down "+(d.rank-d.prev_rank)+")\n":"")+"\nToo high? Too low? Rank yours at floor2rafters.com\n\n"+tags;}
  if(kind==="x")return "The fans have spoken. "+bn+" Fan Board, "+(b.week?dateLabel(b.week):"right now")+":\n\n"+rows.slice(0,5).map(function(r){return r.rank+". "+nm(r);}).join("\n")+"\n\nYour #1? Rank yours at floor2rafters.com";
  return "The fans have spoken. 🏀\n\nThe "+bn+" Fan Board right now:\n"+rows.slice(0,5).map(function(r){return r.rank+". "+nm(r);}).join("\n")+"\n\n"+fmt(b.voters||0)+" fans ranking. Agree? Rank yours, link in bio.\n\n"+tags;
}
async function makePosts(key){
  ui.posts={key:key,items:null};renderSheet();ensureBoard(key);
  for(var t=0;t<30&&(!boards[key]||boards[key].loading);t++)await new Promise(function(r){setTimeout(r,200);});
  if(!boards[key]||!boards[key].rows||!boards[key].rows.length){if(ui.posts&&ui.posts.key===key){ui.posts.items=[];renderSheet();}return;}
  var items=[];for(var i=0;i<POST_KINDS.length;i++){var k=POST_KINDS[i],c=await drawPost(k.id,key);items.push({id:k.id,label:k.label,size:k.size,url:c.toDataURL("image/png"),caption:postCaption(k.id,key)});}
  if(ui.posts&&ui.posts.key===key){ui.posts.items=items;if(ui.sheet==="posts")renderSheet();}
}
function postsHTML(){
  var P0=ui.posts||{},key=P0.key||"overall",X='<button class="x" data-close aria-label="Close">×</button>';
  var h='<div class="sheet-card posts" role="dialog" aria-modal="true" aria-labelledby="po-t">'+X+'<span class="kicker blue">Admins only</span><h2 id="po-t" class="h1">Board posts</h2>'+
    '<p class="sub">The '+pBoardName(key).toLowerCase()+' board as ready-to-post images. Save each one, copy its caption, post.</p>'+
    '<nav class="tabs" aria-label="Which board">'+TABS.map(function(t){return '<button class="tb'+(t[0]==="overall"?" ov":isGoat(t[0])?" gt":"")+'" data-pkey="'+t[0]+'" aria-pressed="'+(t[0]===key)+'">'+(t[0]==="overall"?"OVERALL":isGoat(t[0])?"ALL-TIME":t[1])+'</button>';}).join("")+'</nav>';
  if(!P0.items)return h+'<div class="empty">Making your posts…</div></div>';
  if(!P0.items.length)return h+'<div class="empty">This board has no rankings yet.</div></div>';
  h+=P0.items.map(function(it,i){return '<div class="post"><img src="'+it.url+'" alt="'+esc(it.label)+' preview"><div class="post-r"><b>'+esc(it.label)+'</b><span class="note">'+it.size+'</span>'+
    '<button class="btn sm" data-psave="'+i+'">Save image</button><textarea class="input cap" id="cap'+i+'" rows="4" aria-label="'+esc(it.label)+' caption">'+esc(it.caption)+'</textarea><button class="btn tint sm" data-pcopy="'+i+'">Copy caption</button></div></div>';}).join("");
  return h+'<p class="note center">The board is live, so make these the day you post. Post the feed image and story together; X and Who moved later that day.</p></div>';
}
async function savePost(i){var it=ui.posts&&ui.posts.items&&ui.posts.items[i];if(!it)return;
  var blob=await (await fetch(it.url)).blob(),name="f2r-"+ui.posts.key+"-"+it.id+".png",file=null;try{file=new File([blob],name,{type:"image/png"});}catch(e){}
  if(NATIVE&&NP.Share&&NP.Filesystem){try{var w=await NP.Filesystem.writeFile({path:name,data:it.url.split(",")[1],directory:"CACHE"});await NP.Share.share({title:it.label,files:[w.uri]});return;}catch(e){if(/cancel/i.test(String(e&&e.message||e)))return;}}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file]});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(a.href);},4000);toast("Saved "+name);}
function copyCaption(i){var ta=document.getElementById("cap"+i);if(!ta)return;
  try{navigator.clipboard.writeText(ta.value).then(function(){toast("Caption copied.");},function(){ta.select();toast("Caption selected. Copy it.");});}catch(e){ta.select();toast("Caption selected. Copy it.");}}

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

/* ---------- Friend groups: a private board for your group chat ----------
   Same 50-49-48… math as the Fan Board, counting only the group, and live like every board.
   Signed-in fans only. In demo mode a sample group shows how it works. */
var G={list:null,loading:false,board:{},members:{}},GJOIN="f2r-join";
var DEMO_FRIENDS=["Marcus","Dre","Tasha","Big Mike"];
function gid(){return ui.gid;}
function gCur(){return (G.list||[]).filter(function(g){return g.id===ui.gid;})[0]||null;}
function joinLink(code){return "https://floor2rafters.com/join/"+code;}
function nickDefault(){var n=me.name||(user?displayName():"");return n.charAt(0).toUpperCase()+n.slice(1);}

// --- demo: one sample group built from sample boards plus your own lists ---
function demoGroup(){return {id:"demo",name:"The Group Chat",code:"HOOPS7",members:DEMO_FRIENDS.length+1,is_lead:true,nick:me.name||"You"};}
function demoLists(key){
  var pool=(sampleBoard(key).rows||[]).map(function(r){return r.player_id;}),seed=7,out=[];
  function rnd(){seed=(seed*1103515245+12345)%2147483648;return seed/2147483648;}
  DEMO_FRIENDS.forEach(function(n,f){seed=f*97+key.length*13+3;
    var l=pool.slice(0,key==="overall"?40:16).map(function(id,i){return {id:id,s:i+rnd()*9};}).sort(function(a,b){return a.s-b.s;}).map(function(x){return x.id;});
    out.push({nick:n,ids:l.slice(0,key==="overall"?30:10)});});
  if(me.l[key].length)out.unshift({nick:me.name||"You",ids:me.l[key].slice(0,50),me:true});
  return out;}
function calcBoard(lists,key){var s={};
  lists.forEach(function(L){L.ids.slice(0,50).forEach(function(id,i){var p=P[id];if(!p)return;if(key!=="overall"&&(isGoat(key)?!p.goat:p.pos!==key))return;
    var o=s[id]||(s[id]={player_id:id,points:0,firsts:0,votes:0});o.points+=50-i;o.votes++;if(i===0)o.firsts++;});});
  var voters=lists.filter(function(L){return L.ids.length;}).length;
  return Object.keys(s).map(function(k){return s[k];}).sort(function(a,b){return b.points-a.points||b.firsts-a.firsts||b.votes-a.votes||a.player_id-b.player_id;})
    .map(function(r,i){r.rank=i+1;r.voters=voters;return r;});}

// --- data ---
async function loadGroups(){
  if(demo){G.list=[demoGroup()];return;}
  if(!sb||!user){G.list=[];return;}
  G.loading=true;var r=await sb.rpc("my_groups");G.loading=false;
  G.list=r.error?[]:(r.data||[]);}
async function loadGroup(id,key){var k=id+"|"+key;
  if(demo){var L=demoLists(key);G.board[k]=calcBoard(L,key);
    G.members[k]=[{nick:me.name||"You",is_me:true,is_lead:true,top1:me.l[key][0]==null?null:me.l[key][0],listed:me.l[key].length}].concat(L.filter(function(x){return !x.me;}).map(function(x){return {nick:x.nick,is_me:false,is_lead:false,top1:x.ids[0],listed:x.ids.length};}));return;}
  G.board[k]="loading";
  var res=await Promise.all([sb.rpc("get_group_board",{p_group:id,p_key:key}),sb.rpc("get_group_members",{p_group:id,p_key:key})]);
  G.board[k]=res[0].error?"error":(res[0].data||[]);G.members[k]=res[1].error?[]:(res[1].data||[]);}
function ensureGroup(id,key){var k=id+"|"+key;if(G.board[k]!==undefined)return;loadGroup(id,key).then(function(){if(ui.nav==="group")render();});}
function refreshGroup(){Object.keys(G.board).forEach(function(k){if(k.indexOf(ui.gid+"|")===0)delete G.board[k];});}

// --- views ---
function segHTML(on){return '';return '<div class="seg" role="tablist" aria-label="Boards"><button role="tab" data-seg="board" aria-selected="'+(on==="board")+'">Fan Board</button><button role="tab" data-seg="groups" aria-selected="'+(on!=="board")+'">My Groups</button></div>';}
function groupsHTML(){
  var h=segHTML("groups")+'<div><span class="kicker blue">Private boards</span><h1 class="h1">Your group chat, ranked.</h1>'+
    '<p class="sub">Start a group, send the link, and see how your friends\' lists stack up. Same math as the Fan Board, just your people, updated live.</p></div>';
  if(!user&&!demo)return h+'<button class="btn" data-signin>Sign in to start a group</button><p class="note center">Groups need an account so your friends see your real lists.</p>';
  if(G.list===null){loadGroups().then(render);return h+'<div class="empty">Loading your groups…</div>';}
  if(G.list.length)h+='<div class="glist">'+G.list.map(function(g){return '<button class="grow" data-gopen="'+g.id+'"><span class="gname">'+esc(g.name)+'</span><span class="gmeta">'+g.members+(g.members===1?' person':' people')+(g.is_lead?' · you lead':'')+'</span><span class="gchev" aria-hidden="true">›</span></button>';}).join("")+'</div>';
  else h+='<div class="empty"><b>No groups yet.</b><br>Start one for your group chat, or join with a friend\'s code.</div>';
  h+='<div class="gacts"><button class="btn" data-gnew>Start a group</button><button class="btn tint" data-gjoin>Join with a code</button></div>';
  if(proOn()&&!isPro()&&!NATIVE)h+='<p class="note">Free: start 1 group of up to 12 people. <button class="link inline" data-pro>F2R Pro</button>: up to 10 groups of 50.</p>';
  h+='<p class="note">Your group sees the name you pick and your #1 on each list. Nobody outside the group sees anything.'+(demo?' This is a sample group; real groups turn on with sign-in.':'')+'</p>';
  return h;}
function groupHTML(){
  var g=gCur();if(!g){ui.nav="groups";return groupsHTML();}
  var key=ui.gtab||"overall",k=g.id+"|"+key;ensureGroup(g.id,key);ensureBoard(key);
  var rows=G.board[k],mem=G.members[k]||[],h=segHTML("groups");
  h+='<button class="link back" data-seg="groups">‹ My groups</button>';
  h+='<div class="ghead"><div><span class="kicker blue">Private · '+g.members+(g.members===1?' person':' people')+' · live</span><h1 class="h1">'+esc(g.name)+'</h1></div>'+
     '<button class="gcode" data-ginvite aria-label="Invite friends, code '+g.code+'"><span>INVITE</span><b>'+g.code+'</b></button></div>';
  h+='<nav class="tabs" aria-label="Group boards">'+TABS.map(function(t){return '<button class="tb'+(t[0]==="overall"?" ov":isGoat(t[0])?" gt":"")+'" data-gtab="'+t[0]+'" aria-pressed="'+(t[0]===key)+'">'+(t[0]==="overall"?"OVERALL":isGoat(t[0])?"ALL-TIME":t[1])+'</button>';}).join("")+'</nav>';
  if(rows===undefined||rows==="loading")h+='<div class="empty">Loading the group board…</div>';
  else if(rows==="error")h+='<div class="empty">Couldn\'t load the group board. Try again in a minute.</div>';
  else if(!rows.length)h+='<div class="empty"><b>Nobody here has '+(key==="overall"?"an overall top 50":isGoat(key)?"an all-time top 10":"a "+POSL[key]+" top 10")+' yet.</b><br>Be the first. Your list counts here and on the Fan Board.</div><button class="btn" data-pick="'+(key==="overall"?firstOpen():key)+'">Make my picks</button>';
  else{var vt=rows[0].voters||0;
    h+='<div class="list">'+rows.slice(0,key==="overall"?25:10).map(function(r,i){var p=P[r.player_id];if(!p)return "";if(isGoat(key))p=asGoat(p);
      var fr=fanRank(key,r.player_id),fans=fr?'Fans #'+fr.rank:fr===false?'Fans: NR':'';
      var sc=(key==="overall"?POSL[p.pos]+' · ':'')+r.votes+' of '+vt+' listed him'+(fans?' · '+fans:'');
      return '<button class="r tap" data-pid="'+r.player_id+'" style="--tc:'+tc(p)+'">'+ghost(r.rank)+'<span class="'+numCls(i)+'">'+r.rank+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span><span class="sc">'+sc+'</span></span>'+teamTag(p)+'</button>'+(i===4&&rows.length>5?cutLine():"");}).join("")+'</div>';}
  if(mem.length){h+='<h2 class="lbl gsec">THE GROUP · #1 '+(key==="overall"?"OVERALL":isGoat(key)?"ALL-TIME":POSL[key].toUpperCase())+'</h2><div class="gmem">'+mem.map(function(m){var p=m.top1!=null&&P[m.top1];
      return '<div class="gm"><span class="gnick">'+esc(m.nick)+(m.is_me?' <i>you</i>':'')+(m.is_lead?' <i class="ld">lead</i>':'')+'</span><span class="gpick">'+(p?esc(p.n):'No list yet')+'</span>'+
        (g.is_lead&&!m.is_me&&!demo?'<button class="gx" data-gkick="'+esc(m.nick)+'" aria-label="Remove '+esc(m.nick)+'">×</button>':'')+'</div>';}).join("")+'</div>';}
  h+='<div class="gacts"><button class="btn tint sm" data-ginvite>Invite friends</button>'+(g.is_lead&&!demo?'<button class="link center" data-gcode>Get a new code (old link stops working)</button>':'')+(!demo?'<button class="link center danger" data-gleave>Leave this group</button>':'')+'</div>';
  return h;}
function gNewHTML(){var X='<button class="x" data-close aria-label="Close">×</button>';
  return '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="gn-t">'+X+'<h2 id="gn-t" class="h1">Start a group</h2><p class="sub">You\'ll get a link to drop in the group chat.</p>'+
    '<form data-gnewf><label class="lbl" for="gname">GROUP NAME</label><input id="gname" class="input" maxlength="40" required placeholder="The Group Chat">'+
    '<label class="lbl" for="gnick">YOUR NAME IN THE GROUP</label><input id="gnick" class="input" maxlength="24" required value="'+esc(nickDefault())+'" placeholder="Kail">'+
    '<button class="btn" type="submit">Start the group</button></form><p class="note">The group sees this name and your #1 on each list.</p></div>';}
function gJoinHTML(){var X='<button class="x" data-close aria-label="Close">×</button>',code=ui.gcode||"";
  return '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="gj-t">'+X+'<h2 id="gj-t" class="h1">Join a group</h2><p class="sub">'+(code?'You\'ve been invited. Pick the name your friends will see.':'Type the 6-letter code a friend sent you.')+'</p>'+
    '<form data-gjoinf><label class="lbl" for="gjc">CODE</label><input id="gjc" class="input otp" maxlength="6" required autocapitalize="characters" autocomplete="off" value="'+esc(code)+'" placeholder="HOOPS7">'+
    '<label class="lbl" for="gjn">YOUR NAME IN THE GROUP</label><input id="gjn" class="input" maxlength="24" required value="'+esc(nickDefault())+'" placeholder="Kail">'+
    '<button class="btn" type="submit">Join</button></form><p class="note">The group sees this name and your #1 on each list.</p></div>';}

// --- actions ---
function gNeedsAccount(){if(demo){toast("Groups turn on once sign-in is set up. This one's a sample.");return true;}if(!user){ui.sheet="signin";renderSheet();return true;}return false;}
async function gInvite(){var g=gCur();if(!g)return;var url=joinLink(g.code),text="Join my Floor 2 Rafters group \""+g.name+"\" and rank players head to head with us. Code "+g.code;
  if(NATIVE&&NP.Share){try{await NP.Share.share({title:"Join my F2R group",text:text,url:url});return;}catch(e){return;}}
  if(navigator.share){try{await navigator.share({title:"Join my F2R group",text:text,url:url});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  try{await navigator.clipboard.writeText(text+"\n"+url);toast("Invite link copied. Paste it in the group chat.");}catch(e){toast("Code: "+g.code+" · "+url);}}
function wireGroups(app){
  app.querySelectorAll("[data-seg]").forEach(function(b){b.onclick=function(){var s=b.dataset.seg;ui.nav=s==="board"?"board":"groups";if(s==="groups")G.list=demo?G.list:null;render();window.scrollTo(0,0);};});
  app.querySelectorAll("[data-gopen]").forEach(function(b){b.onclick=function(){ui.gid=b.dataset.gopen;ui.gtab=ui.gtab||"overall";ui.nav="group";render();window.scrollTo(0,0);};});
  app.querySelectorAll("[data-gtab]").forEach(function(b){b.onclick=function(){ui.gtab=b.dataset.gtab;render();};});
  var n=$("[data-gnew]",app);if(n)n.onclick=function(){if(gNeedsAccount())return;ui.sheet="gnew";renderSheet();};
  var j=$("[data-gjoin]",app);if(j)j.onclick=function(){if(gNeedsAccount())return;ui.gcode="";ui.sheet="gjoin";renderSheet();};
  app.querySelectorAll("[data-ginvite]").forEach(function(b){b.onclick=gInvite;});
  var c=$("[data-gcode]",app);if(c)c.onclick=async function(){if(!c.dataset.sure){c.dataset.sure="1";c.textContent="Tap again: the old code and link stop working";return;}
    var r=await sb.rpc("new_code",{p_group:ui.gid});if(r.error){toast(r.error.message);return;}gCur().code=r.data;render();toast("New code: "+r.data);};
  var l=$("[data-gleave]",app);if(l)l.onclick=async function(){if(!l.dataset.sure){l.dataset.sure="1";l.textContent="Tap again to leave the group";return;}
    var r=await sb.rpc("leave_group",{p_group:ui.gid});if(r.error){toast("Couldn't leave. Try again.");return;}G.list=null;ui.nav="groups";render();toast("You left the group.");};
  app.querySelectorAll("[data-gkick]").forEach(function(b){b.onclick=async function(){if(!b.dataset.sure){b.dataset.sure="1";b.textContent="Remove?";b.classList.add("sure");return;}
    var r=await sb.rpc("remove_member",{p_group:ui.gid,p_nick:b.dataset.gkick});if(r.error){toast(r.error.message);return;}refreshGroup();gCur().members--;render();toast(b.dataset.gkick+" removed.");};});
}
function wireGroupSheets(el){
  var f=$("[data-gnewf]",el);if(f)f.onsubmit=async function(e){e.preventDefault();var bt=$("button[type=submit]",f);bt.disabled=true;
    var r=await sb.rpc("create_group",{p_name:$("#gname",f).value,p_nick:$("#gnick",f).value});
    if(r.error){bt.disabled=false;var m=r.error.message||"Couldn't start the group.";if(/Pro/.test(m)&&proOn()&&!NATIVE){ui.sheet="pro";renderSheet();}toast(NATIVE||!proOn()?m.replace(/ F2R Pro.*$/,""):m);return;}
    var row=(r.data&&r.data[0])||r.data||{};await loadGroups();ui.gid=row.id;ui.nav="group";ui.sheet=null;render();window.scrollTo(0,0);gInvite();};
  var jf=$("[data-gjoinf]",el);if(jf)jf.onsubmit=async function(e){e.preventDefault();var bt=$("button[type=submit]",jf);bt.disabled=true;
    var r=await sb.rpc("join_group",{p_code:$("#gjc",jf).value.trim().toUpperCase(),p_nick:$("#gjn",jf).value});
    if(r.error){bt.disabled=false;var jm=r.error.message||"Couldn't join.";toast(NATIVE||!proOn()?jm.replace(/; the lead can go Pro.*$/,"."):jm);return;}
    try{localStorage.removeItem(GJOIN);}catch(x){}ui.gcode="";await loadGroups();ui.gid=r.data;ui.nav="group";ui.sheet=null;render();window.scrollTo(0,0);toast("You're in. Your lists count here now.");};
}
// Invite links look like floor2rafters.com/?g=CODE. Remember the code through sign-in, then open the join sheet.
// Invite links look like floor2rafters.com/join/CODE (older ?g=CODE links still work). On phones with the app,
// the link opens the app (see mobile/README). Remember the code through sign-in, then open the join sheet.
function joinCodeFrom(url){try{var u=new URL(url,location.href),m=u.pathname.match(/^\/join\/([A-Za-z0-9]{4,8})\/?$/),c=m?m[1]:u.searchParams.get("g");
  return c?c.replace(/[^A-Za-z0-9]/g,"").toUpperCase().slice(0,6):null;}catch(e){return null;}}
function openJoin(code){
  if(code)try{localStorage.setItem(GJOIN,code);}catch(e){}
  if(!code)try{code=localStorage.getItem(GJOIN);}catch(e){}
  if(!code)return false;ui.nav="groups";ui.revealChecked=true;
  if(demo){toast("Groups turn on once sign-in is set up.");return true;}
  ui.gcode=code;if(user){ui.sheet="gjoin";}else{ui.sheet="signin";setTimeout(function(){toast("Sign in to join your friends' group.");},0);}return true;}
function groupLinkOnBoot(){
  var code=joinCodeFrom(location.href);
  if(code)try{history.replaceState(null,"","/");}catch(e){}
  openJoin(code);}
function groupLinkAfterSignIn(){var code=null;try{code=localStorage.getItem(GJOIN);}catch(e){}if(code){ui.gcode=code;ui.nav="groups";G.list=null;ui.sheet="gjoin";}}

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

/* ---------- the moment you pick: team-color flash and "fans agree" ---------- */
var tapLock=false,afterT=null;
function lnm(n){var w=n.split(" "),l=w[w.length-1];if(/^(Jr\.?|Sr\.?|II|III|IV)$/.test(l)&&w.length>2)l=w[w.length-2];return l;}
function reduceMotion(){try{return window.matchMedia("(prefers-reduced-motion: reduce)").matches;}catch(e){return false;}}
function pickTap(side){if(tapLock||!ui.h2h)return;var h=ui.h2h,candWins=side===(h.flip?"b":"a");
  var cards=document.querySelectorAll(".h2h .pc");
  if(!cards.length||reduceMotion()||window.__noAnim){doPick(candWins);return;}
  tapLock=true;var sec=document.querySelector(".h2h");if(sec)sec.classList.add("picked");
  cards.forEach(function(c){c.classList.add(c.dataset.side===side?"win":"lose");});
  setTimeout(function(){tapLock=false;doPick(candWins);},300);}
function doPick(candWins){var h=ui.h2h;if(!h)return;var key=h.key,opp=h2hOpp(h),winner=candWins?h.cand:opp,loser=candWins?opp:h.cand;
  window.__capT=[];try{h2hPick(candWins);}finally{var msgs=window.__capT||[];window.__capT=null;}showAfter(key,winner,loser,msgs[msgs.length-1]);}
function afterEl(){var el=document.getElementById("after");if(!el){el=document.createElement("div");el.id="after";el.className="after";el.setAttribute("role","status");el.hidden=true;document.body.appendChild(el);}return el;}
function hideAfter(){clearTimeout(afterT);afterEl().hidden=true;document.body.classList.remove("has-after");}
// No "<Name> it is." after every pick: the bar only shows when there's something worth saying
// (a list message, or what the fans think of the pick).
function showAfter(key,winner,loser,msg){var el=afterEl(),w=P[winner];if(!w)return;hideAfter();var tok=++afterTok;
  function open(){el.hidden=false;document.body.classList.add("has-after");clearTimeout(afterT);afterT=setTimeout(hideAfter,4000);}
  el.innerHTML='<span class="ag" id="ag">'+(msg?'<span class="res">'+esc(msg)+'</span>':'')+'<span id="ag2"></span></span>';
  if(msg)open();
  agreeText(key,winner,loser).then(function(t){var a=document.getElementById("ag2");if(!t||!a||tok!==afterTok)return;a.innerHTML=t;if(el.hidden)open();});}
var afterTok=0;
// "64% of fans took him too": a live count of fans who have both players (or one of them) on that list, never shown under 20 fans.
// Before then, it falls back to the Fan Board ranks.
var AGREE={};
async function agreeText(key,winner,loser){var w=P[winner],l=P[loser],k=key+"|"+winner+"|"+loser;
  if(!demo&&sb){if(AGREE[k]===undefined){try{var r=await sb.rpc("h2h_agree",{p_key:key,p_a:winner,p_b:loser});AGREE[k]=r.error?null:(r.data&&r.data[0])||null;}catch(e){AGREE[k]=null;}}
    var d=AGREE[k];if(d&&d.a_wins+d.b_wins>=20){var pct=Math.round(d.a_wins/(d.a_wins+d.b_wins)*100);
      return pct>=50?'<b>'+pct+'%</b> of fans took '+esc(lnm(w.n))+' too.':'Bold. Only <b>'+pct+'%</b> of fans took '+esc(lnm(w.n))+'.';}}
  var a=fanRank(key,winner),b=fanRank(key,loser);
  if(a&&b)return a.rank<b.rank?'The fans agree: '+esc(lnm(w.n))+' <b>#'+a.rank+'</b>, '+esc(lnm(l.n))+' #'+b.rank+'.':'Hot take. The fans have '+esc(lnm(l.n))+' higher, <b>#'+b.rank+'</b> to #'+a.rank+'.';
  if(a)return 'The fans have '+esc(lnm(w.n))+' <b>#'+a.rank+'</b>.';
  return null;}

/* ---------- Called it: your list saw it coming before the fans did ---------- */
// For each board, we keep your top 10 as it stood during the last board week you saw. When a new board lands,
// that list is checked against it: your #1 became the fans' #1 (and wasn't before), or a top-5 pick of yours rose 5+ spots.
function todayISO(){var o=et(Date.now());return o.year+"-"+o.month+"-"+o.day;}
function daysApart(a,b){return Math.round((new Date(b+"T12:00:00Z")-new Date(a+"T12:00:00Z"))/864e5);}
// Once a week we save your top 10 and where the fans had each player. A week later we check: did your #1 become
// the fans' #1, or did one of your top 5 climb 5+ spots on the fans' board?
function checkCalls(key){var b=boards[key];if(!ready||!b||!b.rows||!b.rows.length)return;
  me.snap=me.snap||{};me.calls=me.calls||[];var s=me.snap[key],today=todayISO(),now=me.l[key].slice(0,10),ranks={};
  now.forEach(function(id){var r=fanRank(key,id);ranks[id]=r?r.rank:null;});
  if(!s||!s.r||!s.w||!/^\d{4}-\d{2}-\d{2}$/.test(s.w)){me.snap[key]={w:today,ids:now,r:ranks};saveLocal();return;}
  if(daysApart(s.w,today)<7)return;
  var got=[],top=b.rows[0];
  if(s.ids[0]===top.player_id&&s.r[s.ids[0]]!==1)got.push({w:today,k:key,p:top.player_id,t:"one",r:1});
  s.ids.slice(0,5).forEach(function(id){var then=s.r[id],r=fanRank(key,id);if(r&&then&&then-r.rank>=5&&!(got[0]&&got[0].p===id))got.push({w:today,k:key,p:id,t:"rise",r:r.rank,f:then});});
  got=got.slice(0,3);me.snap[key]={w:today,ids:now,r:ranks};
  if(got.length){got.forEach(function(c){me.calls.push(c);gainXP(50);});if(me.calls.length>60)me.calls=me.calls.slice(-60);
    ui.called=(ui.called||[]).concat(got);var c=got[0],n=P[c.p]?P[c.p].n:"";
    toast(c.t==="one"?"Called it! You had "+n+" #1 before the fans did. +50 XP":"Called it! "+n+" jumped "+(c.f-c.r)+" spots to #"+c.r+". +50 XP");}
  changed();}
function calledHTML(key){var c=(ui.called||[]).filter(function(x){return x.k===key;});if(!c.length)return "";
  return '<div class="called"><span class="cl">CALLED IT</span>'+c.map(function(x){var n=P[x.p]?esc(P[x.p].n):"";
    return '<span>'+(x.t==="one"?'You had <b>'+n+'</b> #1 before the fans did.':'<b>'+n+'</b> rose '+(x.f-x.r)+' spots to #'+x.r+' this week. You had him top 5.')+' <i>+50 XP</i></span>';}).join("")+'</div>';}

/* ---------- Badges on Me ---------- */
function badges(){var top10=TABS.some(function(t){return t[0]!=="overall"&&me.l[t[0]].length>=PICK;}),best=Math.max(me.best||0,me.streak||0),ht=hotTakes()||0,calls=(me.calls||[]).length;
  return [["First top 10",top10,top10?"Locked your first top 10.":"Finish any top 10.",1],
    ["7-day streak",best>=7,best>=7?"Picked 7 days in a row.":"Best so far: "+best+" day"+(best===1?"":"s")+".",2],
    ["Hot Take King",ht>=5,ht>=5?ht+" players 5+ spots off the fans.":"Get 5 players 5+ spots off the fans ("+ht+" now).",3],
    ["Called It",calls>0,calls?calls+" call"+(calls===1?"":"s")+" before the fans.":"Rank a riser before the fans do.",calls>0?Math.min(3,calls):1]];}
function bannerSVG(on,ch){var c='';for(var i=0;i<ch;i++)c+='<path d="M10 '+(30+i*9)+' L22 '+(24+i*9)+' L34 '+(30+i*9)+'" fill="none" stroke="'+(on?'#3DE1FF':'#3A3F63')+'" stroke-width="3.5"/>';
  return '<svg width="44" height="62" viewBox="0 0 44 62" aria-hidden="true"><path d="M3 2 H41 V60 L22 50 L3 60 Z" fill="'+(on?'#1E1740':'#161A2E')+'" stroke="'+(on?'#8B5CF6':'#262A44')+'" stroke-width="2"/>'+c+'</svg>';}
function badgesHTML(){return '<div class="badges" aria-label="Badges">'+badges().map(function(b){return '<div class="bdg'+(b[1]?' on':'')+'">'+bannerSVG(b[1],b[3])+'<b>'+b[0]+'</b><span>'+b[2]+'</span></div>';}).join("")+'</div>';}

/* ---------- Level up: chevrons rise like a banner going up ---------- */
function levelUpFx(name){if(window.__noAnim||reduceMotion()){toast("Level up: "+name+"!");return;}fx(function(){levelUpShow(name);return 2200;});}
function levelUpShow(name){
  var el=document.createElement("div");el.className="lvlup";el.setAttribute("role","status");
  el.innerHTML='<div class="lv-in"><div class="lv-ch">'+[0,1,2].map(function(i){return '<svg style="--d:'+(i*90)+'ms" width="120" height="40" viewBox="0 0 120 40" aria-hidden="true"><path d="M8 34 L60 8 L112 34" fill="none" stroke="#3DE1FF" stroke-width="9"/></svg>';}).join("")+'</div><span class="lv-k">LEVEL UP</span><b class="lv-n">'+esc(name)+'</b></div>';
  document.body.appendChild(el);el.onclick=function(){el.remove();};setTimeout(function(){el.classList.add("out");},1700);setTimeout(function(){el.remove();},2100);}

/* ---------- #1 reveal (tap the Jumbotron): lights down, #10 to #2, then #1 lands ---------- */
var revealT=[];
function runReveal(el){revealT.forEach(clearTimeout);revealT=[];
  var card=el.querySelector(".sheet-card.reveal"),board=el.querySelector(".rv-board"),b=boards[ui.rkey||"overall"];
  if(!card||!board||!b||!b.rows||b.rows.length<3||window.__noAnim||reduceMotion())return;
  var n=Math.min(10,b.rows.length),seq=document.createElement("div");seq.className="rv-seq";seq.setAttribute("aria-hidden","true");board.appendChild(seq);
  card.classList.add("dark");var step=0;
  function show(i){var r=b.rows[i],p=isGoat(ui.rkey)?asGoat(P[r.player_id]):P[r.player_id];
    seq.innerHTML='<span class="sq-k">FANS\' #'+r.rank+'</span><span class="sq-n">'+r.rank+'</span><span class="sq-p">'+esc(p.n)+'</span>';seq.style.setProperty("--tc",tc(p));}
  function finish(){revealT.forEach(clearTimeout);seq.remove();card.classList.remove("dark");board.classList.add("land");}
  revealT.push(setTimeout(function(){for(var i=n-1;i>=1;i--)(function(i,k){revealT.push(setTimeout(function(){show(i);},k*330));})(i,n-1-i);
    revealT.push(setTimeout(finish,(n-1)*330+200));},500));
  seq.onclick=finish;}


/* ---------- Share my top 10: pick a size ---------- */
function sharePickHTML(){var k=ui.shareKey||"pg",nm=k==="overall"?"overall":isGoat(k)?"all-time":POSL[k];
  return '<div class="sheet-card" role="dialog" aria-modal="true" aria-labelledby="sp-t"><button class="x" data-close aria-label="Close">×</button>'+
  '<h2 id="sp-t" class="h1">Share my top 10</h2><p class="sub">Your '+esc(nm)+' list as an image.</p>'+
  '<div class="sizes"><button class="size" data-sharesize="feed"><i class="fr feed" aria-hidden="true"></i><b>Post</b><span>4:5 · feed, X</span></button>'+
  '<button class="size" data-sharesize="story"><i class="fr story" aria-hidden="true"></i><b>Story</b><span>9:16 · Stories, TikTok</span></button></div></div>';}
async function shareBlob(blob,name,text,title){var file=null;try{file=new File([blob],name,{type:"image/png"});}catch(e){}
  if(NATIVE&&NP.Share&&NP.Filesystem){try{var b64=await new Promise(function(res,rej){var fr=new FileReader();fr.onload=function(){res(String(fr.result).split(",")[1]);};fr.onerror=rej;fr.readAsDataURL(blob);});
    var w=await NP.Filesystem.writeFile({path:name,data:b64,directory:"CACHE"});await NP.Share.share({title:title,text:text,files:[w.uri]});return;}catch(e){if(e&&/cancel/i.test(String(e.message||e)))return;}}
  if(file&&navigator.canShare&&navigator.canShare({files:[file]})){try{await navigator.share({files:[file],text:text});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  var a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(function(){URL.revokeObjectURL(a.href);},4000);toast("Image saved. Post it and tag @floor2rafters.");}
/* ---------- Admin numbers: what to track each week, and what to show a sponsor ---------- */
var ADM=null;
async function signedInExtras(){if(!sb||!user)return;try{sb.rpc("touch_activity");}catch(e){}
  try{var r=await sb.rpc("am_admin");if(r&&r.data===true){isAdmin=true;}}catch(e){}}
function sampleStats(){var wk=[],w=new Date(Date.UTC(2026,7,31)),act=[0,0,180,410,640,820,1010,1240],ret=[0,0,0,150,330,480,610,790],su=[0,0,180,260,290,240,250,312];
  for(var i=0;i<8;i++){var d=new Date(w.getTime()+i*7*864e5).toISOString().slice(0,10);wk.push({week:d,active:act[i],returning:ret[i],prev:i?act[i-1]:0,signups:su[i]});}
  return {sample:true,week:wk[7].week,weeks:wk,fans:1532,with_lists:1410,full_lists:688,board_voters:1196,groups:84,group_members:402,pro:0,alerts:0,sponsor_views:0,sponsor_taps:0};}
async function loadAdmin(){if(demo||!sb){ADM=sampleStats();return;}var r=await sb.rpc("admin_stats");ADM=r.error?{error:true}:(r.data||{error:true});}
function pctChange(a,b){return b?Math.round((a-b)/b*100):null;}
function adminHTML(){var h='<button class="back" data-nav="me">‹ Me</button><div><span class="kicker blue">Admins only'+(ADM&&ADM.sample?' · sample numbers (demo)':' · live')+'</span><h1 class="h1">The numbers</h1></div>';
  if(!ADM){loadAdmin().then(render);return h+'<div class="empty">Counting…</div>';}
  if(ADM.error)return h+'<div class="empty">Couldn\'t load the numbers. Make sure you\'re signed in as an admin.</div>';
  var W=ADM.weeks||[],cur=W[W.length-1]||{active:0,returning:0,prev:0,signups:0},last=W[W.length-2]||{active:0};
  var ch=pctChange(cur.active,last.active),ret=cur.prev?Math.round(cur.returning/cur.prev*100):null;
  h+='<div class="tiles adm">'+
    tile(fmt(cur.active),"FANS THIS WEEK",ch==null?"":(ch>=0?"▲ ":"▼ ")+Math.abs(ch)+"% vs last week","b")+
    tile(ret==null?"—":ret+"%","CAME BACK",ret==null?"Needs two weeks of data":fmt(cur.returning)+" of last week's "+fmt(cur.prev),"p")+
    tile(fmt(cur.signups),"NEW SIGN-UPS","This week · "+fmt(ADM.fans)+" total","")+
    tile(fmt(ADM.full_lists),"ALL 5 TOP 10s","of "+fmt(ADM.with_lists)+" fans with a list","")+'</div>';
  // weekly fans, last 8 weeks (one series: bars; returning share as text under each)
  var mx=Math.max.apply(null,W.map(function(x){return x.active;}).concat([1]));
  h+='<section class="achart" aria-label="Weekly fans, last 8 weeks"><div class="hrow"><span class="kicker">Weekly fans · last 8 weeks</span><span class="note">Came back %</span></div><div class="abars">'+
    W.map(function(x,i){var r=x.prev?Math.round(x.returning/x.prev*100):null,hpx=Math.max(x.active?4:0,Math.round(x.active/mx*120));
      return '<div class="ab'+(i===W.length-1?' now':'')+'" tabindex="0" title="Week of '+esc(dateLabel(x.week))+': '+fmt(x.active)+' fans, '+fmt(x.signups)+' new'+(r!=null?', '+r+'% came back':'')+'">'+
        '<span class="av">'+(x.active?fmt(x.active):'')+'</span><i style="height:'+hpx+'px"></i><span class="aw">'+esc(dateLabel(x.week))+'</span><span class="ar">'+(r==null?'—':r+'%')+'</span></div>';}).join("")+'</div></section>';
  h+='<div class="menu adm2">'+
    row("Fans on the board right now",fmt(ADM.board_voters||0))+row("Friend groups",fmt(ADM.groups)+" groups · "+fmt(ADM.group_members)+" members")+
    row("F2R Pro",fmt(ADM.pro))+row("Phones with alerts on",fmt(ADM.alerts))+row("Sponsor spot, last 7 days",fmt(ADM.sponsor_views)+" views · "+fmt(ADM.sponsor_taps)+" taps")+'</div>';
  h+='<button class="btn" data-adcopy>Copy sponsor summary</button><textarea id="adsum" class="input cap" rows="4" readonly aria-label="Sponsor summary">'+esc(sponsorSummary())+'</textarea>'+
    '<p class="note">Weekly fans = signed-in fans who opened F2R that week (Mon–Sun, Eastern). Came back = last week\'s fans who opened it again this week.</p>';
  return h;
  function tile(v,k,sub,c){return '<div class="tile'+(c?" "+c:"")+'"><b>'+v+'</b><span>'+k+'</span>'+(sub?'<small>'+esc(sub)+'</small>':'')+'</div>';}
  function row(k,v){return '<div class="arow"><span>'+esc(k)+'</span><b>'+esc(v)+'</b></div>';}}
function sponsorSummary(){if(!ADM||ADM.error)return "";var W=ADM.weeks||[],c=W[W.length-1]||{},l=W[W.length-2]||{},ch=pctChange(c.active,l.active),ret=c.prev?Math.round(c.returning/c.prev*100):null;
  return "Floor 2 Rafters, week of "+dateLabel(ADM.week)+": "+fmt(c.active||0)+" fans used F2R this week"+(ch!=null?" ("+(ch>=0?"up ":"down ")+Math.abs(ch)+"% on last week)":"")+
    (ret!=null?", and "+ret+"% of last week's fans came back":"")+". "+fmt(c.signups||0)+" new sign-ups this week, "+fmt(ADM.fans||0)+" fans in all. "+
    fmt(ADM.board_voters||0)+" fans' lists are on the live Fan Board."+(ADM.sponsor_views?" Sponsor spot, last 7 days: "+fmt(ADM.sponsor_views)+" views, "+fmt(ADM.sponsor_taps)+" taps.":"")+(ADM.sample?" (SAMPLE NUMBERS)":"");}
function wireAdmin(app){var b=$("[data-adcopy]",app);if(!b)return;b.onclick=function(){var t=$("#adsum",app).value;
  try{navigator.clipboard.writeText(t).then(function(){toast("Summary copied.");},function(){$("#adsum",app).select();toast("Summary selected. Copy it.");});}catch(e){$("#adsum",app).select();}};}

// First top 10 ever: celebrate and ask the fan to share it or challenge a friend (fans bring fans).
function firstTen(){var n=0;TABS.forEach(function(t){var k=t[0];if(k!=="overall"&&me.l[k].length>=PICK)n++;});return n===1;}
function first10HTML(){var k=ui.shareKey||"pg",nm=isGoat(k)?"all-time":POSL[k],L=me.l[k].slice(0,3);
  return '<div class="sheet-card f10" role="dialog" aria-modal="true" aria-labelledby="f10-t"><button class="x" data-close aria-label="Close">×</button>'+
  '<span class="kicker blue">+25 XP · First top 10</span><h2 id="f10-t" class="hero">Your '+esc(nm)+'<br>top 10 is set.</h2>'+
  '<ol class="f10-top">'+L.map(function(id,i){var p=P[id];return '<li style="--tc:'+(TC[p.t]||"#8B5CF6")+'"><b>'+(i+1)+'</b><span>'+esc(p.n)+'</span><i>'+esc(p.t||"")+'</i></li>';}).join("")+'</ol>'+
  '<p class="sub">It counts on the Fan Board now. Think your friends would get it wrong? Prove it.</p>'+
  '<button class="btn" data-f10share>Share my top 10</button><button class="btn tint" data-f10dare>Challenge a friend</button>'+
  '<button class="link center" data-close>Keep picking</button></div>';}
async function dareFriend(k){var nm=isGoat(k)?"all-time":POSL[k],url="https://floor2rafters.com/",
  text="I just set my "+nm+" top 10 on Floor 2 Rafters. Bet yours is worse. Rank yours:";
  if(navigator.share){try{await navigator.share({title:"Floor 2 Rafters",text:text,url:url});return;}catch(e){if(e&&e.name==="AbortError")return;}}
  try{await navigator.clipboard.writeText(text+" "+url);toast("Link copied. Send it to a friend.");}catch(e){toast("Send them to floor2rafters.com");}}

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
  if(voters)out.push([fmt(voters)+" FANS RANKING","soft"]);
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

})();
