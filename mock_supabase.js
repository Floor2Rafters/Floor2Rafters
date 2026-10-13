// Fake supabase-js for tests. window.__MOCK controls state; calls are logged to window.__LOG.
(function(){
 var M=window.__MOCK||{};window.__LOG=[];
 function q(table){var op={table:table};var api={
   select:function(){op.kind="select";return api;}, maybeSingle:function(){op.single=true;return api;},
   eq:function(){return api;}, in:function(){return api;}, order:function(){return api;},
   insert:function(rows){op.kind="insert";op.rows=rows;window.__LOG.push(op);return Promise.resolve({error:null});},
   upsert:function(rows){op.kind="upsert";op.rows=rows;window.__LOG.push(op);return Promise.resolve({error:null});},
   then:function(res,rej){var d;
     if(table==="players")d=M.players;
     else if(table==="rankings")d=M.history||[];
     else if(table==="lists")d=M.lists||[];
     else if(table==="pro")d=op.single?(M.pro||null):[];
     else if(table==="user_state")d=op.single?(M.state?{data:M.state}:null):[];
     return Promise.resolve({data:d,error:null}).then(res,rej);}};return api;}
 var listeners=[];
 window.supabase={createClient:function(){return window.__client={
   from:q,
   rpc:function(name,args){window.__LOG.push({rpc:name,args:args});
     if(name==="get_board")return Promise.resolve({data:(M.boards||{})[args.p_key]||[],error:null});
     if(name==="h2h_agree")return Promise.resolve({data:[M.agree||{a_wins:0,b_wins:0}],error:null});
     if(name==="am_admin")return Promise.resolve({data:!!M.admin,error:null});
     if(name==="admin_stats")return Promise.resolve({data:M.admin?M.stats||null:null,error:null});
     if(name==="my_groups")return Promise.resolve({data:M.groups||[],error:null});
     if(name==="get_group_board")return Promise.resolve({data:(M.gboard||{})[args.p_key]||[],error:null});
     if(name==="get_group_members")return Promise.resolve({data:M.gmembers||[],error:null});
     if(name==="create_group"){M.groups=(M.groups||[]).concat([{id:"g2",name:args.p_name,code:"NEW222",members:1,is_lead:true,nick:args.p_nick}]);return Promise.resolve({data:[{id:"g2",code:"NEW222"}],error:null});}
     if(name==="join_group"){if(args.p_code!=="ABC123")return Promise.resolve({data:null,error:{message:"No group with that code."}});M.groups=(M.groups||[]).concat([{id:"g3",name:"Joined Crew",code:"ABC123",members:4,is_lead:false,nick:args.p_nick}]);return Promise.resolve({data:"g3",error:null});}
     return Promise.resolve({data:null,error:null});},
   auth:{getSession:function(){return Promise.resolve({data:{session:M.user?{user:M.user}:null}});},
     onAuthStateChange:function(f){listeners.push(f);},
     signInWithOtp:function(o){window.__LOG.push({otp:o.email});return Promise.resolve({error:null});},
     signInWithPassword:function(o){window.__LOG.push({pw:o.email});return Promise.resolve({error:null,data:{}});},
     verifyOtp:function(o){window.__LOG.push({verify:o.token});return Promise.resolve({error:null,data:{}});},
     signInWithOAuth:function(o){window.__LOG.push({oauth:o.provider});return Promise.resolve({error:null});},
     signOut:function(){listeners.forEach(function(f){f("SIGNED_OUT",null);});return Promise.resolve({});},
     __signIn:function(u){listeners.forEach(function(f){f("SIGNED_IN",{user:u});});}}
 };}};
})();
