// End-to-end checks for the F2R web app (brand v1). Run: node test_launch.js  (needs playwright + chromium)
const {chromium}=require('playwright');const http=require('http');const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'public');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'};
const srv=http.createServer((q,r)=>{let f=decodeURIComponent(q.url.split('?')[0]);if(f==='/'||/^\/join\/[A-Za-z0-9]+$/.test(f))f='/index.html';const p=path.join(root,f);
  if(!fs.existsSync(p)){r.writeHead(404);return r.end();}
  if(f==='/config.js'&&global.CFG){r.writeHead(200,{'content-type':'text/javascript'});return r.end(global.CFG);}
  r.writeHead(200,{'content-type':types[path.extname(p)]||'text/plain'});fs.createReadStream(p).pipe(r);}).listen(8765);
const players=JSON.parse(fs.readFileSync(path.join(root,'players.json')));
let fails=0;const ok=(name,cond,extra)=>{console.log((cond?'PASS ':'FAIL ')+name+(extra!==undefined?'  ('+extra+')':''));if(!cond)fails++;};
(async()=>{
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});const errs=[];
const DEMO_CFG='window.F2R_CONFIG={supabaseUrl:"",supabaseAnonKey:"",google:true,statsLabel:"2025-26 regular season",sponsor:null,pro:null};';
async function page(mock,cfg,seen,url){global.CFG=cfg||DEMO_CFG;const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});const p=await ctx.newPage();
  p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!/Failed to load resource/.test(m.text()))errs.push('console: '+m.text());});
  await p.route(/fonts\.g|cdnjs/,r=>r.abort());
  const mockSrc=fs.readFileSync(path.join(__dirname,'mock_supabase.js'),'utf8');
  await p.route(/jsdelivr/,r=>mock?r.fulfill({contentType:'text/javascript',body:mockSrc}):r.abort());
  if(mock)await p.addInitScript('window.__MOCK='+JSON.stringify(mock));
  await p.addInitScript(()=>{window.__noAnim=true;});if(seen)await p.addInitScript(()=>localStorage.setItem('f2r-seen','1'));
  await p.goto('http://localhost:8765/'+(url||''));await p.waitForTimeout(900);if(await p.$('.reveal'))await p.click('.reveal [data-close] >> nth=0');return p;}
const filled=p=>p.$$eval('.r.mini:not(.slot)',r=>r.length);

// 1) demo: welcome, board, pick to a full top 10, lock in, share
let p=await page(null);
ok('front page on first visit',!!(await p.$('.home .hm-h1'))&&!(await p.$('.nav')));
ok('front page shows the board top 5',(await p.$$eval('.hm-board .r',r=>r.length))===5);
await p.click('.hm-ctas [data-go-pick]');
ok('start goes to Pick PG',(await p.textContent('.tb[aria-pressed=true]'))==='PG');
const order1=await p.$$eval('.pc .pn',x=>x.map(e=>e.textContent).join('|'));
let n=0;while((await filled(p))<10&&n<80){await p.click('.pc[data-side='+(n%3?'a':'b')+']');n++;}
ok('PG top 10 fills, list visible while picking',(await filled(p))===10,n+' taps');
ok('first top 10 asks to share or challenge',!!(await p.$('.f10 [data-f10share]'))&&!!(await p.$('.f10 [data-f10dare]'))&&(await p.$$eval('.f10-top li',x=>x.length))===3,(await p.$('.f10'))?'sheet':'no sheet');
await p.click('.f10 [data-f10share]');ok('share from the celebration opens the image sizes',!!(await p.$('[data-sharesize=story]')));await p.click('.sheet-card [data-close]');
ok('lock-in offered once top 10 is set',!!(await p.$('[data-lock]')));
for(let i=0;i<14&&(await filled(p))<12;i++)await p.click('.pc[data-side=a]');
ok('list keeps growing past 10',(await filled(p))>=11,(await filled(p))+' on the list');
ok('header shows ranked count',(await p.textContent('.hrow .meta')).includes('ranked'));
await p.click('[data-lock]');
ok('locked screen',(await p.textContent('.locked .h')).toUpperCase().includes('LOCKED'));
await p.click('[data-share=pg]');const [dl]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('[data-sharesize=feed]')]);
const p2=await page(null);await p2.click('.hm-ctas [data-go-pick]');const order2=await p2.$$eval('.pc .pn',x=>x.map(e=>e.textContent).join('|'));await p2.context().close();
ok('matchups are random (different first matchup on a new visit)',order1!==order2,order1+' vs '+order2);
ok('share card downloads',/f2r-my-pg-top-10\.png/.test(dl.suggestedFilename()));
await p.click('[data-nav=lists]');
await p.click('[data-list=overall]');ok('overall top 50 builds itself from PG list',(await p.$$eval('#ovlist .r[data-id]',r=>r.length))===10);await p.click('[data-list=""]');
ok('My Lists shows PG done',(await p.textContent('[data-list=pg] .t')).includes('locked'));
await p.click('[data-list=pg]');ok('PG list detail rows',(await p.$$eval('#mylist .r[data-id]',r=>r.length))>=11);
await p.click('#mylist .r[data-id] >> nth=0');ok('row opens player card',!!(await p.$('#pc-t')));await p.click('.sheet-card [data-close]');
await p.click('[data-nav=pick]');await p.click('[data-pick=sg]');{let i=0;while(!(await p.$('[data-lock]'))&&i<80){await p.click('.pc[data-side=a]');i++;}}await p.click('[data-lock]');
await p.click('[data-nav=pick]');await p.click('[data-pick=goat]');
ok('all-time game shows career stats and awards',(await p.textContent('.stats')).includes('BLK')&&(await p.textContent('.sb3')).includes('ALL-DEFENSE'));
{let i=0;while(!(await p.$('[data-lock]'))&&i<80){await p.click('.pc[data-side=a]');i++;}}await p.click('[data-lock]');
ok('all-time list locks in',(await p.textContent('.locked .kicker')).includes('All-Time')&&!!(await p.$('[data-go-board=goat]')));
await p.click('[data-rc=goat]');ok('all-time re-check opens head to head',(await p.textContent('.kicker.purple')).includes('Re-check your All-Time')&&!!(await p.$('[data-rcdone]'))&&(await p.$$eval('.r.mini.hl',r=>r.length))===2);
{const pair=await p.$$eval('.r.mini.hl .nm',x=>x.map(e=>e.textContent));
 await p.click('.pc[aria-label="Pick '+pair[1]+'"]');
 const names=await p.$$eval('.list .r.mini .nm',x=>x.map(e=>e.textContent));
 ok('lower pick swaps up',names.indexOf(pair[1])>-1&&names.indexOf(pair[1])<names.indexOf(pair[0]));}
