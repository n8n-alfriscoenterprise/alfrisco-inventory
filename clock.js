// ════════════════════════════════════════════════════════
// TIME CLOCK — attendance IN/OUT with required selfie + GPS.
// Replaces the Google Form: identity comes from the login,
// the timestamp is generated SERVER-side (Manila) so lateness
// penalties can't be gamed, and each event stamps location.
// ════════════════════════════════════════════════════════
let _clkPhoto   = '';     // compressed dataURL for the pending clock event
let _clkGPS     = null;   // {lat, lng, accuracy} or null
let _clkLast    = null;   // last event {timestamp, action, late}
let _clkBusy    = false;
let _clkPayType = 'daily';// hourly staff get Pause / Resume
let _clkPunchesToday = 0; // photo only required on the first punch of the day

function openClock(){
  showScreen('clock-screen');
  updateFabVisibility();
  _clkPhoto = '';
  _clkGPS   = null;
  const ph = document.getElementById('clk-photo-preview');
  if(ph){ ph.style.display='none'; ph.src=''; }
  const phLbl = document.getElementById('clk-photo-label');
  if(phLbl) phLbl.textContent = '📷 Tap to take your photo';
  const fi = document.getElementById('clk-photo-input');
  if(fi) fi.value = '';
  _clkSetGPSNote('Getting location…');
  _clkFetchGPS();
  _clkLoadAll();   // one round trip: status + 30-day history together
}
function closeClock(){
  if(currentUser && currentUser.role === 'driver') showDriver();
  else showHome();
}

// ── STATUS + HISTORY (single round trip) ──────────────────
// getMyAttendance returns both the latest punch and the 30-day record, so the
// screen loads with ONE API call instead of two (each is a 1–2s Apps Script trip).
async function _clkLoadAll(){
  const card = document.getElementById('clk-status-card');
  if(card) card.innerHTML = '<div class="clk-status-sub">Checking your status…</div>';
  const body = document.getElementById('clk-att-body');
  if(body) body.innerHTML = '<div class="clk-att-empty">Loading your attendance…</div>';
  let days = [];
  try{
    const r = await api({ action:'getMyAttendance', username: currentUser.username });
    _clkLast = (r.status==='ok') ? (r.last || null) : null;
    days = (r.status==='ok') ? (r.days || []) : [];
    if(r.status==='ok'){
      _clkPayType      = r.payType || 'daily';
      _clkPunchesToday = Number(r.punchesToday) || 0;
    }
  }catch(e){
    _clkLast = null;
    if(body) body.innerHTML = '<div class="clk-att-empty">Could not load attendance.</div>';
    _clkRenderStatus();
    return;
  }
  _clkRenderStatus();
  _clkRenderMyAttendance(days);
}

function _clkRenderStatus(){
  const card = document.getElementById('clk-status-card');
  if(!card) return;
  const today = (typeof phToday==='function') ? phToday() : new Date().toISOString().slice(0,10);

  if(!_clkLast){
    card.className = 'clk-status-card clk-out';
    card.innerHTML = '<div class="clk-status-main">Not clocked in</div>'
      + '<div class="clk-status-sub">No attendance recorded yet — tap TIME IN to start your day.</div>';
  } else if(_clkLast.action === 'IN'){
    const isToday = String(_clkLast.timestamp).slice(0,10) === today;
    card.className = 'clk-status-card clk-in';
    card.innerHTML = '<div class="clk-status-main">🟢 You are IN</div>'
      + '<div class="clk-status-sub">Since ' + phDateTime(_clkLast.timestamp)
      + (_clkLast.late ? ' · <span style="color:#C0392B;font-weight:700">' + _clkLast.late + '</span>' : '')
      + '</div>'
      + (!isToday
        ? '<div class="clk-forgot-warn">⚠ This TIME IN is from a previous day — you may have forgotten to clock out. Clock out now, then tell Admin so the record can be corrected.</div>'
        : '');
  } else {
    card.className = 'clk-status-card clk-out';
    card.innerHTML = '<div class="clk-status-main">You are OUT</div>'
      + '<div class="clk-status-sub">Last clock-out: ' + phDateTime(_clkLast.timestamp) + '</div>';
  }

  // Emphasize the contextual action
  const inBtn  = document.getElementById('clk-in-btn');
  const outBtn = document.getElementById('clk-out-btn');
  const nextIsOut = _clkLast && _clkLast.action === 'IN';
  if(inBtn)  inBtn.className  = 'clk-btn clk-btn-in'  + (nextIsOut ? ' clk-btn-dim' : '');
  if(outBtn) outBtn.className = 'clk-btn clk-btn-out' + (nextIsOut ? '' : ' clk-btn-dim');

  // ── Pause / Resume — hourly staff only ──
  const pw   = document.getElementById('clk-pause-wrap');
  const pBtn = document.getElementById('clk-pause-btn');
  const pNote= document.getElementById('clk-pause-note');
  if(pw){
    const isHourly = _clkPayType === 'hourly';
    // Only meaningful once they've started the day
    pw.style.display = (isHourly && _clkPunchesToday > 0) ? 'block' : 'none';
    if(isHourly && pBtn){
      if(nextIsOut){
        pBtn.textContent = '⏸ PAUSE — no tasks right now';
        pBtn.className   = 'clk-btn clk-btn-pause';
        if(pNote) pNote.textContent = 'Your paid time stops until you resume. Use TIME OUT when you’re done for the day.';
      } else {
        pBtn.textContent = '▶ RESUME — back on tasks';
        pBtn.className   = 'clk-btn clk-btn-resume';
        if(pNote) pNote.textContent = 'You’re paused — this time isn’t being paid. Tap to start again.';
      }
    }
  }
}

