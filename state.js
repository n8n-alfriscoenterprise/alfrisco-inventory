// ── STATE ──
let currentUser=null, isReturnMode=false, currentTab='dist', currentCat='All';
let quantities={}, staff=[], csskus={}, accessLog=[];
let driverManifest=[], driverCat='All';
let supplierList=[];
let dealerList=[], dealerFilter='All', currentDealer=null;
let poEditMode=false, poEditingNumber=null;
let _poSaving=false; // guard against double-tap duplicate submissions

// ── STORAGE ──
const LS={
  get:k=>{try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}},
  set:(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
};
// Put the last known distribution list back before anything renders, so Count
// and Movement show the real categories even when the SKU Master call fails.
// DIST_CATS / DIST_SKUS are consts from config.js, so they are mutated in
// place — the same way rebuildSKUData() refreshes them from the live master.
// A cache that is missing or malformed leaves the config defaults untouched.
function _restoreDistCache(){
  try{
    const cats = LS.get('alf_dist_cats');
    const skus = LS.get('alf_dist_skus');
    if(!Array.isArray(cats) || !cats.length) return;
    if(!skus || typeof skus !== 'object' || Array.isArray(skus)) return;
    DIST_CATS.length = 0;
    cats.forEach(function(c){ if(typeof c === 'string' && c) DIST_CATS.push(c); });
    Object.keys(DIST_SKUS).forEach(function(k){ delete DIST_SKUS[k]; });
    Object.keys(skus).forEach(function(k){
      if(Array.isArray(skus[k])) DIST_SKUS[k] = skus[k];
    });
  }catch(e){ /* keep the config defaults rather than leaving the app empty */ }
}

// Cache BOTH SKU lists, not just retail. The distribution categories used to
// live only in memory, so when the SKU Master call failed (no signal, API
// hiccup) Count and Movement fell back to the hardcoded list in config.js and
// a newly added category simply vanished from those screens. Caching them
// means the phone keeps the real list until the master answers again.
function saveLocal(){
  LS.set('alf_csskus',csskus);
  LS.set('alf_dist_cats',DIST_CATS);
  LS.set('alf_dist_skus',DIST_SKUS);
  LS.set('alf_log',accessLog.slice(0,100));
}

// ── SESSION TIMEOUT (auto-logout after 8 hrs inactivity) ──────────────
const _SESSION_TIMEOUT = 8 * 60 * 60 * 1000;
let _activityWatcherTimer = null;

function _touchActivity(){
  LS.set('alf_activity', Date.now());
}

function _startActivityWatcher(){
  _touchActivity();
  ['touchstart','mousedown','keydown'].forEach(ev =>
    document.addEventListener(ev, _touchActivity, {passive:true})
  );
  if (_activityWatcherTimer) return;
  _activityWatcherTimer = setInterval(function(){
    const last = LS.get('alf_activity') || 0;
    if (currentUser && Date.now() - last > _SESSION_TIMEOUT) {
      clearInterval(_activityWatcherTimer);
      _activityWatcherTimer = null;
      if (typeof showToast === 'function')
        showToast('Session expired — please sign in again.', 'warning', 5000);
      setTimeout(function(){ if (typeof doLogout === 'function') doLogout(); }, 2500);
    }
  }, 5 * 60 * 1000);
}

// ── API ──
// Never throws — always returns {status, ...}.
// Injects API secret token on every call.
// saveInvoice failures queue to localStorage for later sync.
async function api(payload){
  const secured = Object.assign({}, payload);
  if (typeof API_SECRET !== 'undefined' && API_SECRET) secured._token = API_SECRET;
  _touchActivity();
  try {
    const r = await fetch(WEBHOOK, {method:'POST', redirect:'follow', body:JSON.stringify(secured)});
    const text = await r.text();
    try {
      return JSON.parse(text);
    } catch(_) {
      console.error('Apps Script non-JSON response:', text.slice(0, 400));
      return {status:'error', msg:'Apps Script returned an unexpected response — re-deploy and try again.'};
    }
  } catch(netErr) {
    console.error('Fetch failed:', netErr.message);
    if (payload.action === 'saveInvoice') {
      const tempNum = _queueOfflineInvoice(payload);
      return {status:'queued', invoiceNumber: tempNum};
    }
    return {status:'error', msg:'Network error — check your internet connection.'};
  }
}

// ── OFFLINE INVOICE QUEUE ──────────────────────────────────────────
let _offlineSyncTimer = null;

function _queueOfflineInvoice(payload) {
  const p        = Object.assign({}, payload);
  p._queuedAt    = new Date().toISOString();
  p._tempNumber  = 'OFFLINE-' + Date.now();
  const queue    = LS.get('alf_pending_invoices') || [];
  queue.push(p);
  LS.set('alf_pending_invoices', queue);
  if (typeof updateOfflineBadge === 'function') updateOfflineBadge();
  return p._tempNumber;
}