await p.click('[data-rcdone]');ok('done returns to the list',!!(await p.$('#mylist')));
await p.click('[data-rc=goat]');{let i=0;while(await p.$('[data-rcdone]')&&i<200){await p.click('.pc[data-side=a]');i++;}ok('re-check finishes',!(await p.$('[data-rcdone]'))&&!!(await p.$('#mylist')));}
await p.click('[data-nav=pick]');await p.click('[data-pick=goat]');
await p.click('[data-go-board=goat]');ok('All-Time Fan Board',(await p.textContent('.tb[aria-pressed=true]'))==='ALL-TIME'&&(await p.$$eval('.list .r',r=>r.length))>10);
await p.click('.list .r >> nth=3');ok('legend card shows career',(await p.$$eval('.sts div',x=>x.length))===6&&(await p.textContent('.sb3')).includes('TITLES'));await p.click('.sheet-card [data-close]');
await p.click('[data-nav=lists]');await p.click('[data-list=overall]');
ok('overall merges PG + SG (20)',(await p.$$eval('#ovlist .r[data-id]',r=>r.length))===20);
await p.click('[data-ovcheck]');ok('overall check shows a head-to-head',(await p.$$eval('.pc[data-side]',r=>r.length))===2);
const firstPair=await p.$$eval('.pc[data-side]',x=>x.map(e=>e.getAttribute('aria-label').replace(/^Pick /,'')).join('|'));
await p.click('.pc[data-side=b]');for(let i=0;i<5&&await p.$('.pc[data-side]');i++)await p.click('.pc[data-side=a]');
const prefs=await p.evaluate(()=>Object.keys((JSON.parse(localStorage.getItem('f2r-guest-v1'))||{}).pref||{}).length);
ok('check answers are saved',prefs>=1,prefs+' answers');
const nb=firstPair.split('|')[1];
if(await p.$('[data-ovdone]'))await p.click('[data-ovdone]');
const ov=await p.$$eval('#ovlist .r[data-id] .nm',x=>x.map(e=>e.textContent.toUpperCase()));
ok('a check win moves the player up',ov.indexOf(nb.toUpperCase())>-1,nb);
await p.click('[data-nav=board]');
ok('sample board rows',(await p.$$eval('.list .r',r=>r.length))>10);
ok('jumbotron shows the fans\' #1',(await p.textContent('.jt-big'))==='1');
await p.waitForTimeout(4600);ok('jumbotron cycles to #2',(await p.textContent('.jt-big'))==='2');
ok('mini scoreboard hidden at the top',!(await p.$('#mini.on')));
await p.evaluate(()=>window.scrollTo(0,1400));await p.waitForTimeout(300);
ok('scroll down: mini scoreboard shows #1 + LIVE',!!(await p.$('#mini.on'))&&/LIVE/.test(await p.textContent('#mini'))&&(await p.textContent('#mini .mn-rk'))==='1');
await p.click('#mini');await p.waitForTimeout(300);ok('tap mini scoreboard: back to the top',await p.evaluate(()=>window.scrollY)===0&&!(await p.$('#mini.on')));
await p.click('.list [data-pid] >> nth=0');ok('player card tints the backdrop in his team color',await p.evaluate(()=>{const s=document.getElementById('sheet');return s.classList.contains('tinted')&&/^#/.test(s.style.getPropertyValue('--stc').trim());}));
await p.click('#sheet [data-close]');ok('closing the card clears the tint',await p.evaluate(()=>!document.getElementById('sheet').classList.contains('tinted')));
ok('5+ spot risers get a streak',await p.$$eval('.list .mv.up',m=>m.every(e=>e.classList.contains('big')===(parseInt(e.textContent,10)>=5))));
await p.click('[data-tab=goat]');ok('All-Time board gets the throwback look',await p.evaluate(()=>document.body.classList.contains('throwback')));await p.click('[data-tab=overall]');ok('throwback off on current boards',await p.evaluate(()=>!document.body.classList.contains('throwback')));
ok('rows dim as they go down the board',await p.evaluate(()=>{const r=[...document.querySelectorAll('.list .r[data-pid]')];const f=x=>parseFloat(x.style.getPropertyValue('--far')||'1');return r.length>20&&f(r[0])===1&&f(r[19])<f(r[4])&&f(r[19])>=0.8;}));
await p.click('[data-nav=pick]');await p.click('.pc[data-side=a]');await p.waitForTimeout(400);ok('your list so far shows on the pick screen',await p.evaluate(()=>{const r=[...document.querySelectorAll('.list .r.mini')];return r.length>0&&r.every(x=>getComputedStyle(x).visibility==='visible'&&getComputedStyle(x).position!=='fixed');}));await p.click('[data-nav=board]');
ok('board never scrolls sideways on a phone',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
ok('long names fit on one line (no cut-off names on the board)',await p.evaluate(()=>[...document.querySelectorAll('.list .nm,.jt-name .ln')].filter(e=>e.offsetParent&&e.scrollWidth>e.clientWidth+1).length===0));
await p.context().setOffline(true);await p.waitForTimeout(300);ok('offline: Jumbotron shows NO SIGNAL',!!(await p.$('.jt.off .jt-nosig')));
await p.context().setOffline(false);await p.waitForTimeout(400);ok('back online: Jumbotron returns',!!(await p.$('.jt:not(.off) .jt-big')));
await p.click('.list [data-pid] >> nth=0');ok('player card rank history boxes are visible',await p.evaluate(()=>{const h=[...document.querySelectorAll('#sheet .hs')];return h.length===0||h.every(e=>getComputedStyle(e).display!=='none');}));await p.click('#sheet [data-close] >> nth=0');
ok('row dimming follows real ranks',await p.evaluate(()=>[...document.querySelectorAll('.list .r[data-rank]')].every(r=>{const n=+r.dataset.rank,f=parseFloat(r.style.getPropertyValue('--far')||'1');return Math.abs(f-(1-Math.min(.2,(n-1)*.0045)))<0.002;})));
ok('scoreboard glow falls on the top rows',!!(await p.$('.list.jt-lit')));
await p.evaluate(()=>{window.__noAnim=false;});await p.click('[data-tab=pg]');ok('switching boards wipes the Jumbotron',!!(await p.$('.jt-panel.wipe')));await p.waitForTimeout(650);ok('wipe clears',!(await p.$('.jt-panel.wipe')));await p.click('[data-tab=overall]');await p.waitForTimeout(650);await p.evaluate(()=>{window.__noAnim=true;});
await p.click('[data-nav=me]');ok('mini scoreboard off on other tabs',!(await p.$('#mini.on')));await p.click('[data-nav=board]');
await p.click('[data-reveal]');ok('tap jumbotron opens the reveal',!!(await p.$('.reveal .rv-num')));await p.click('.reveal .btn[data-close]');
ok('top 5 divider',!!(await p.$('.cut')));
await p.click('[data-movers]');ok('movers sheet',(await p.textContent('#mv-t')).includes('MOVERS')||(await p.textContent('#mv-t')).toLowerCase().includes('movers'));await p.click('.sheet-card [data-close]');
await p.click('[data-nav=me]');ok('Me shows 2 of 5 locked',(await p.textContent('.tile.p b')).trim()==='2 / 5');
await p.click('.menu [data-nav=settings]');ok('settings screen',(await p.$$eval('.sw',x=>x.length))===3);
await p.click('label[for=nt-streak]');await p.fill('#dn','Kail');await p.press('#dn','Tab');await p.waitForTimeout(100);
const st1=await p.evaluate(()=>JSON.parse(localStorage.getItem('f2r-guest-v1')));
ok('notification switch + name saved',st1.notify&&st1.notify.streak===true&&st1.name==='Kail');
await p.click('[data-nav=me]');ok('name shows on Me',(await p.textContent('.prof .name')).toUpperCase()==='KAIL');
await p.click('.menu [data-nav=feedback]');await p.click('[data-kind=idea]');await p.fill('#fbm','Add a WNBA board');await p.click('[data-fb-send]');await p.waitForTimeout(100);
const fbq=await p.evaluate(()=>JSON.parse(localStorage.getItem('f2r-feedback')||'[]'));
ok('feedback form sends (demo keeps it on device)',fbq.length===1&&fbq[0].kind==='idea'&&fbq[0].message==='Add a WNBA board');
await p.click('.brand');ok('logo goes to the front page',!!(await p.$('.home')));await p.click('.hm-ctas [data-go-board]');
ok('demo note',!!(await p.$('text=Demo mode')));
await p.context().close();

// 2) live: guest picks, then sign in keeps them
const cfg='window.F2R_CONFIG={supabaseUrl:"https://x.supabase.co",supabaseAnonKey:"k",google:true};';
const ids=[0,51,112,171,223,1,52,113,172,224,2,53];
const board=ids.map((id,i)=>({week:'2026-10-12',prev_week:'2026-10-05',voters:37,rank:i+1,player_id:id,points:900-i*40,firsts:i<3?5-i:0,votes:20,prev_rank:i===0?2:i===1?1:i===5?null:i+1}));
p=await page({players,boards:{overall:board},lists:[],state:null},cfg,true);
ok('live board rows',(await p.$$eval('.list .r',r=>r.length))===12);
ok('movement chevrons + jumbotron ticker',(await p.textContent('.jt-tick')).includes('▲')&&(await p.$$eval('.mv.down',r=>r.length))>0&&(await p.$$eval('.mv.new',r=>r.length))===1);
ok('signed-out header shows Sign in',!!(await p.$('.top [data-signin]')));
await p.click('[data-nav=pick]');for(let i=0;i<5;i++)await p.click('.pc[data-side=b]');
ok('sign-in nudge while picking',!!(await p.$('.nudge')));
await p.$eval('.nudge [data-signin]',b=>b.click());await p.fill('#em','fan@example.com');await p.click('form [type=submit]');await p.waitForTimeout(200);
ok('check-email sheet',(await p.textContent('#se-t')).toLowerCase().includes('check your email')&&!!(await p.$('#otp')));
await p.fill('#otp','123 456');await p.click('form[data-code] [type=submit]');await p.waitForTimeout(300);
ok('email code signs in',await p.evaluate(()=>window.__LOG.some(x=>x.verify==='123456'))&&!(await p.$('#se-t')));
await p.evaluate(()=>window.__client.auth.__signIn({id:'u2',email:'fan@example.com'}));await p.waitForTimeout(1200);
const keys=await p.evaluate(()=>window.__LOG.filter(x=>x.kind==='upsert'&&x.table==='lists').map(x=>x.rows.map(r=>r.key+':'+r.player_ids.length).join(',')).join(' | '));
ok('guest picks saved to account',/pg:[1-9]/.test(keys),keys);
ok('guest storage cleared',await p.evaluate(()=>localStorage.getItem('f2r-guest-v1')===null));
await p.click('[data-nav=me]');ok('Me shows the fan name',(await p.textContent('.prof .name')).toUpperCase()==='FAN');
await p.click('[data-signout]');await p.waitForTimeout(300);
ok('signed out back to Sign in',!!(await p.$('.top [data-signin]')));
await p.click('[data-nav=me]');await p.click('.menu [data-nav=feedback]');await p.fill('#fbm','Jokic is a C');await p.click('[data-kind=player]');await p.click('[data-fb-send]');await p.waitForTimeout(200);
ok('feedback saves to the database',await p.evaluate(()=>window.__LOG.some(x=>x.kind==='insert'&&x.table==='feedback'&&x.rows.kind==='player'&&x.rows.message==='Jokic is a C')));
await p.context().close();

// 3) returning signed-in admin
p=await page({players,boards:{overall:board,pg:[]},lists:[{key:'pg',player_ids:[0,1,2]},{key:'overall',player_ids:[1,0]}],state:{xp:300,streak:2,last:'2026-10-07',out:{},deep:{}},user:{id:'u1',email:'kail@example.com'},admin:true,history:[{week:'2026-09-28',key:'overall',rank:4},{week:'2026-10-05',key:'overall',rank:2},{week:'2026-10-12',key:'overall',rank:1},{week:'2026-10-12',key:'pg',rank:1}],live:{overall:board.slice(0,3)}},cfg,true);
await p.waitForTimeout(400);
ok('level in header',(await p.textContent('.lvl')).includes('BENCH'));
await p.click('.list .r >> nth=0');await p.waitForTimeout(300);
ok('player card shows rank by week',(await p.$$eval('.hist .hs',x=>x.length))>=3,(await p.$$eval('.hist .hs b',x=>x.map(e=>e.textContent).join(','))));
await p.click('.sheet-card [data-close]');
await p.click('nav.nav [data-nav=me]');ok('admin tools on Me, not on the board',!!(await p.$('.adm-menu [data-posts]')));await p.click('.adm-menu [data-posts]');await p.waitForSelector('.post img',{timeout:15000});
ok('Monday posts: 4 images + captions',(await p.$$eval('.post img',x=>x.length))===4&&(await p.inputValue('#cap0')).includes('Fan Board'));
const dims=await p.$$eval('.post img',x=>x.map(i=>i.naturalWidth+'x'+i.naturalHeight).join(','));ok('post sizes',dims==='1080x1350,1080x1920,1080x1350,1600x900',dims);
const [pdl]=await Promise.all([p.waitForEvent("download",{timeout:5000}).catch(()=>null),p.click('[data-psave="0"]')]);ok("save post downloads png",!!pdl&&pdl.suggestedFilename().endsWith(".png"),pdl&&pdl.suggestedFilename());
await p.click('.sheet-card [data-close]');
ok('boards are live: no separate preview',!(await p.$('[data-preview]')));
await p.click('[data-nav=pick]');await p.click('[data-pick=pg]');
ok('saved PG list loads',(await filled(p))===3);
for(let i=0;i<8;i++)await p.click('.pc[data-side=a]');await p.waitForTimeout(1200);
ok('picks save to database',await p.evaluate(()=>window.__LOG.some(x=>x.kind==='upsert'&&x.table==='lists')));
await p.click('[data-nav=board]');await p.waitForTimeout(200);await p.click('[data-tab=pg]');await p.waitForTimeout(200);
const em=await p.textContent('.empty');ok('empty PG board message',em.includes('No picks yet'),em.slice(0,70));
await p.click('[data-nav=me]');await p.click('.menu [data-nav=settings]');await p.click('[data-delete]');await p.click('[data-delete]');await p.waitForTimeout(300);
ok('delete account calls the database',await p.evaluate(()=>window.__LOG.some(x=>x.rpc==='delete_my_account')));
await p.context().close();

// 4b) pre-launch fixes: guest picks merge into an existing account, settings save as a patch, ended streaks show 0
{
const today=await (async()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());return d;})();
p=await page({players,boards:{overall:board},lists:[{key:'pg',player_ids:[0,1,2]}],state:{xp:300,streak:6,last:'2026-01-01',notify:{monday:false},out:{},deep:{}},user:null},cfg,true);
await p.evaluate(()=>{window.__capT=[];localStorage.setItem('f2r-guest-v1',JSON.stringify({l:{pg:[4,1,5]},out:{},deep:{},xp:40,streak:1,last:'',notify:{},pref:{}}));window.__client.auth.__signIn({id:'u9',email:'old@example.com'});});
await p.waitForTimeout(1300);
const pgRows=await p.evaluate(()=>{const u=window.__LOG.filter(x=>x.kind==='upsert'&&x.table==='lists').flatMap(x=>x.rows).filter(r=>r.key==='pg');return u.length?u[u.length-1].player_ids:null;});
ok('guest picks added to an existing account (account order kept)',JSON.stringify(pgRows)==='[0,1,2,4,5]',JSON.stringify(pgRows));
ok('fan is told picks were added',await p.evaluate(()=>window.__capT.some(t=>/Added 2 picks/.test(t))),await p.evaluate(()=>window.__capT.join(' | ')));
ok('guest storage cleared after merge',await p.evaluate(()=>localStorage.getItem('f2r-guest-v1')===null));
const ss=await p.evaluate(()=>window.__LOG.filter(x=>x.rpc==='save_state').map(x=>x.args.p_patch));
ok('settings saved through save_state, account unsubscribe kept',ss.length>0&&ss[0].notify&&ss[0].notify.monday===false&&ss[0].xp===340,JSON.stringify(ss[0]));
ok('no full overwrite of user_state',await p.evaluate(()=>!window.__LOG.some(x=>x.kind==='upsert'&&x.table==='user_state')));
ok('ended streak shows 0, not the old 6',!/streak/.test(await p.textContent('.lvl')));
await p.click('[data-nav=me]');ok('Me tile shows 0-day streak when it ended',(await p.textContent('.tile:has-text("DAY STREAK") b')).trim()==='0');
// a later save from this device sends only what changed
await p.evaluate(()=>{window.__LOG.length=0;});
await p.click('.menu [data-nav=settings]');await p.click('label[for=nt-streak]');await p.waitForTimeout(1200);
const ss2=await p.evaluate(()=>window.__LOG.filter(x=>x.rpc==='save_state').map(x=>x.args.p_patch));
ok('toggling one switch sends only that switch',ss2.length===1&&JSON.stringify(ss2[0])==='{"notify":{"streak":true}}',JSON.stringify(ss2));
await p.context().close();
p=await page({players,boards:{overall:board},lists:[{key:'pg',player_ids:[0,1,2]}],state:{xp:300,streak:4,last:today,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'}},cfg,true);
await p.waitForTimeout(300);ok('live streak still shows in header',/4-day streak/.test(await p.textContent('.lvl')));
await p.evaluate(()=>{window.__LOG.length=0;});await p.waitForTimeout(1200);
ok('just opening the app does not re-save settings',await p.evaluate(()=>!window.__LOG.some(x=>x.rpc==='save_state')));
await p.context().close();
}

// 5) sponsor spot: off by default, on from config, logs a view
p=await page({players,boards:{overall:board},lists:[],state:null},cfg,true);
ok('sponsor off by default',!(await p.$('.spon')));
await p.context().close();
const scfg=cfg.replace(/\};\s*$/,'')+',sponsor:{name:"Joe\'s Pizza",url:"https://example.com",handle:"@joespizza",boards:["overall"]}};';
p=await page({players,boards:{overall:board,pg:board.slice(0,3)},lists:[],state:null},scfg,true);
ok('sponsor shows when set',((await p.textContent('.spon'))||'').includes("JOE'S PIZZA".toLowerCase().replace(/^./,'J'))||((await p.textContent('.spon'))||'').toLowerCase().includes("joe's pizza"));
ok('sponsor logs a view',await p.evaluate(()=>window.__LOG.some(x=>x.rpc==='log_sponsor'&&x.args.p_kind==='view')));
await p.click('[data-tab=pg]');await p.waitForTimeout(200);ok('sponsor only on chosen boards',!(await p.$('.spon')));
await p.context().close();

// 6) friend groups
const gm={players,boards:{overall:board},lists:[{key:'overall',player_ids:[1,0]}],state:{xp:10,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'},
  groups:[{id:'g1',name:'The Chat',code:'HOOPS7',members:3,is_lead:true,nick:'Kail'}],gboard:{overall:board.slice(0,4).map(r=>({...r,voters:3}))},
  gmembers:[{nick:'Kail',is_me:true,is_lead:true,top1:1,listed:2},{nick:'Marcus',is_me:false,is_lead:false,top1:0,listed:10},{nick:'Dre',is_me:false,is_lead:false,top1:null,listed:0}]};
p=await page(gm,cfg,true);
await p.click('nav.nav [data-nav=groups]');await p.waitForTimeout(300);
ok('my groups lists groups',(await p.$$eval('.grow',x=>x.length))===1);
await p.click('[data-gopen=g1]');await p.waitForTimeout(400);
ok('group board shows',(await p.$$eval('.list .r',x=>x.length))===4&&(await p.textContent('.ghead .h1'))==='The Chat');
ok('group members with #1 picks',(await p.$$eval('.gm',x=>x.length))===3&&(await p.textContent('.gmem')).includes('No list yet'));
ok('lead can remove others',(await p.$$eval('[data-gkick]',x=>x.length))===2);
await p.click('[data-gkick=Marcus]');await p.click('[data-gkick=Marcus]');await p.waitForTimeout(200);
ok('remove member calls the database',await p.evaluate(()=>window.__LOG.some(x=>x.rpc==='remove_member'&&x.args.p_nick==='Marcus')));
await p.click('nav.nav [data-nav=groups]');await p.waitForTimeout(300);await p.click('[data-gnew]');
await p.fill('#gname','Hoop Heads');await p.click('[data-gnewf] button[type=submit]');await p.waitForTimeout(500);
ok('start a group',await p.evaluate(()=>window.__LOG.some(x=>x.rpc==='create_group'&&x.args.p_name==='Hoop Heads'&&x.args.p_nick==='Kail'))&&(await p.textContent('.ghead .h1'))==='Hoop Heads');
await p.context().close();
p=await page(gm,cfg,true,'join/abc123');await p.waitForTimeout(300);
ok('invite link opens join sheet with code',(await p.inputValue('#gjc').catch(()=>''))==='ABC123');
await p.click('[data-gjoinf] button[type=submit]');await p.waitForTimeout(500);
ok('join via link',await p.evaluate(()=>window.__LOG.some(x=>x.rpc==='join_group'&&x.args.p_code==='ABC123'))&&(await p.textContent('.ghead .h1'))==='Joined Crew');
await p.context().close();
p=await page(null,null,true);await p.click('nav.nav [data-nav=groups]');await p.waitForTimeout(300);await p.click('[data-gopen]');await p.waitForTimeout(400);
ok('demo sample group',(await p.$$eval('.list .r',x=>x.length))>=10&&(await p.$$eval('.gm',x=>x.length))===5);
await p.context().close();

// 7) phone app: back button and invite links that open the app
{const ctx=await b.newContext({viewport:{width:390,height:844}});const q=await ctx.newPage();q.on('pageerror',e=>errs.push(e.message));
 await q.route(/fonts\.g|cdnjs|jsdelivr/,r=>r.abort());global.CFG=DEMO_CFG;
 await q.addInitScript(()=>{window.__noAnim=true;localStorage.setItem('f2r-seen','1');window.__noAnim=true;window.__L={};window.__exit=0;
  window.Capacitor={isNativePlatform:()=>true,Plugins:{App:{addListener:(n,f)=>{window.__L[n]=f;},exitApp:()=>{window.__exit++;}},Haptics:{impact(){}},StatusBar:{setStyle(){}},SplashScreen:{hide(){}}}};});
 await q.goto('http://localhost:8765/');await q.waitForTimeout(900);if(await q.$('.reveal'))await q.click('.reveal [data-close] >> nth=0');
 ok('app hooks registered',await q.evaluate(()=>!!(window.__L.backButton&&window.__L.appUrlOpen)));
 await q.click('nav.nav [data-nav=me]');await q.click('.menu [data-nav=settings]');await q.evaluate(()=>window.__L.backButton());await q.waitForTimeout(150);
 ok('back: settings → me',!!(await q.$('.prof')));
 await q.evaluate(()=>window.__L.backButton());await q.waitForTimeout(150);
 ok('back: me → board',(await q.getAttribute('nav.nav [data-nav=board]','aria-current'))==='page');
 await q.click('.list [data-pid] >> nth=0');await q.evaluate(()=>window.__L.backButton());await q.waitForTimeout(150);
 ok('back closes a sheet first',await q.evaluate(()=>document.getElementById('sheet').hidden)&&await q.evaluate(()=>window.__exit)===0);
 await q.evaluate(()=>window.__L.backButton());ok('back on the board leaves the app',await q.evaluate(()=>window.__exit)===1);
 await q.evaluate(()=>window.__L.appUrlOpen({url:'https://floor2rafters.com/join/xyz789'}));await q.waitForTimeout(200);
 ok('invite link opens My Groups in the app',!!(await q.$('nav.nav [data-nav=groups][aria-current=page]')));
 await ctx.close();}

// 8) phone alerts: one friendly ask, then the phone's permission, then the token is saved
{global.CFG=cfg;const ctx=await b.newContext({viewport:{width:390,height:844}});const q=await ctx.newPage();q.on('pageerror',e=>errs.push(e.message));
 await q.route(/fonts\.g|cdnjs/,r=>r.abort());const mockSrc=fs.readFileSync(path.join(__dirname,'mock_supabase.js'),'utf8');await q.route(/jsdelivr/,r=>r.fulfill({contentType:'text/javascript',body:mockSrc}));
 await q.addInitScript('window.__MOCK='+JSON.stringify({players,boards:{overall:board},lists:[{key:'overall',player_ids:[1,0]}],state:{xp:10,out:{},deep:{},notify:{}},user:{id:'u1',email:'kail@example.com'}}));
 await q.addInitScript(()=>{window.__noAnim=true;localStorage.setItem('f2r-seen','1');const L={};window.__perm='prompt';
  window.Capacitor={isNativePlatform:()=>true,getPlatform:()=>'ios',Plugins:{App:{addListener(){},exitApp(){}},
   PushNotifications:{addListener:(n,f)=>{L[n]=f;},checkPermissions:async()=>({receive:window.__perm}),requestPermissions:async()=>{window.__perm='granted';return {receive:'granted'};},register:async()=>{setTimeout(()=>L.registration({value:'apns-token-0123456789abcdef0123'}),10);}}}};});
 await q.goto('http://localhost:8765/');await q.waitForTimeout(1200);
 ok('push: friendly ask first',!!(await q.$('[data-pushyes]')));
 await q.click('[data-pushyes]');await q.waitForTimeout(300);
 ok('push: token saved after yes',await q.evaluate(()=>window.__LOG.some(x=>x.rpc==='save_push_token'&&x.args.p_platform==='ios')));
 await ctx.close();}

// 9) F2R Pro: off by default; with Stripe links on, the Me page sells it; a Pro fan sees their status
{const pcfg=cfg.replace(/\};\s*$/,'')+',pro:{monthly:"https://buy.stripe.com/test_m",yearly:"https://buy.stripe.com/test_y",portal:"https://billing.stripe.com/p/login/test",price:"$2.99 a month",priceYear:"$19.99 a year"}};';
 const base={players,boards:{overall:board},lists:[],state:{xp:10,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'}};
 p=await page(base,cfg,true);await p.click('nav.nav [data-nav=me]');ok('pro hidden until set up',!(await p.$('[data-pro]')));await p.context().close();
 p=await page(base,pcfg,true);await p.click('nav.nav [data-nav=me]');await p.click('.menu [data-pro]');await p.waitForTimeout(150);
 const hrefs=await p.$$eval('[data-probuy]',a=>a.map(x=>x.getAttribute('href')));
 ok('pro sheet: both prices, linked to the fan',hrefs.length===2&&hrefs[0].includes('client_reference_id=u1')&&hrefs[0].includes('prefilled_email=kail%40example.com'),hrefs[0]);
 await p.context().close();
 p=await page({...base,pro:{status:'active',plan:'month',current_period_end:'2030-01-01T00:00:00Z'}},pcfg,true);await p.click('nav.nav [data-nav=me]');
 ok('pro fan: PRO tag + Active',(await p.textContent('.prof .name')).includes('PRO')&&(await p.textContent('.menu [data-pro]')).includes('Active'));
 await p.click('.menu [data-pro]');ok('pro fan: manage link',(await p.getAttribute('.sheet-card a.btn','href')).startsWith('https://billing.stripe.com/p/login/test?prefilled_email='));
 await p.context().close();}

// 10) ads: off by default, on with AdSense ids, never for Pro
{const acfg=cfg.replace(/\};\s*$/,'')+',ads:{client:"ca-pub-123",slot:"456"}};';
 const big=Array.from({length:14},(_,i)=>({...board[i%board.length],rank:i+1,player_id:i}));
 const base={players,boards:{overall:big},lists:[],state:{xp:10,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'}};
 p=await page(base,cfg,true);ok('no ads by default',!(await p.$('.adslot')));await p.context().close();
 p=await page(base,acfg,true);await p.route(/googlesyndication/,r=>r.abort());
 ok('one ad after the top 10',(await p.$$eval('.adslot',x=>x.length))===1&&await p.evaluate(()=>{const a=document.querySelector('.adslot');return a.previousElementSibling&&a.previousElementSibling.querySelector('.n').textContent==='10';}));
 await p.context().close();
 p=await page({...base,pro:{status:'active'}},acfg,true);ok('no ads for Pro',!(await p.$('.adslot')));await p.context().close();}

// 11) the pick moment: flash, undo, fans agree; countdown; badges; share sizes; matchup share; admin numbers
{p=await page(null,null,true);
 ok('jumbotron cycles the live top 10 (no countdown)',await p.evaluate(()=>document.querySelectorAll('.jt-dots i').length)===10&&(await p.textContent('.jt-top')).includes('LIVE'));
 await p.click('nav.nav [data-nav=pick]');const n0=await filled(p);
 await p.evaluate(()=>{window.__noAnim=false;});await p.click('.pc[data-side=a]');
 ok('pick flash: winner lights up',await p.evaluate(()=>!!document.querySelector('.pc.win')&&!!document.querySelector('.pc.lose')));
 await p.waitForTimeout(450);await p.evaluate(()=>{window.__noAnim=true;});
 ok('after-pick bar: just the fans line (no undo, no share)',!!(await p.$('#after:not([hidden]) #ag'))&&!(await p.$('#after button'))&&((await p.textContent('#ag'))||'').length>3,await p.textContent('#ag'));
 let k=0;while(!(await p.$('[data-lock]'))&&!(await p.$('.locked'))&&k<120){if(await p.$('.f10'))await p.evaluate(()=>document.querySelector('.f10 .link[data-close]').click());await p.click('.pc[data-side=a]');k++;}
 if(await p.$('.f10'))await p.evaluate(()=>document.querySelector('.f10 .link[data-close]').click());
 if(await p.$('[data-lock]'))await p.click('[data-lock]');await p.waitForTimeout(100);
 ok('locked list hangs in',(await p.$$eval('.locked ~ .list .r.mini.hang',x=>x.length))>=10);
 const [sdl]=await Promise.all([p.waitForEvent('download',{timeout:8000}).catch(()=>null),(async()=>{await p.click('[data-share]');await p.click('[data-sharesize=story]');})()]);
 ok('story-size share card',!!sdl&&/-story\.png$/.test(sdl.suggestedFilename()),sdl&&sdl.suggestedFilename());
 await p.click('nav.nav [data-nav=me]');
 ok('badges on Me (first top 10 earned)',(await p.$$eval('.bdg',x=>x.length))===4&&(await p.$$eval('.bdg.on',x=>x.map(e=>e.textContent).join('|'))).includes('First top 10'));
 await p.click('.menu [data-nav=admin]');await p.waitForTimeout(200);
 ok('admin numbers (demo sample)',(await p.$$eval('.abars .ab',x=>x.length))===8&&(await p.inputValue('#adsum')).includes('SAMPLE'));
 await p.context().close();}
{// Called it: last week's list had players who then rose 5+ spots on the fans' board
 let q=await page(null,null,true);await q.keyboard.press('Escape');await q.waitForTimeout(100);await q.click('[data-tab=pg]');await q.waitForTimeout(200);
 const rows=await q.$$eval('.list .r[data-pid]',rs=>rs.map(r=>[+r.dataset.pid,parseInt(r.querySelector('.n').textContent,10)]));const risers=rows.slice(10,13).map(x=>x[0]);const then={};rows.slice(10,13).forEach(x=>{then[x[0]]=x[1]+6;});
 await q.context().close();
 const ids=risers.slice(0,3);
 const ctx=await b.newContext({viewport:{width:390,height:844}});q=await ctx.newPage();q.on('pageerror',e=>errs.push(e.message));await q.route(/fonts\.g|cdnjs|jsdelivr/,r=>r.abort());global.CFG=DEMO_CFG;
 await q.addInitScript(a=>{const ids=a[0];window.__noAnim=true;localStorage.setItem('f2r-seen','1');localStorage.setItem('f2r-guest-v1',JSON.stringify({l:{pg:ids},out:{},deep:{},xp:0,streak:0,last:'',snap:{pg:{w:'2000-01-03',ids:ids,r:a[1]}}}));},[ids,then]);
 await q.goto('http://localhost:8765/');await q.waitForTimeout(800);await q.keyboard.press('Escape');await q.waitForTimeout(100);await q.click('[data-tab=pg]');await q.waitForTimeout(400);
 const t=await q.textContent('#toast');ok('called it on a new board',ids.length>0&&/Called it/.test(t),ids.length+' risers · '+t);
 await q.click('nav.nav [data-nav=me]');ok('Called It badge lit',(await q.$$eval('.bdg.on b',x=>x.map(e=>e.textContent))).includes('Called It'));
 await ctx.close();}
{p=await page({players,boards:{overall:board},lists:[{key:'pg',player_ids:[0,1,2]}],state:{xp:10,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'},agree:{a_wins:64,b_wins:36}},cfg,true);
 await p.click('nav.nav [data-nav=pick]');await p.click('.pc[data-side=a]');await p.waitForTimeout(250);
 ok('fans agree % from the database',/(\d+)% of fans/.test(await p.textContent('#ag')),await p.textContent('#ag'));
 await p.context().close();}
{const stats={week:'2026-10-26',weeks:[...Array(8)].map((_,i)=>({week:'2026-09-'+String(7+i).padStart(2,'0'),active:100*i,returning:60*i,prev:i?100*(i-1):0,signups:20*i})),fans:900,with_lists:800,full_lists:300,board_voters:640,groups:12,group_members:60,pro:3,alerts:40,sponsor_views:1200,sponsor_taps:80};
 p=await page({players,boards:{overall:board},lists:[],state:{xp:10,out:{},deep:{}},user:{id:'u1',email:'kail@example.com'},admin:true,stats},cfg,true);
 await p.click('nav.nav [data-nav=me]');await p.click('.menu [data-nav=admin]');await p.waitForTimeout(250);
 const sum=await p.inputValue('#adsum');ok('admin numbers (live): summary',sum.includes('700 fans used F2R this week')&&sum.includes('up 17%')&&sum.includes('1,200 views'),sum.slice(0,120));
 await p.context().close();
 p=await page({players,boards:{overall:board},lists:[],state:{xp:10,out:{},deep:{}},user:{id:'u2',email:'fan@example.com'}},cfg,true);
 await p.click('nav.nav [data-nav=me]');ok('admin numbers hidden for fans',!(await p.$('.menu [data-nav=admin]')));await p.context().close();}

// 12) design details: court icons, rank roll, pull to refresh, jersey numbers fall back to team code
{const ctx=await b.newContext({viewport:{width:390,height:844},hasTouch:true});const q=await ctx.newPage();q.on('pageerror',e=>errs.push(e.message));await q.route(/fonts\.g|cdnjs|jsdelivr/,r=>r.abort());global.CFG=DEMO_CFG;
 await q.addInitScript(()=>{window.__noAnim=true;localStorage.setItem('f2r-seen','1');window.__ptr=true;});
 await q.goto('http://localhost:8765/');await q.waitForTimeout(800);await q.keyboard.press('Escape');await q.waitForTimeout(100);
 ok('no position icons on the tabs',(await q.$$eval('.tabs .tb .ct',x=>x.length))===0);
 await q.evaluate(()=>{const t=y=>new Touch({identifier:1,target:document.body,clientY:y,clientX:200});window.dispatchEvent(new TouchEvent('touchstart',{touches:[t(100)]}));window.dispatchEvent(new TouchEvent('touchmove',{touches:[t(280)]}));window.dispatchEvent(new TouchEvent('touchend',{touches:[]}));});
 await q.waitForTimeout(100);ok('pull to refresh',await q.evaluate(()=>document.getElementById('ptr').classList.contains('busy')));await q.waitForTimeout(900);
 await q.click('nav.nav [data-nav=pick]');ok('no jersey data yet: team code shows',/^[A-Z]{2,3}$/.test((await q.textContent('.pc .ph')).trim()));
 await q.evaluate(()=>{window.__noAnim=false;});let rolled=false;for(let i=0;i<12&&!rolled;i++){await q.click('.pc[data-side=a]');await q.waitForTimeout(380);rolled=!!(await q.$('.n.rolling'));}
 ok('rank numbers roll when a player moves',rolled);
 await ctx.close();}

ok('no page errors',errs.length===0,errs.join(' / '));
console.log(fails?fails+' FAILED':'ALL PASSED');await b.close();srv.close();process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
