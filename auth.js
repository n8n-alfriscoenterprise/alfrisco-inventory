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
  accessLog= LS.get('alf_log')    || [];

  // ── SESSION RESTORE ──
  // Check for a saved session before showing login
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
async function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value;
  if(!u||!p){setLoginStatus('Enter username and password.','error');return;}
  setLoginStatus('Verifying...','loading');
  document.getElementById('login-btn').disabled=true;
  await loadStaff(); // Always refresh from Sheets
  const found=staff.find(s=>s.username.toLowerCase()===u.toLowerCase()&&s.password===p);
  document.getElementById('login-btn').disabled=false;
  if(!found){setLoginStatus('Incorrect username or password.','error');return;}
  currentUser = found;
  setLoginStatus('','');
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  // Save session to localStorage
  LS.set('alf_session',{
    username:   found.username,
    password:   found.password,
    lastScreen: found.role==='driver' ? 'driver-screen' : 'home-screen'
  });
  if(currentUser.role==='driver') showDriver();
  else showApp();
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

