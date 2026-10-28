/* ---------- website front page, Settings, Feedback, rank history ---------- */

// Front page: what first-time visitors see at floor2rafters.com (and when they tap the logo).
function homeHTML(){
  ensureBoard("overall");var b=boards.overall,rows=b&&b.rows||[],voters=(b&&b.voters)||0;
  var top=rows.slice(0,5).map(function(r,i){var p=P[r.player_id];if(!p)return "";
    return '<button class="r tap" data-pid="'+r.player_id+'" style="--tc:'+tc(p)+'">'+ghost(r.rank)+'<span class="n t5">'+r.rank+'</span><span class="who"><span class="nm">'+esc(p.n)+'</span><span class="sc">'+POSL[p.pos]+' · '+fmt(r.points)+' pts'+(voters?' · '+Math.round(r.votes/voters*100)+'% of fans':'')+'</span></span>'+teamTag(p)+'</button>';}).join("");
  var board=rows.length?'<div class="list">'+top+'</div><div class="cut" aria-hidden="true"><span>▲ TOP 5</span></div><span class="note">'+(b.sample?"Sample board. The real one goes live at launch.":"Live · "+fmt(voters)+" fans ranking")+'</span>'
    :'<div class="empty"><b>No picks yet. Be the first.</b><br>The board goes live with the first fan\'s list.</div>';
  return '<div class="home">'+
    '<header class="hm-top"><img src="/brand/mark.svg" alt="F2R" class="hm-lockup"><nav class="hm-nav"><a href="#hm-board">Fan Board</a><a href="#hm-how">How it works</a>'+(user?'':'<button class="link" data-signin>Sign in</button>')+'<button class="btn sm" data-go-pick>Start ranking</button></nav></header>'+
    '<section class="hm-hero"><div class="hm-copy"><span class="kicker blue">Fan-voted NBA rankings</span><h1 class="hm-h1">Floor 2<br>Rafters.</h1>'+
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
