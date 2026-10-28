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