// ── MY ATTENDANCE (render — data comes from _clkLoadAll) ──
function _clkRenderMyAttendance(days){
  const body = document.getElementById('clk-att-body');
  if(!body) return;
  if(!days.length){ body.innerHTML = '<div class="clk-att-empty">No attendance recorded yet.</div>'; return; }

  const t12 = (t) => {
    if(!t) return '—';
    const p = t.split(':'); let h = parseInt(p[0],10); const m = p[1];
    const ap = h>=12?'PM':'AM'; h = h%12||12;
    return h + ':' + m + ' ' + ap;
  };
  const dLabel = (d) => (typeof phDate==='function') ? phDate(d) : d;

  body.innerHTML = days.map(function(day){
    let flag = '';
    if(/half day/i.test(day.late))      flag = '<span class="clk-att-flag clk-att-hd">HALF DAY</span>';
    else if(/late/i.test(day.late))     flag = '<span class="clk-att-flag clk-att-late">'+day.late+'</span>';
    else if(day.timeIn)                 flag = '<span class="clk-att-flag clk-att-ok">On time</span>';
    return '<div class="clk-att-row">'
      + '<div class="clk-att-date">'+dLabel(day.date)+'</div>'
      + '<div class="clk-att-times"><span>IN '+t12(day.timeIn)+'</span><span>OUT '+t12(day.timeOut)+'</span></div>'
      + '<div class="clk-att-flagwrap">'+flag+'</div>'
      + '</div>';
  }).join('');
}

// ── GPS ───────────────────────────────────────────────────
function _clkSetGPSNote(txt){
  const el = document.getElementById('clk-gps-note');
  if(el) el.textContent = txt;
}
function _clkFetchGPS(){
  if(!navigator.geolocation){ _clkSetGPSNote('📍 Location not supported on this device'); return; }
  navigator.geolocation.getCurrentPosition(
    function(pos){
      _clkGPS = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6),
                  accuracy: Math.round(pos.coords.accuracy) };
      _clkSetGPSNote('📍 Location locked (±' + _clkGPS.accuracy + 'm)');
    },
    function(){ _clkGPS = null; _clkSetGPSNote('📍 No location — will record without it'); },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
  );
}
// Last-chance GPS attempt at punch time. Employees open this screen to punch
// IMMEDIATELY — the first fix often lands a few seconds later, so without this
// a fast tap records "no location" even though GPS was about to resolve.
function _clkEnsureGPS(){
  return new Promise(function(resolve){
    if(_clkGPS || !navigator.geolocation) return resolve();
    navigator.geolocation.getCurrentPosition(
      function(pos){
        _clkGPS = { lat: pos.coords.latitude.toFixed(6), lng: pos.coords.longitude.toFixed(6),
                    accuracy: Math.round(pos.coords.accuracy) };
        _clkSetGPSNote('📍 Location locked (±' + _clkGPS.accuracy + 'm)');
        resolve();
      },
      function(){ resolve(); },   // still no fix — record without location
      { enableHighAccuracy: true, timeout: 4000, maximumAge: 120000 }
    );
  });
}

