// ════════════════════════════════════════════════════════
// MY HR — each employee's own attendance standing + expected
// salary for the current semi-monthly cutoff (1–15 / 16–end).
// Read-only: the numbers are computed server-side from the
// Attendance sheet and the employee's Daily Rate.
// ════════════════════════════════════════════════════════
let _hrOffset = 0;    // 0 = current cutoff, -1 = previous, …
let _hrBusy   = false;
let _hrReqs   = { advances: [], leaves: [], reimbursements: [] };
let _hrPolicy = null;                          // leave rules for this account
let _hrViewAs = null;   // admin viewing/acting on another employee's record

// `asEmployee` lets an admin open someone else's record and act for them.
function openHR(asEmployee){
  showScreen('hr-screen');
  updateFabVisibility();
  _hrViewAs = (asEmployee && asEmployee !== currentUser.username) ? asEmployee : null;
  _hrOffset = 0;
  _hrLoad();
}

// Whose record is on screen (admin may be viewing another employee's)
function _hrSubject(){ return _hrViewAs || currentUser.username; }

function closeHR(){
  if(currentUser && currentUser.role === 'driver') showDriver();
  else showHome();
}

function hrShiftPeriod(dir){
  // dir −1 = older cutoff, +1 = newer. Never go past the current one.
  const next = _hrOffset + dir;
  if(next > 0) return;
  _hrOffset = next;
  _hrLoad();
}

async function _hrLoad(){
  if(_hrBusy) return;
  _hrBusy = true;
  const content = document.getElementById('hr-content');
  if(content) content.innerHTML = '<div class="hr-loading">Loading your record…</div>';
  const nextBtn = document.getElementById('hr-next-btn');
  if(nextBtn) nextBtn.disabled = (_hrOffset >= 0);
  try{
    // Pay record + own requests in parallel — one wait, not two
    const [r, rq] = await Promise.all([
      api({ action:'getMyHR', username: _hrSubject(), offset: _hrOffset }),
      api({ action:'getHRRequests', username: _hrSubject(),
            role: _hrViewAs ? 'staff' : currentUser.role })
        .catch(function(){ return { status:'error' }; })
    ]);
    _hrReqs = (rq && rq.status==='ok')
      ? { advances: rq.advances||[], leaves: rq.leaves||[], reimbursements: rq.reimbursements||[] }
      : { advances: [], leaves: [], reimbursements: [] };
    if(r.status === 'ok'){ _hrPolicy = r.leavePolicy || null; _hrRender(r); }
    else if(content) content.innerHTML = '<div class="hr-empty">Could not load your HR record.</div>';
  }catch(e){
    if(content) content.innerHTML = '<div class="hr-empty">Network error — check your connection.</div>';
  }
  _hrBusy = false;
  const nb = document.getElementById('hr-next-btn');
  if(nb) nb.disabled = (_hrOffset >= 0);
}

function _hrPeso(n){
  return '₱' + Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
}

function _hrTime12(t){
  if(!t) return '—';
  const p = t.split(':'); let h = parseInt(p[0],10); const m = p[1];
  const ap = h>=12 ? 'PM' : 'AM'; h = h%12 || 12;
  return h + ':' + m + ' ' + ap;
}

