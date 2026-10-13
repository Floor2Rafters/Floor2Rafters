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
