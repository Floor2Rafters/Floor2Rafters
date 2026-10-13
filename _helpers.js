/* ---------- brand helpers ---------- */
var TC={ATL:"#E03A3E",BOS:"#007A33",BKN:"#C9CBD0",CHA:"#00788C",CHI:"#CE1141",CLE:"#860038",DAL:"#00538C",DEN:"#FEC524",DET:"#C8102E",GSW:"#FFC72C",
  HOU:"#CE1141",IND:"#FDBB30",LAC:"#C8102E",LAL:"#552583",MEM:"#5D76A9",MIA:"#98002E",MIL:"#00471B",MIN:"#236192",NOP:"#85714D",NYK:"#F58426",
  OKC:"#EF3B24",ORL:"#0077C0",PHI:"#ED174C",PHX:"#E56020",POR:"#E03A3E",SAC:"#5A2D81",SAS:"#C4CED4",TOR:"#CE1141",UTA:"#6C3FA0",WAS:"#E31837"};
function tc(p){return TC[p&&p.t]||"#7C82A6";}
function bigPos(p){return p.pos==="pf"||p.pos==="c";}
function teamTag(p){return p.t?'<span class="tm">'+esc(p.t)+'</span>':'';}
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