function _hrRender(d){
  const el = document.getElementById('hr-content');
  const lbl = document.getElementById('hr-period-label');
  if(lbl) lbl.textContent = d.period || '';
  if(!el) return;

  const hourly = d.payType === 'hourly';

  // Admin acting on someone else's record — make that unmistakable
  let html = _hrViewAs
    ? '<div class="hr-viewas">👤 Viewing <strong>'+_hrViewAs+'</strong>’s record as Admin. '
      + 'Anything you file here is recorded for them, by you.'
      + '<button class="hr-viewas-exit" onclick="openHR()">Back to mine</button></div>'
    : '';

  // ── Attendance standing (hourly counts hours & full days instead of late/half) ──
  html += '<div class="hr-card">'
    + '<div class="hr-card-title">Attendance standing'
      + (hourly ? ' <span style="color:#7B1FA2">· paid hourly</span>' : '')
      + (d.scheduleName ? ' <span style="color:#888;font-weight:600">· '+d.scheduleName
          +' '+d.scheduleStart+'–'+d.scheduleEnd+'</span>' : '') + '</div>'
    + '<div class="hr-stat-grid">'
    + (hourly
      ? '<div class="hr-stat days"><span class="hr-stat-val">'+d.daysWorked+'</span><span class="hr-stat-lbl">Days</span></div>'
        + '<div class="hr-stat ok"><span class="hr-stat-val">'+(d.fullDays||0)+'</span><span class="hr-stat-lbl">Full days</span></div>'
        + '<div class="hr-stat days"><span class="hr-stat-val">'+(d.hoursPaid||0)+'</span><span class="hr-stat-lbl">Hours</span></div>'
        + '<div class="hr-stat half"><span class="hr-stat-val">'+(d.incompleteDays||0)+'</span><span class="hr-stat-lbl">No out</span></div>'
      : '<div class="hr-stat days"><span class="hr-stat-val">'+d.daysWorked+'</span><span class="hr-stat-lbl">Days</span></div>'
        + '<div class="hr-stat ok"><span class="hr-stat-val">'+Math.max(0,d.daysWorked-d.lateDays-d.halfDays)+'</span><span class="hr-stat-lbl">On time</span></div>'
        + '<div class="hr-stat late"><span class="hr-stat-val">'+d.lateDays+'</span><span class="hr-stat-lbl">Late</span></div>'
        + '<div class="hr-stat half"><span class="hr-stat-val">'+d.halfDays+'</span><span class="hr-stat-lbl">Half day</span></div>')
    + '</div>'
    + (hourly && d.incompleteDays > 0
        ? '<div class="hr-note" style="color:#C0392B"><strong>'+d.incompleteDays+' day'+(d.incompleteDays!==1?'s':'')
          +' missing a time-out</strong> — those days pay ₱0.00 until corrected. Ask Admin to fix them.</div>' : '')
    + (hourly && d.otHours > 0
        ? '<div class="hr-note">Worked outside the duty window: <strong>'+d.otHours+' hour'+(d.otHours!==1?'s':'')
          +'</strong> (not automatically paid).</div>' : '')
    + (d.lateMinutes > 0
        ? '<div class="hr-note">Total time late this cutoff: <strong>'+d.lateMinutes+' minute'+(d.lateMinutes!==1?'s':'')+'</strong>'
          + (hourly ? ' — deducted from your paid hours.' : '.') + '</div>'
        : '')
    + '</div>';

  // ── Expected salary (only when a rate is on file) ──
  if(!d.rateSet){
    html += '<div class="hr-card">'
      + '<div class="hr-card-title">Expected salary</div>'
      + '<div class="hr-norate">Your daily rate isn’t set yet, so pay can’t be estimated. '
      + 'Please ask Admin to add it to your staff record — your attendance above is already being tracked.</div>'
      + '</div>';
  } else {
    html += '<div class="hr-card">'
      + '<div class="hr-card-title">Expected salary — estimate</div>'
      + (hourly
        ? '<div class="hr-pay-row"><span>Hourly rate ('+_hrPeso(d.dailyRate)+' ÷ '+d.stdHours+'h)</span><span>'+_hrPeso(d.hourlyRate)+'</span></div>'
          + '<div class="hr-pay-row"><span>Hours worked ('+(d.hoursPaid||0)+'h × rate)</span><span>'+_hrPeso(d.gross)+'</span></div>'
        : '<div class="hr-pay-row"><span>Daily rate</span><span>'+_hrPeso(d.dailyRate)+'</span></div>'
          + '<div class="hr-pay-row"><span>Basic ('+d.daysWorked+' day'+(d.daysWorked!==1?'s':'')+' × rate)</span><span>'+_hrPeso(d.gross)+'</span></div>')
      + (d.allowance > 0
          ? '<div class="hr-pay-row add"><span>Allowance ('+d.daysWorked+' × '+_hrPeso(d.allowanceRate)+')</span><span>+ '+_hrPeso(d.allowance)+'</span></div>' : '')
      + (d.reimbursement > 0
          ? '<div class="hr-pay-row add"><span>Reimbursements</span><span>+ '+_hrPeso(d.reimbursement)+'</span></div>' : '')
      + (d.lateDeduction > 0
          ? '<div class="hr-pay-row ded"><span>Late deductions</span><span>− '+_hrPeso(d.lateDeduction)+'</span></div>' : '')
      + (d.undertimeDeduction > 0
          ? '<div class="hr-pay-row ded"><span>Undertime ('+d.undertimeMinutes+' min)</span><span>− '+_hrPeso(d.undertimeDeduction)+'</span></div>' : '')
      + (d.halfDayDeduction > 0
          ? '<div class="hr-pay-row ded"><span>Half-day deductions</span><span>− '+_hrPeso(d.halfDayDeduction)+'</span></div>' : '')
      + (d.cashAdvance > 0
          ? '<div class="hr-pay-row ded"><span>Cash advance'
            + (d.advanceSettled > 0 && !d.advanceOutstanding ? ' <span style="font-size:10px;color:#888">(deducted)</span>' : '')
            + '</span><span>− '+_hrPeso(d.cashAdvance)+'</span></div>' : '')
      + '<div class="hr-pay-total"><span>Expected pay</span><span>'+_hrPeso(d.expected)+'</span></div>'
      + '<div class="hr-note">Estimate only, based on time records so far this cutoff ('+d.startDate+' to '+d.endDate+'). '
      + 'Final pay is confirmed by Admin.</div>'
      + '</div>';
  }

  // ── Daily breakdown ──
  html += '<div class="hr-card"><div class="hr-card-title">Daily record</div>';
  if(!d.days || !d.days.length){
    html += '<div class="hr-empty">No attendance recorded for this cutoff.</div>';
  } else {
    html += '<table class="hr-day-table"><thead><tr>'
      + '<th>Date</th><th>In</th><th>Out</th><th>Status</th>'
      + (d.rateSet ? '<th class="r">Day pay</th>' : '')
      + '</tr></thead><tbody>';
    d.days.forEach(function(day){
      // Missing/invalid punches are the loudest signal for hourly staff
      const bad    = day.incomplete === true;
      const adj    = day.adjustment;
      const isHalf = /half/i.test(day.status), isLate = /late/i.test(day.status);
      const cls = adj ? 'half' : bad ? 'half' : isHalf ? 'half' : isLate ? 'late' : 'ok';
      const label = (bad && !adj) ? '⚠ '+day.status : day.status;
      html += '<tr>'
        + '<td>'+(typeof phDate==='function' ? phDate(day.date) : day.date)+'</td>'
        + '<td>'+_hrTime12(day.timeIn)+'</td>'
        + '<td>'+_hrTime12(day.timeOut)+'</td>'
        + '<td><span class="hr-flag '+cls+'">'+label+'</span>'
          + (day.ot > 0 ? '<div style="font-size:10px;color:#7B1FA2;margin-top:2px">+'+day.ot+'h beyond duty</div>' : '')
          + (adj
              ? (adj.response
                  ? '<div class="hr-adj-reply">💬 You answered: “'+adj.response+'”</div>'
                  : '<button class="hr-adj-btn" onclick="openRespondModal(\''+adj.id+'\',\''
                      +String(adj.reason).replace(/'/g,"\\'").replace(/"/g,'&quot;')+'\')">✍ Answer this</button>')
              : '')
          + '</td>'
        + (d.rateSet ? '<td class="r">'+_hrPeso(day.pay)+'</td>' : '')
        + '</tr>';
    });
    html += '</tbody></table>';
  }
  html += '</div>';

  // ── Requests: actions + my own history ──
  html += _hrRenderRequests();

  el.innerHTML = html;
}

