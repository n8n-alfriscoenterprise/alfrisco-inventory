async function loadStaff(){
  try{
    const r=await api({action:'getStaff'});
    if(r.status==='ok'&&Array.isArray(r.staff)&&r.staff.length>0){
      staff=r.staff;
      LS.set('alf_staff_cache',staff);
      return true;
    }
    return false;
  }catch(e){return false;}
}

// ── INIT ──
async function init(){
  csskus   = LS.get('alf_csskus') || JSON.parse(JSON.stringify(CS_BASE));
  _restoreDistCache();
  accessLog= LS.get('alf_log')    || [];

  // ── SESSION RESTORE ──
  // Check for a saved session before showing login
  const lastActivity = LS.get('alf_activity') || 0;
  if (lastActivity && Date.now() - lastActivity > _SESSION_TIMEOUT) {
    LS.set('alf_session', null);
    LS.set('alf_activity', null);
  }
  const savedSession = LS.get('alf_session');
  if(savedSession && savedSession.username){
    // Load staff + SKU data silently in background
    setLoginStatus('Restoring session...','loading');
    const [staffOk] = await Promise.all([loadStaff(), loadSKUMaster()]);

    // Verify the saved user still exists and password hasn't changed
    const found = staff.find(s =>
      s.username === savedSession.username &&
      s.password === savedSession.password
    );

    if(found){
      currentUser = found;
      setLoginStatus('','');
      // These normally start inside showApp() — the restore path routes around it,
      // so start them explicitly or queued offline invoices never sync and the
      // 8-hour inactivity logout never arms on a restored session
      startOfflineSync();
      _startActivityWatcher();
      // Restore last screen or go to default
      const lastScreen = savedSession.lastScreen || '';
      if(found.role === 'driver'){
        showDriver();
      } else if(lastScreen && lastScreen !== 'login-screen'
                && document.getElementById(lastScreen)){
        restoreScreen(lastScreen);
      } else {
        showApp();
      }
      // Honor a PWA shortcut launch (e.g. long-press icon → Time Clock) even on
      // a restored session — showApp() isn't always reached on this path.
      // (Safe if showApp already ran it: the handler consumes the query param.)
      if(typeof handleDeepLink === 'function') handleDeepLink();
      return; // Skip login screen entirely
    }
    // Session invalid — clear it and show login
    LS.set('alf_session', null);
  }

  // ── NORMAL LOGIN FLOW ──
  setLoginStatus('Connecting...','loading');
  document.getElementById('login-btn').disabled = true;
  const [ok] = await Promise.all([loadStaff(), loadSKUMaster()]);

  if(!ok){
    const cache = LS.get('alf_staff_cache');
    if(cache && cache.length){
      staff = cache;
      setLoginStatus('Offline — using cached accounts','error');
    } else {
      staff = [{username:'Adrian',password:'admin2026',role:'admin',assignedUnit:'All'}];
      setLoginStatus('Default account only','error');
    }
  } else { setLoginStatus('',''); }
  document.getElementById('login-btn').disabled = false;
}

function restoreScreen(screenId){
  // Restore a screen after session restore — minimal re-init
  // avoids full navigation calls that require data already loaded
  switch(screenId){
    case 'home-screen':     showHome();     break;
    case 'app-screen':      showMovement(); break;
    case 'po-screen':       openPO();       break;
    case 'count-screen':
    case 'count-type-screen': openCount(); break;
    case 'transfer-screen': openTransfer(); break;
    case 'pl-screen':       openPL();       break;
    case 'clock-screen':    openClock();    break;
    case 'hr-screen':       openHR();       break;
    case 'hr-admin-screen': openHRAdmin();  break;
    case 'prod-screen':     openProduction(); break;
    case 'driver-screen':   showDriver();   break;
    default:                showHome();     break;
  }
}

function setLoginStatus(msg,type){
  const el=document.getElementById('login-status');
  el.textContent=msg;el.className='login-status'+(type?' '+type:'');
}

// ── AUTH ──
let _lockTimer = null;

function _showLockoutCountdown(until){
  if (_lockTimer) clearInterval(_lockTimer);
  const btn = document.getElementById('login-btn');
  if (btn) btn.disabled = true;
  const tick = function(){
    const rem = Math.max(0, Math.ceil((until - Date.now()) / 1000));
    if (rem <= 0){
      clearInterval(_lockTimer); _lockTimer = null;
      LS.set('alf_login_lock', {count:0, lockedUntil:0});
      setLoginStatus('You can try again now.', 'loading');
      if (btn) btn.disabled = false;
      return;
    }
    const m = Math.floor(rem/60), s = rem%60;
    setLoginStatus('Too many attempts — locked for '+m+':'+String(s).padStart(2,'0'), 'error');
  };
  tick();
  _lockTimer = setInterval(tick, 1000);
}

async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value;
  if(!u||!p){setLoginStatus('Enter username and password.','error');return;}

  // ── LOCKOUT CHECK ──
  const lock = LS.get('alf_login_lock') || {count:0, lockedUntil:0};
  if (lock.lockedUntil && Date.now() < lock.lockedUntil){
    _showLockoutCountdown(lock.lockedUntil); return;
  }

  setLoginStatus('Verifying...','loading');
  document.getElementById('login-btn').disabled=true;
  await loadStaff();
  const found=staff.find(s=>s.username.toLowerCase()===u.toLowerCase()&&s.password===p);
  document.getElementById('login-btn').disabled=false;

  if(!found){
    const newCount = (lock.count||0) + 1;
    const lockedUntil = newCount >= 5 ? Date.now() + 5*60*1000 : 0;
    LS.set('alf_login_lock', {count:newCount, lockedUntil});
    if (newCount >= 5){
      _showLockoutCountdown(lockedUntil);
    } else {
      const left = 5 - newCount;
      setLoginStatus('Incorrect username or password. '+left+' attempt'+(left===1?'':'s')+' remaining.','error');
    }
    return;
  }

  // ── SUCCESS ──
  LS.set('alf_login_lock', {count:0, lockedUntil:0});
  currentUser = found;
  setLoginStatus('','');
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  LS.set('alf_session',{
    username:   found.username,
    password:   found.password,
    lastScreen: found.role==='driver' ? 'driver-screen' : 'home-screen'
  });
  // showApp() routes drivers to showDriver() itself AND starts the offline
  // invoice sync + activity watcher — calling showDriver() directly here
  // skipped both services for drivers (their offline invoices never synced)
  showApp();
}

function doLogout(){
  // Clear saved session so refresh goes back to login
  LS.set('alf_session', null);
  currentUser = null;
  const _fd=document.getElementById('fab-dist');
  const _fr=document.getElementById('fab-retail');
  if(_fd)_fd.style.display='none';
  if(_fr)_fr.style.display='none';
  if(document.getElementById('movement-area'))
    document.getElementById('movement-area').style.display='none';
  showScreen('login-screen');
  init();
}

