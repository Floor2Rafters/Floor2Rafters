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
  return '<div class="stats"><span class="kicker">'+esc(seasonLabel())+'</span>'+rows.map(function(r){
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