// ── CASH ADVANCE & LEAVE REQUESTS (employee side) ────────────
function _hrStatusPill(st){
  const s = String(st||'Pending');
  const cls = s==='Approved' ? 'appr' : s==='Rejected' ? 'rej' : 'pend';
  return '<span class="hr-req-status '+cls+'">'+s+'</span>';
}

function _hrRenderRequests(){
  const adv = _hrReqs.advances || [], lv = _hrReqs.leaves || [], rb = _hrReqs.reimbursements || [];
  let html = '<div class="hr-card">'
    + '<div class="hr-card-title">Requests</div>'
    + '<div class="hr-req-actions">'
      + '<button class="hr-req-btn adv" onclick="openCashAdvanceModal()">💵 Cash Advance</button>'
      + '<button class="hr-req-btn lv" onclick="openLeaveModal()">🌴 Leave</button>'
      + '<button class="hr-req-btn rmb" onclick="openReimburseModal()">🧾 Reimbursement</button>'
    + '</div>';

  if(!adv.length && !lv.length && !rb.length){
    html += '<div class="hr-note">No requests yet. Anything you submit goes to Admin for approval and appears here.</div>';
    return html + '</div>';
  }

  rb.slice(0,6).forEach(function(x){
    html += '<div class="hr-req-row">'
      + '<div class="hr-req-main">'
        + '<div class="hr-req-title">🧾 '+x.category+' · <strong>'+_hrPeso(x.amount)+'</strong>'
          + (x.paid ? ' <span class="hr-req-settled">paid</span>' : '')
          + (x.receipt && x.receipt.indexOf('http')===0
              ? ' <a href="'+x.receipt+'" target="_blank" rel="noopener" style="font-size:10px">receipt</a>' : '') + '</div>'
        + '<div class="hr-req-meta">'+(typeof phDate==='function'?phDate(x.expenseDate):x.expenseDate)
          + (x.resolvedBy ? ' · by '+x.resolvedBy : '') + '</div>'
        + '<div class="hr-req-reason">“'+x.description+'”</div>'
      + '</div>' + _hrStatusPill(x.status)
    + '</div>';
  });

  adv.slice(0,6).forEach(function(a){
    html += '<div class="hr-req-row">'
      + '<div class="hr-req-main">'
        + '<div class="hr-req-title">💵 Cash advance · <strong>'+_hrPeso(a.amount)+'</strong>'
          + (a.settled ? ' <span class="hr-req-settled">settled</span>' : '') + '</div>'
        + '<div class="hr-req-meta">'+(typeof phDate==='function'?phDate(a.requestedAt.slice(0,10)):a.requestedAt)
          + (a.resolvedBy ? ' · by '+a.resolvedBy : '') + '</div>'
        + '<div class="hr-req-reason">“'+a.reason+'”</div>'
      + '</div>' + _hrStatusPill(a.status)
    + '</div>';
  });

  lv.slice(0,6).forEach(function(l){
    const range = (typeof phDate==='function'?phDate(l.startDate):l.startDate)
      + (l.endDate!==l.startDate ? ' – '+(typeof phDate==='function'?phDate(l.endDate):l.endDate) : '');
    html += '<div class="hr-req-row">'
      + '<div class="hr-req-main">'
        + '<div class="hr-req-title">🌴 '+l.leaveType+' · <strong>'+l.days+' day'+(l.days!==1?'s':'')+'</strong></div>'
        + '<div class="hr-req-meta">'+range+(l.resolvedBy ? ' · by '+l.resolvedBy : '')+'</div>'
        + '<div class="hr-req-reason">“'+l.reason+'”</div>'
      + '</div>' + _hrStatusPill(l.status)
    + '</div>';
  });

  return html + '</div>';
}