async function syncOfflinePending() {
  const queue = LS.get('alf_pending_invoices') || [];
  if (!queue.length) return;
  const remaining = [];
  for (const payload of queue) {
    const tempNum = payload._tempNumber || 'PENDING';
    const clean   = Object.assign({}, payload);
    delete clean._queuedAt;
    delete clean._tempNumber;
    if (typeof API_SECRET !== 'undefined' && API_SECRET) clean._token = API_SECRET;
    try {
      const resp = await fetch(WEBHOOK, {method:'POST', redirect:'follow', body:JSON.stringify(clean)});
      const r    = JSON.parse(await resp.text());
      if (r.status === 'ok') {
        if (typeof showToast === 'function')
          showToast(tempNum + ' synced → ' + r.invoiceNumber + ' ✓', 'success');
      } else {
        remaining.push(payload);
      }
    } catch(e) {
      remaining.push(payload); // still offline
    }
  }
  LS.set('alf_pending_invoices', remaining);
  if (typeof updateOfflineBadge === 'function') updateOfflineBadge();
}

function startOfflineSync() {
  if (_offlineSyncTimer) return;
  syncOfflinePending(); // immediate first attempt
  _offlineSyncTimer = setInterval(syncOfflinePending, 30000);
}

// ── DATE HELPERS (Philippine Standard Time = UTC+8) ──────────────────────
function _phParse(val) {
  if (!val) return null;
  const s = String(val).trim();
  if (!s || s === '—') return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s))            return new Date(s + 'T00:00:00+08:00');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(s)) return new Date(s.replace(' ','T') + '+08:00');
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
// Month names keep dates unambiguous — "05-04-2026" could be read as either
// May 4 or April 5, so every displayed date spells the month out: "May 4, 2026".
const _PH_MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function phDate(val) {
  const d = _phParse(val);
  if (!d) return val ? String(val) : '—';
  const ph = new Date(d.toLocaleString('en-US',{timeZone:'Asia/Manila'}));
  return _PH_MON[ph.getMonth()]+' '+ph.getDate()+', '+ph.getFullYear();
}
function phDateTime(val) {
  const d = _phParse(val);
  if (!d) return val ? String(val) : '—';
  const ph  = new Date(d.toLocaleString('en-US',{timeZone:'Asia/Manila'}));
  const h   = ph.getHours(), ampm = h>=12?'PM':'AM', h12 = h%12||12;
  const mi  = String(ph.getMinutes()).padStart(2,'0');
  return _PH_MON[ph.getMonth()]+' '+ph.getDate()+', '+ph.getFullYear()+' · '+h12+':'+mi+' '+ampm;
}
function phToday(){ return new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}); }
function phNow()  { return new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}); }

// ── DELIVERY VEHICLES (expandable — backed by the 'Delivery Vehicles' sheet) ──
let vehicleList = [];
async function loadVehicles(){
  // Show cached vehicles instantly, then refresh from the sheet
  const cached = LS.get('alf_vehicles');
  if(cached && cached.length && !vehicleList.length) vehicleList = cached;
  try{
    const r = await api({action:'getVehicles'});
    if(r.status==='ok' && Array.isArray(r.vehicles) && r.vehicles.length){
      vehicleList = r.vehicles;
      LS.set('alf_vehicles', vehicleList);
    }
  }catch(e){ /* keep cache */ }
  if(!vehicleList.length) vehicleList = [{id:'Bajaj1',label:'Bajaj 1'},{id:'Bajaj2',label:'Bajaj 2'}];
  return vehicleList;
}
// Fill a <select> with the vehicle list (plus an Unassigned option)
function populateVehicleSelect(selectId, selected){
  const sel = document.getElementById(selectId);
  if(!sel) return;
  const cur = selected!==undefined ? selected : sel.value;
  sel.innerHTML = '<option value="">— Unassigned —</option>'
    + vehicleList.map(function(v){ return '<option value="'+v.id+'"'+(v.id===cur?' selected':'')+'>'+v.label+'</option>'; }).join('');
}
// Ensure every active vehicle appears in the movement unit selector (so a newly
// added van is selectable without editing the HTML). Vans group before the
// fixed locations (Retail Store / Distribution WH).
function injectUnitVehicles(){
  const sel = document.getElementById('unit-select');
  if(!sel || !vehicleList.length) return;
  const have = {};
  Array.prototype.forEach.call(sel.options, function(o){ have[o.value]=true; });
  let anchor = null;
  Array.prototype.forEach.call(sel.options, function(o){
    if(!anchor && (o.value==='Retail Store' || o.value==='Distribution WH')) anchor=o;
  });
  vehicleList.forEach(function(v){
    if(have[v.id]) return;
    const opt = document.createElement('option');
    opt.value = v.id; opt.textContent = v.label;
    if(anchor) sel.insertBefore(opt, anchor); else sel.appendChild(opt);
  });
}

// ── STAFF LOADING ──
