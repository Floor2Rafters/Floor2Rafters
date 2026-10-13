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
function showAfter(key,winner,loser,msg){var el=afterEl(),w=P[winner];if(!w)return;
  el.innerHTML='<span class="ag" id="ag">'+(msg?'<span class="res">'+esc(msg)+'</span>':'')+'<span id="ag2">'+(msg?'':esc(lnm(w.n))+' it is.')+'</span></span>';
  el.hidden=false;document.body.classList.add("has-after");
  clearTimeout(afterT);afterT=setTimeout(hideAfter,4000);
  agreeText(key,winner,loser).then(function(t){var a=document.getElementById("ag2");if(t&&a&&!el.hidden)a.innerHTML=t;});}
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
