// ── STATE ──
let currentUser=null, isReturnMode=false, currentTab='dist', currentCat='All';
let quantities={}, staff=[], csskus={}, accessLog=[];
let driverManifest=[], driverCat='All', deliverTarget=null;

// ── STORAGE ──
const LS={
  get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
function saveLocal(){LS.set('alf_csskus',csskus);LS.set('alf_log',accessLog.slice(0,100));}

// ── API ──
async function api(payload){
  const r = await fetch(WEBHOOK,{method:'POST',redirect:'follow',body:JSON.stringify(payload)});
  return r.json();
}

// ── STAFF LOADING ──