// ── ANSWER A HELD / VOIDED DAY ───────────────────────────────────
let _respondAdjId = null;
function openRespondModal(adjustmentId, reason){
  _respondAdjId = adjustmentId;
  document.getElementById('resp-reason').textContent = reason || '';
  document.getElementById('resp-text').value = '';
  document.getElementById('resp-err').textContent = '';
  document.getElementById('respond-modal').style.display = 'flex';
}
function closeRespondModal(){
  document.getElementById('respond-modal').style.display = 'none';
  _respondAdjId = null;
}
async function submitAdjResponse(){
  const err = document.getElementById('resp-err');
  const btn = document.getElementById('resp-save-btn');
  err.textContent = '';
  const text = document.getElementById('resp-text').value.trim();
  if(!text){ err.textContent = 'Please write your answer.'; return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const r = await api({ action:'respondPayAdjustment', adjustmentId: _respondAdjId,
                          response: text, by: currentUser.username });
    if(r.status==='ok'){
      closeRespondModal();
      showToast('Your answer was sent to Admin ✓','success',4500);
      await _hrLoad();
    } else { err.textContent = 'Error: '+(r.msg||'Could not send'); }
  }catch(e){ err.textContent = 'Network error: '+e.message; }
  btn.disabled = false; btn.textContent = '📨 Send Answer';
}

function openCashAdvanceModal(){
  document.getElementById('ca-amount').value = '';
  document.getElementById('ca-reason').value = '';
  document.getElementById('ca-err').textContent = '';
  document.getElementById('cash-advance-modal').style.display = 'flex';
}
function closeCashAdvanceModal(){
  document.getElementById('cash-advance-modal').style.display = 'none';
}