// ── PHOTO (required) ──────────────────────────────────────
function onClkPhoto(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onerror = function(){ showToast('Could not read the photo — please try again', 'error'); };
  reader.onload = function(e){
    const img = new Image();
    img.onerror = function(){ showToast('Photo looks corrupted — please retake', 'error'); };
    img.onload = function(){
      // Compress to max 640px JPEG so the upload stays light
      const scale = Math.min(1, 640 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width  = Math.round(img.width  * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      _clkPhoto = cv.toDataURL('image/jpeg', 0.65);
      const ph = document.getElementById('clk-photo-preview');
      if(ph){ ph.src = _clkPhoto; ph.style.display = 'block'; }
      const phLbl = document.getElementById('clk-photo-label');
      if(phLbl) phLbl.textContent = '✓ Photo ready — tap to retake';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  // Clear so re-selecting the SAME file still fires a change event — some phone
  // cameras reuse one temp filename, which made "retake" silently do nothing
  input.value = '';
}

// Pause writes a normal OUT, Resume a normal IN — the wording just matches the
// hourly worker's mental model, and pay already follows worked sessions.
function clockPause(){
  const paused = !(_clkLast && _clkLast.action === 'IN');
  clockNow(paused ? 'IN' : 'OUT', true);
}

// ── CLOCK ACTION ──────────────────────────────────────────
// `pauseMode` = the tap came from Pause/Resume. It still writes a normal
// OUT/IN — the label just matches how hourly staff think about it.
async function clockNow(action, pauseMode){
  if(_clkBusy) return;
  // The selfie proves who showed up, so it's required on the day's FIRST punch
  // only — otherwise pausing three times would mean six photos.
  if(!_clkPhoto && _clkPunchesToday === 0){
    showToast('Photo is required — tap the camera box first', 'warning');
    const box = document.getElementById('clk-photo-box');
    if(box){ box.classList.add('clk-photo-req'); setTimeout(()=>box.classList.remove('clk-photo-req'), 1200); }
    return;
  }
  // Sanity nudge on double IN / OUT-without-IN (still allowed — honest mistakes happen)
  if(!pauseMode && _clkLast && _clkLast.action === action){
    const word = action === 'IN' ? 'clocked IN' : 'clocked OUT';
    if(!confirm('You are already ' + word + ' (last: ' + phDateTime(_clkLast.timestamp) + ').\n\nRecord another TIME ' + action + ' anyway?')) return;
  }

  _clkBusy = true;
  const btn = document.getElementById(
    pauseMode ? 'clk-pause-btn' : (action==='IN' ? 'clk-in-btn' : 'clk-out-btn'));
  const orig = btn ? btn.textContent : '';
  if(btn){ btn.disabled = true; btn.textContent = '⏳ Recording…'; }

  // If GPS hasn't locked yet, give it one quick chance before recording
  await _clkEnsureGPS();

  try{
    const r = await api({
      action:      'clockAttendance',
      username:    currentUser.username,
      role:        currentUser.role,
      clockAction: action,
      photo:       _clkPhoto,
      lat:         _clkGPS ? _clkGPS.lat : '',
      lng:         _clkGPS ? _clkGPS.lng : '',
      accuracy:    _clkGPS ? _clkGPS.accuracy : ''
    });
    if(r.status === 'ok'){
      _clkLast = { timestamp: r.timestamp, action: r.clockAction, late: r.late || '' };
      _clkPhoto = '';
      const ph = document.getElementById('clk-photo-preview');
      if(ph){ ph.style.display='none'; ph.src=''; }
      const phLbl = document.getElementById('clk-photo-label');
      if(phLbl) phLbl.textContent = '📷 Tap to take your photo';
      const fi = document.getElementById('clk-photo-input');
      if(fi) fi.value = '';
      _clkRenderStatus();
      _clkLoadAll();   // refresh history (and confirm status) from server truth
      if(r.duplicate){
        showToast('Already recorded a moment ago ✓ ' + phDateTime(r.timestamp), 'info', 4500);
      } else if(pauseMode){
        showToast(action === 'OUT'
          ? '⏸ Paused — your paid time stops here'
          : '▶ Resumed — you’re back on the clock', 'success', 4500);
      } else if(action === 'IN' && r.late){
        showToast('TIME IN recorded — ' + r.late, 'warning', 6000);
      } else {
        showToast('TIME ' + action + ' recorded ✓ ' + phDateTime(r.timestamp), 'success', 5000);
      }
    } else {
      alert('Error: ' + (r.msg || 'Could not record attendance'));
    }
  }catch(e){
    alert('Network error: ' + e.message + '\n\nYour attendance was NOT recorded — please try again when connected.');
  }
  _clkBusy = false;
  if(btn){ btn.disabled = false; btn.textContent = orig; }
}
