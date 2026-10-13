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
    P[r.id]=p;if(p.active&&POOL[p.pos])POOL[p.pos].push(r.id);if(p.goat)gl.push(p);});
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