async function submitCashAdvance(){
  const err = document.getElementById('ca-err');
  const btn = document.getElementById('ca-save-btn');
  err.textContent = '';
  const amount = Number(document.getElementById('ca-amount').value) || 0;
  const reason = document.getElementById('ca-reason').value.trim();
  if(amount <= 0){ err.textContent = 'Enter the amount you need.'; return; }
  if(!reason){ err.textContent = 'Please give a reason.'; return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const r = await api({ action:'submitCashAdvance', requestedBy: _hrSubject(),
                          amount: amount, reason: reason });
    if(r.status === 'ok'){
      closeCashAdvanceModal();
      showToast('Cash advance request sent to Admin 📨','success',4500);
      await _hrLoad();
    } else { err.textContent = 'Error: ' + (r.msg||'Could not send'); }
  }catch(e){ err.textContent = 'Network error: ' + e.message; }
  btn.disabled = false; btn.textContent = '📨 Submit Request';
}

// ── REIMBURSEMENT REQUEST ────────────────────────────────────────
let _rmbPhoto = '';
function openReimburseModal(){
  const today = (_hrPolicy && _hrPolicy.today)
    || ((typeof phToday==='function') ? phToday() : new Date().toLocaleDateString('sv-SE'));
  document.getElementById('rmb-amount').value = '';
  document.getElementById('rmb-category').value = 'Fuel';
  document.getElementById('rmb-date').value = today;
  document.getElementById('rmb-date').max = today;      // no future expenses
  document.getElementById('rmb-desc').value = '';
  document.getElementById('rmb-err').textContent = '';
  _rmbPhoto = '';
  const lbl = document.getElementById('rmb-photo-label');
  if(lbl) lbl.textContent = '📷 Attach receipt photo (optional)';
  const fi = document.getElementById('rmb-photo-input');
  if(fi) fi.value = '';
  document.getElementById('reimburse-modal').style.display = 'flex';
}
function closeReimburseModal(){
  document.getElementById('reimburse-modal').style.display = 'none';
}

