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
