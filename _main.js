
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
  h+='<div class="hrow"><span class="kicker'+(b&&b.sample?"":" blue")+'">'+(b&&b.sample?"Sample board · real one at launch":"Live · "+fmt(voters)+" fans ranking")+'</span>'+
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
    '<img class="logo" src="/brand/mark.svg" alt="" width="81" height="84"><h2 id="wl-t" class="hero">Rank the<br>league.</h2><p class="sub">Rank the NBA your way. The fans decide who\'s in the rafters, live.</p>'+
    '<ol class="how"><li><span class="num">1</span><span><b>Pick head to head</b><span class="t">Tap the player you\'d take.</span></span></li>'+
    '<li><span class="num">2</span><span><b>Rank every position</b><span class="t">A top 10 at PG, SG, SF, PF and C, plus the all‑time greats.</span></span></li>'+
    '<li><span class="num">3</span><span><b>Make your top 50</b><span class="t">Your overall list is your vote on the Fan Board.</span></span></li></ol>'+
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