// Compress the receipt the same way as attendance selfies so uploads stay light
function onRmbPhoto(input){
  const file = input.files && input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onerror = function(){ showToast('Could not read that photo','error'); };
  reader.onload = function(e){
    const img = new Image();
    img.onerror = function(){ showToast('Photo looks corrupted — try again','error'); };
    img.onload = function(){
      const scale = Math.min(1, 900 / Math.max(img.width, img.height));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.width*scale); cv.height = Math.round(img.height*scale);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      _rmbPhoto = cv.toDataURL('image/jpeg', 0.7);
      const lbl = document.getElementById('rmb-photo-label');
      if(lbl) lbl.textContent = '✓ Receipt attached — tap to replace';
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
  input.value = '';
}

async function submitReimbursement(){
  const err = document.getElementById('rmb-err');
  const btn = document.getElementById('rmb-save-btn');
  err.textContent = '';
  const amount = Number(document.getElementById('rmb-amount').value) || 0;
  const desc   = document.getElementById('rmb-desc').value.trim();
  const date   = document.getElementById('rmb-date').value;
  if(amount <= 0){ err.textContent = 'Enter the amount you paid.'; return; }
  if(!date){ err.textContent = 'Pick the date of the expense.'; return; }
  if(!desc){ err.textContent = 'Describe what the expense was for.'; return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const r = await api({ action:'submitReimbursement', requestedBy: _hrSubject(),
      amount: amount, category: document.getElementById('rmb-category').value,
      expenseDate: date, description: desc, receipt: _rmbPhoto });
    if(r.status === 'ok'){
      closeReimburseModal();
      showToast('Reimbursement sent to Admin 🧾','success',4500);
      await _hrLoad();
    } else { err.textContent = 'Error: ' + (r.msg||'Could not send'); }
  }catch(e){ err.textContent = 'Network error: ' + e.message; }
  btn.disabled = false; btn.textContent = '📨 Submit Request';
}

function openLeaveModal(){
  const p = _hrPolicy || {};
  const today = p.today || ((typeof phToday==='function') ? phToday() : new Date().toLocaleDateString('sv-SE'));
  // Only the types this account may file (shared logins → Unpaid Leave only)
  const types = (p.types && p.types.length) ? p.types
              : ['Sick Leave','Vacation Leave','Emergency Leave','Unpaid Leave'];
  const sel = document.getElementById('lv-type');
  sel.innerHTML = types.map(function(t){ return '<option value="'+t+'">'+t+'</option>'; }).join('');
  const genericNote = document.getElementById('lv-generic-note');
  if(genericNote){
    genericNote.style.display = p.isGeneric ? 'block' : 'none';
    genericNote.textContent = 'This is a shared account, so only Unpaid Leave can be filed. '
      + 'Named employee accounts can file sick, vacation and emergency leave.';
  }
  document.getElementById('lv-start').value = today;
  document.getElementById('lv-end').value   = today;
  document.getElementById('lv-reason').value = '';
  document.getElementById('lv-err').textContent = '';
  onLeaveTypeChange();
  document.getElementById('leave-modal').style.display = 'flex';
}

// Applies the filing window for the chosen type — same rules the server enforces
function onLeaveTypeChange(){
  const p = _hrPolicy || {};
  const type  = document.getElementById('lv-type').value;
  const start = document.getElementById('lv-start');
  const end   = document.getElementById('lv-end');
  const note  = document.getElementById('lv-rule-note');
  const today = p.today || start.value;
  start.min = ''; start.max = ''; end.min = ''; end.max = '';

  if(type === 'Emergency Leave'){
    start.min = today; start.max = today;
    if(start.value !== today){ start.value = today; if(end.value < today) end.value = today; }
    end.min = today;
    if(note) note.innerHTML = '⚡ Emergency Leave is filed <strong>on the day itself</strong> — '
      + 'the start date is locked to today. Limit: <strong>'+(p.emergencyPerMonth||1)
      + ' per month</strong>.';
  } else if(type === 'Vacation Leave'){
    const earliest = p.vacationEarliest || today;
    start.min = earliest; end.min = earliest;
    if(start.value < earliest){ start.value = earliest; end.value = earliest; }
    if(note) note.innerHTML = '🗓 Vacation Leave needs <strong>'+(p.vacationNoticeDays||14)
      + ' days notice</strong> — the earliest you can start is <strong>'+earliest+'</strong>.';
  } else if(type === 'Sick Leave'){
    if(note) note.innerHTML = '🩺 Sick Leave is <strong>approved automatically</strong>, but you must '
      + '<strong>present a medical certificate</strong> to Admin.';
  } else {
    if(note) note.innerHTML = '📄 Unpaid Leave is recorded as an absence with a reason — '
      + 'those days are simply not paid.';
  }
  _lvUpdateDays();
}
function closeLeaveModal(){
  document.getElementById('leave-modal').style.display = 'none';
}

// Live day count so the employee sees exactly what they're asking for
function _lvUpdateDays(){
  const s = document.getElementById('lv-start').value;
  const e = document.getElementById('lv-end').value;
  const note = document.getElementById('lv-days-note');
  if(!note) return;
  if(!s || !e || e < s){ note.textContent = ''; return; }
  const days = Math.round((new Date(e+'T00:00:00') - new Date(s+'T00:00:00'))/86400000) + 1;
  note.textContent = days + ' day' + (days!==1?'s':'') + ' requested';
}

async function submitLeaveRequest(){
  const err = document.getElementById('lv-err');
  const btn = document.getElementById('lv-save-btn');
  err.textContent = '';
  const leaveType = document.getElementById('lv-type').value;
  const startDate = document.getElementById('lv-start').value;
  const endDate   = document.getElementById('lv-end').value;
  const reason    = document.getElementById('lv-reason').value.trim();
  if(!startDate || !endDate){ err.textContent = 'Pick your leave dates.'; return; }
  if(endDate < startDate){ err.textContent = 'End date cannot be before the start date.'; return; }
  if(!reason){ err.textContent = 'Please give a reason.'; return; }
  btn.disabled = true; btn.textContent = 'Sending…';
  try{
    const r = await api({ action:'submitLeaveRequest', requestedBy: _hrSubject(),
                          leaveType, startDate, endDate, reason });
    if(r.status === 'ok'){
      closeLeaveModal();
      if(r.autoApproved){
        showToast('Sick Leave approved ✓ — remember to present your medical certificate','success',7000);
      } else {
        showToast('Leave request sent to Admin 📨','success',4500);
      }
      await _hrLoad();
    } else { err.textContent = 'Error: ' + (r.msg||'Could not send'); }
  }catch(e){ err.textContent = 'Network error: ' + e.message; }
  btn.disabled = false; btn.textContent = '📨 Submit Request';
}
