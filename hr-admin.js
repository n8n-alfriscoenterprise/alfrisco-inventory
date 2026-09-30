// ════════════════════════════════════════════════════════
// HR DASHBOARD (admin) — every employee for one pay cutoff:
// attendance standing, expected pay, and the payroll total.
// Numbers come from the same server-side engine as each
// employee's own My HR screen, so the two always agree.
// ════════════════════════════════════════════════════════
let _hraOffset   = 0;
let _hraBusy     = false;
let _hraData     = null;
let _hraExpanded = {};    // username → daily detail open?
let _hraReqs     = { advances: [], leaves: [] };   // all staff requests (admin view)

function openHRAdmin(){
  showScreen('hr-admin-screen');
  updateFabVisibility();
  _hraOffset = 0;
  _hraExpanded = {};
  _hraLoad();
}

function closeHRAdmin(){ showHome(); }

function hraShiftPeriod(dir){
  const next = _hraOffset + dir;
  if(next > 0) return;              // never past the current cutoff
  _hraOffset = next;
  _hraExpanded = {};
  _hraLoad();
}

async function _hraLoad(){
  if(_hraBusy) return;
  _hraBusy = true;
  const body = document.getElementById('hra-content');
  if(body) body.innerHTML = '<div class="hr-loading">Loading payroll…</div>';
  const nb = document.getElementById('hra-next-btn');
  if(nb) nb.disabled = (_hraOffset >= 0);
  try{
    // Payroll + the approval inbox together — one wait
    const [r, rq] = await Promise.all([
      api({ action:'getHRSummary', role: currentUser.role,
            by: currentUser.username, offset: _hraOffset }),
      api({ action:'getHRRequests', role: currentUser.role, username: currentUser.username })
        .catch(function(){ return { status:'error' }; })
    ]);
    _hraReqs = (rq && rq.status==='ok')
      ? { advances: rq.advances||[], leaves: rq.leaves||[], reimbursements: rq.reimbursements||[] }
      : { advances: [], leaves: [], reimbursements: [] };
    if(r.status === 'ok'){ _hraData = r; _hraRender(); }
    else if(body) body.innerHTML = '<div class="hr-empty">'+(r.msg||'Could not load payroll.')+'</div>';
  }catch(e){
    if(body) body.innerHTML = '<div class="hr-empty">Network error — check your connection.</div>';
  }
  _hraBusy = false;
  const nb2 = document.getElementById('hra-next-btn');
  if(nb2) nb2.disabled = (_hraOffset >= 0);
}

// Notes are free text typed by an admin, so they never go into HTML raw
function _hraEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
// Whole calendar days between a 'YYYY-MM-DD' date and today, both read in
// Manila, compared as date-only so the clock time cannot skew the count.
function _hraDaysSince(dateStr){
  const d = String(dateStr||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const today = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}).slice(0,10);
  const utc = s => Date.UTC(+s.slice(0,4), +s.slice(5,7)-1, +s.slice(8,10));
  return Math.round((utc(today) - utc(d)) / 86400000);
}

// Which semi-monthly cutoff a date belongs to — mirrors the server's labelling
function _hraCutoffLabel(dateStr){
  const d = String(dateStr||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d)) return '';
  const y=+d.slice(0,4), m=+d.slice(5,7), day=+d.slice(8,10);
  const last = new Date(y, m, 0).getDate();
  const mon  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m-1];
  return mon+' '+(day<=15?'1–15':'16–'+last)+', '+y;
}

// One line per advance / reimbursement, with the date it was raised and a clear
// flag when it was carried over from an earlier cutoff. A lump total with no
// date made it impossible to tell an old unsettled item from a new one.
function _hraItemLines(items, label, sign){
  return (items||[]).map(function(it){
    const when = it.requestedAt
      ? (typeof phDate==='function' ? phDate(it.requestedAt.slice(0,10)) : it.requestedAt.slice(0,10))
      : 'no date recorded';
    const carried = it.carriedOver
      ? '<span class="hra-carry" title="Requested in an earlier cutoff and still not settled">'
        + '↪ from ' + _hraEsc(it.fromCutoff || 'an earlier cutoff') + '</span>'
      : '';
    const state = it.state === 'settled' ? ' <span class="hra-it-state">· deducted here</span>'
                : it.state === 'paid'    ? ' <span class="hra-it-state">· paid here</span>'
                                         : ' <span class="hra-it-state">· not yet settled</span>';
    return '<div class="hra-detail-line ' + (sign === '+' ? 'add' : 'ded') + '">'
      + '<span>' + label
        + ' <span class="hra-it-date">' + (it.requestedAt ? when : '<em>' + when + '</em>') + '</span>'
        + state
        + (it.note ? ' <span class="hra-ap-note">· ' + _hraEsc(it.note) + '</span>' : '')
        + carried
      + '</span><span>' + sign + ' ' + _hraPeso(it.amount) + '</span></div>';
  }).join('');
}

function _hraPeso(n){
  return '₱' + Number(n||0).toLocaleString('en-PH',{minimumFractionDigits:2, maximumFractionDigits:2});
}

function toggleHRAEmployee(uname){
  _hraExpanded[uname] = !_hraExpanded[uname];
  _hraRender();
}

// ── OPERATING HOURS — the basis for lateness, half day & undertime ──
async function openOpHoursModal(){
  document.getElementById('oph-err').textContent = '';
  document.getElementById('ophours-modal').style.display = 'flex';
  try{
    const r = await api({ action:'getOperatingHours' });
    if(r.status === 'ok'){
      document.getElementById('oph-start').value   = r.officialStart;
      document.getElementById('oph-end').value     = r.officialEnd;
      document.getElementById('oph-cutoff').value  = r.staffCutoff;
      document.getElementById('oph-halfday').value = r.halfDayAfter;
      document.getElementById('oph-duty').value    = r.dutyHours;
      _ophHint();
    } else {
      document.getElementById('oph-err').textContent = r.msg || 'Could not load settings.';
    }
  }catch(e){ document.getElementById('oph-err').textContent = 'Network error: '+e.message; }
}
function closeOpHoursModal(){
  document.getElementById('ophours-modal').style.display = 'none';
}

// Spell out what the entered hours actually mean, so the effect is never a surprise
function _ophHint(){
  const el = document.getElementById('oph-hint');
  if(!el) return;
  const s = document.getElementById('oph-start').value;
  const e = document.getElementById('oph-end').value;
  const c = document.getElementById('oph-cutoff').value;
  const h = document.getElementById('oph-halfday').value;
  const d = Number(document.getElementById('oph-duty').value) || 0;
  if(!s || !e || !c || !h || !d){ el.textContent = ''; return; }
  const addH = function(t, hrs){
    const p = t.split(':'); let m = (+p[0])*60 + (+p[1]) + Math.round(hrs*60);
    m = ((m % 1440) + 1440) % 1440;
    return ('0'+Math.floor(m/60)).slice(-2) + ':' + ('0'+(m%60)).slice(-2);
  };
  el.innerHTML = 'Arriving at/after <strong>'+c+'</strong> is LATE · at/after <strong>'+h+'</strong> is HALF DAY.<br>'
    + 'Clocking out before <strong>'+e+'</strong> is UNDERTIME (daily-paid staff).<br>'
    + 'Hourly staff are paid for hours inside <strong>'+s+'–'+addH(s,d)+'</strong> ('+d+'h duty window).';
}

async function saveOpHours(){
  const err = document.getElementById('oph-err');
  const btn = document.getElementById('oph-save-btn');
  err.textContent = '';
  const payload = {
    action:'saveOperatingHours', role: currentUser.role, by: currentUser.username,
    officialStart: document.getElementById('oph-start').value,
    officialEnd:   document.getElementById('oph-end').value,
    staffCutoff:   document.getElementById('oph-cutoff').value,
    halfDayAfter:  document.getElementById('oph-halfday').value,
    dutyHours:     Number(document.getElementById('oph-duty').value) || 0
  };
  if(!payload.officialStart || !payload.officialEnd || !payload.staffCutoff || !payload.halfDayAfter){
    err.textContent = 'All four times are required.'; return;
  }
  if(!(payload.dutyHours > 0)){ err.textContent = 'Enter the duty hours in a full day.'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try{
    const r = await api(payload);
    if(r.status === 'ok'){
      closeOpHoursModal();
      showToast('Hours updated — applied from ' + (r.effectiveFrom || 'this cutoff')
        + ' and recalculated ✓','success',5500);
      await _hraLoad();          // recompute payroll with the new basis
    } else { err.textContent = r.msg || 'Could not save.'; }
  }catch(e){ err.textContent = 'Network error: '+e.message; }
  btn.disabled = false; btn.textContent = '💾 Save Hours';
}

// ── PER-DAY PAY VOID / HOLD ──────────────────────────────────────
let _payAdjCtx = null;   // {employee, date, pay}

function openPayAdjModal(employee, date, pay){
  _payAdjCtx = { employee: employee, date: date, pay: pay };
  document.getElementById('padj-who').textContent =
    employee + ' · ' + (typeof phDate==='function' ? phDate(date) : date)
    + (pay > 0 ? ' · ' + _hraPeso(pay) + ' at risk' : '');
  document.getElementById('padj-type').value = 'HOLD';
  document.getElementById('padj-reason').value = '';
  document.getElementById('padj-err').textContent = '';
  _payAdjHint();
  document.getElementById('payadj-modal').style.display = 'flex';
}
function closePayAdjModal(){
  document.getElementById('payadj-modal').style.display = 'none';
  _payAdjCtx = null;
}
function _payAdjHint(){
  const el = document.getElementById('padj-hint');
  if(!el) return;
  el.textContent = document.getElementById('padj-type').value === 'VOID'
    ? 'VOID — this day will not be paid. Use when the day should not count at all.'
    : 'HOLD — pay is withheld pending the employee’s answer. You can release it later and the day pays in full.';
}

async function savePayAdj(){
  if(!_payAdjCtx) return;
  const err = document.getElementById('padj-err');
  const btn = document.getElementById('padj-save-btn');
  err.textContent = '';
  const reason = document.getElementById('padj-reason').value.trim();
  if(!reason){ err.textContent = 'A reason is required — the employee will see and answer this.'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try{
    const r = await api({ action:'setPayAdjustment', role: currentUser.role, by: currentUser.username,
      employee: _payAdjCtx.employee, date: _payAdjCtx.date,
      type: document.getElementById('padj-type').value, reason: reason });
    if(r.status==='ok'){
      closePayAdjModal();
      showToast('Day pay held — the employee will be asked to answer','success',4500);
      await _hraLoad();
    } else { err.textContent = r.msg || 'Could not save.'; }
  }catch(e){ err.textContent = 'Network error: '+e.message; }
  btn.disabled = false; btn.textContent = '💾 Apply';
}

// ── MANUAL ADDITIONAL PAY ──────────────────────────────────────────
// Most cutoffs have none of these. Nothing shows anywhere until one exists.
let _addPayEmp = null;

function openAddPayModal(employee){
  _addPayEmp = employee;
  const s = (_hraData && _hraData.startDate) || '';
  const e = (_hraData && _hraData.endDate)   || '';
  document.getElementById('apay-who').textContent = employee;
  document.getElementById('apay-type').value   = '';
  document.getElementById('apay-amount').value = '';
  document.getElementById('apay-note').value   = '';
  // Default inside the cutoff being viewed, so the amount lands where he expects
  const today = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'}).split(' ')[0];
  const dEl = document.getElementById('apay-date');
  dEl.value = (today >= s && today <= e) ? today : e;
  dEl.min = s; dEl.max = e;
  document.getElementById('apay-cutoff').textContent =
    'Goes into the ' + ((_hraData && _hraData.period) || (s + ' to ' + e)) + ' cutoff';
  document.getElementById('apay-err').textContent = '';
  _apayHint();
  document.getElementById('addpay-modal').style.display = 'flex';
}
function closeAddPayModal(){
  document.getElementById('addpay-modal').style.display = 'none';
  _addPayEmp = null;
}
// Restate which cutoff the chosen date actually falls into — the date decides,
// not the screen you happen to be looking at.
function _apayHint(){
  const el = document.getElementById('apay-cutoff');
  if(!el || !_hraData) return;
  const v = document.getElementById('apay-date').value;
  const s = _hraData.startDate, e = _hraData.endDate;
  if(v && (v < s || v > e)){
    el.textContent = '⚠ ' + v + ' is outside the cutoff you are viewing — it will be paid in the cutoff that date belongs to, not this one.';
    el.className = 'hr-note warn';
  } else {
    el.textContent = 'Goes into the ' + (_hraData.period || (s + ' to ' + e)) + ' cutoff';
    el.className = 'hr-note';
  }
}

async function saveAddPay(){
  if(!_addPayEmp) return;
  const err = document.getElementById('apay-err');
  const btn = document.getElementById('apay-save-btn');
  err.textContent = '';
  const type = document.getElementById('apay-type').value;
  const amt  = parseFloat(document.getElementById('apay-amount').value);
  const date = document.getElementById('apay-date').value;
  if(!type)                 { err.textContent = 'Pick the type of pay.'; return; }
  if(!(amt > 0))            { err.textContent = 'Enter an amount greater than zero.'; return; }
  if(!date)                 { err.textContent = 'Pick the date this applies to.'; return; }
  btn.disabled = true; btn.textContent = 'Saving…';
  try{
    const r = await api({ action:'addAdditionalPay', role: currentUser.role,
      createdBy: currentUser.username, employee: _addPayEmp,
      type: type, amount: amt, date: date,
      note: document.getElementById('apay-note').value.trim() });
    if(r.status==='ok'){
      closeAddPayModal();
      showToast(type+' of '+_hraPeso(amt)+' added to '+r.employee+' ✓','success',4500);
      await _hraLoad();
    } else { err.textContent = r.msg || 'Could not save.'; }
  }catch(e){ err.textContent = 'Network error: '+e.message; }
  btn.disabled = false; btn.textContent = '💾 Add to pay';
}

async function cancelAdditionalPay(id){
  if(!confirm('Remove this additional pay entry?\n\nIt will be taken back out of their pay for this cutoff.')) return;
  try{
    const r = await api({ action:'cancelAdditionalPay', id: id,
      role: currentUser.role, by: currentUser.username });
    if(r.status==='ok'){ showToast('Entry removed ✓','success',3500); await _hraLoad(); }
    else alert('Error: '+(r.msg||'Could not remove'));
  }catch(e){ alert('Network error: '+e.message); }
}

async function releasePayAdj(adjustmentId, decision){
  const msg = decision === 'cancel'
    ? 'Cancel this hold? The day goes back to normal pay and the record is closed as cancelled.'
    : 'Release this hold?\n\nThe day will be paid in full again.';
  if(!confirm(msg)) return;
  try{
    const r = await api({ action:'releasePayAdjustment', adjustmentId, decision,
      role: currentUser.role, by: currentUser.username });
    if(r.status==='ok'){ showToast('Day pay restored ✓','success',4000); await _hraLoad(); }
    else alert('Error: '+(r.msg||'Could not update'));
  }catch(e){ alert('Network error: '+e.message); }
}

// ── APPROVAL INBOX — cash advances & leave awaiting your decision ──
function _hraRenderInbox(){
  const adv = _hraReqs.advances || [], lv = _hraReqs.leaves || [], rb = _hraReqs.reimbursements || [];
  const pendA = adv.filter(function(a){ return a.status==='Pending'; });
  const pendL = lv.filter(function(l){ return l.status==='Pending'; });
  const pendR = rb.filter(function(x){ return x.status==='Pending'; });
  // Approved advances still waiting to be deducted from a payout
  const owing = adv.filter(function(a){ return a.status==='Approved' && !a.settled; });
  if(!pendA.length && !pendL.length && !pendR.length && !owing.length) return '';

  let html = '';
  if(pendA.length || pendL.length || pendR.length){
    html += '<div class="hr-card">'
      + '<div class="hr-card-title">📨 Pending requests ('+(pendA.length+pendL.length+pendR.length)+')</div>';

    pendR.forEach(function(x){
      html += '<div class="hra-req">'
        + '<div class="hra-req-head"><span class="hra-req-type rmb">🧾 '+x.category.toUpperCase()+'</span>'
          + '<span class="hra-req-amt">'+_hraPeso(x.amount)+'</span></div>'
        + '<div class="hra-req-by"><strong>'+x.requestedBy+'</strong> · spent '
          + (typeof phDate==='function'?phDate(x.expenseDate):x.expenseDate)
          + (x.receipt && x.receipt.indexOf('http')===0
              ? ' · <a href="'+x.receipt+'" target="_blank" rel="noopener">view receipt</a>'
              : ' · <span style="color:#C0392B">no receipt attached</span>') + '</div>'
        + '<div class="hra-req-reason">“'+x.description+'”</div>'
        + '<div class="hra-req-note">If approved, this is added to '+x.requestedBy+'’s pay this cutoff.</div>'
        + '<div class="mov-req-actions">'
          + '<button class="mov-req-approve" onclick="resolveReimbursement(\''+x.requestId+'\',\'approve\')">✓ Approve</button>'
          + '<button class="mov-req-reject" onclick="resolveReimbursement(\''+x.requestId+'\',\'reject\')">✕ Reject</button>'
        + '</div></div>';
    });

    pendA.forEach(function(a){
      html += '<div class="hra-req">'
        + '<div class="hra-req-head"><span class="hra-req-type adv">💵 CASH ADVANCE</span>'
          + '<span class="hra-req-amt">'+_hraPeso(a.amount)+'</span></div>'
        + '<div class="hra-req-by"><strong>'+a.requestedBy+'</strong> · '
          + (typeof phDate==='function'?phDate(a.requestedAt.slice(0,10)):a.requestedAt)+'</div>'
        + '<div class="hra-req-reason">“'+a.reason+'”</div>'
        + '<div class="hra-req-note">If approved, this is deducted in full from '+a.requestedBy+'’s next payout.</div>'
        + '<div class="mov-req-actions">'
          + '<button class="mov-req-approve" onclick="resolveHRRequest(\''+a.requestId+'\',\'approve\')">✓ Approve</button>'
          + '<button class="mov-req-reject" onclick="resolveHRRequest(\''+a.requestId+'\',\'reject\')">✕ Reject</button>'
        + '</div></div>';
    });

    pendL.forEach(function(l){
      const range = (typeof phDate==='function'?phDate(l.startDate):l.startDate)
        + (l.endDate!==l.startDate ? ' – '+(typeof phDate==='function'?phDate(l.endDate):l.endDate) : '');
      html += '<div class="hra-req">'
        + '<div class="hra-req-head"><span class="hra-req-type lv">🌴 '+l.leaveType.toUpperCase()+'</span>'
          + '<span class="hra-req-amt">'+l.days+' day'+(l.days!==1?'s':'')+'</span></div>'
        + '<div class="hra-req-by"><strong>'+l.requestedBy+'</strong> · '+range+'</div>'
        + '<div class="hra-req-reason">“'+l.reason+'”</div>'
        + '<div class="mov-req-actions">'
          + '<button class="mov-req-approve" onclick="resolveHRRequest(\''+l.requestId+'\',\'approve\')">✓ Approve</button>'
          + '<button class="mov-req-reject" onclick="resolveHRRequest(\''+l.requestId+'\',\'reject\')">✕ Reject</button>'
        + '</div></div>';
    });
    html += '</div>';
  }

  // Outstanding advances — deducted from expected pay until you mark them settled
  if(owing.length){
    html += '<div class="hr-card"><div class="hr-card-title">💵 Advances still to recover ('+owing.length+')</div>'
      + '<div class="hr-note" style="margin-top:0">These are being subtracted from the expected pay below. '
      + 'Once you\'ve actually taken one out of a payout, record it against that cutoff — '
      + 'it stays a deduction there and stops carrying forward.</div>';
    owing.forEach(function(a){
      // When it was asked for, how long it has been outstanding, and which
      // cutoff it came from — without these it is impossible to tell an advance
      // from last week apart from one that has been rolling for two months.
      const d    = String(a.requestedAt||'').slice(0,10);
      const age  = _hraDaysSince(d);
      const from = _hraCutoffLabel(d);
      const stale = age !== null && age >= 15;
      html += '<div class="hra-owing">'
        + '<div><div class="hra-owing-name">'+a.requestedBy+' · <strong>'+_hraPeso(a.amount)+'</strong></div>'
        + '<div class="hra-req-by">'
          + (d ? '🕒 ' + (typeof phDate==='function'?phDate(d):d)
                 + (age !== null ? ' · ' + (age===0?'today':age===1?'1 day ago':age+' days ago') : '')
               : '🕒 no date recorded')
          + (from ? ' <span class="hra-carry'+(stale?' stale':'')+'">↪ from '+_hraEsc(from)+'</span>' : '')
          + '</div>'
        + '<div class="hra-req-by">approved by '+a.resolvedBy+'</div></div>'
        + '<button class="hra-settle-btn" onclick="settleAdvance(\''+a.requestId+'\')">Deducted from this cutoff</button>'
      + '</div>';
    });
    html += '</div>';
  }
  return html;
}

async function resolveHRRequest(requestId, decision){
  const msg = decision==='approve'
    ? (requestId.indexOf('CA-')===0
        ? 'Approve this cash advance?\n\nIt will be deducted from their next payout automatically.'
        : 'Approve this leave request?')
    : 'Reject this request? Nothing will change.';
  if(!confirm(msg)) return;
  try{
    const r = await api({ action:'resolveHRRequest', requestId, decision,
                          role: currentUser.role, by: currentUser.username });
    if(r.status==='ok'){
      showToast(decision==='approve' ? 'Approved ✓' : 'Request rejected','success',4000);
      await _hraLoad();
    } else alert('Error: '+(r.msg||'Could not resolve request'));
  }catch(e){ alert('Network error: '+e.message); }
}

async function resolveReimbursement(requestId, decision){
  const msg = decision==='approve'
    ? 'Approve this reimbursement?\n\nIt will be added to their pay for this cutoff.'
    : 'Reject this reimbursement? Nothing will be paid.';
  if(!confirm(msg)) return;
  try{
    const r = await api({ action:'resolveReimbursement', requestId, decision,
                          role: currentUser.role, by: currentUser.username });
    if(r.status==='ok'){
      showToast(decision==='approve' ? 'Reimbursement approved ✓' : 'Reimbursement rejected','success',4000);
      await _hraLoad();
    } else alert('Error: '+(r.msg||'Could not resolve'));
  }catch(e){ alert('Network error: '+e.message); }
}

async function settleAdvance(requestId){
  const period = (_hraData && _hraData.period) || 'this cutoff';
  if(!confirm('Record this advance as deducted from '+period+'?\n\n'
    + 'It stays as a deduction on '+period+' (so their payslip stays accurate) '
    + 'and stops carrying over to later cutoffs.\n\n'
    + 'Only do this once you have actually taken it out of their pay.')) return;
  try{
    const r = await api({ action:'settleCashAdvance', requestId, role: currentUser.role,
                          by: currentUser.username,
                          cutoffStart: (_hraData && _hraData.startDate) || '' });
    if(r.status==='ok'){ showToast('Recorded as deducted from this cutoff ✓','success',4500); await _hraLoad(); }
    else alert('Error: '+(r.msg||'Could not settle'));
  }catch(e){ alert('Network error: '+e.message); }
}

function _hraRender(){
  const d = _hraData;
  const el = document.getElementById('hra-content');
  const lbl = document.getElementById('hra-period-label');
  if(lbl) lbl.textContent = d.period || '';
  if(!el) return;

  // ── Payroll summary ──
  let html = '<div class="hr-card">'
    + '<div class="hr-card-title">Payroll summary</div>'
    + '<div class="hra-sum-grid">'
      + '<div class="hra-sum"><span class="hra-sum-val">'+d.headcount+'</span><span class="hra-sum-lbl">Employees</span></div>'
      + '<div class="hra-sum"><span class="hra-sum-val">'+_hraPeso(d.totalDeductions)+'</span><span class="hra-sum-lbl">Deductions</span></div>'
      + '<div class="hra-sum"><span class="hra-sum-val">'+_hraPeso(d.totalAdvances)+'</span><span class="hra-sum-lbl">Advances</span></div>'
    + '</div>'
    + '<div class="hra-total"><span>Total expected payroll</span><span>'+_hraPeso(d.totalPayroll)+'</span></div>'
    + (d.flagged > 0
        ? '<div class="hra-flag-note">⚠ '+d.flagged+' employee'+(d.flagged!==1?'s':'')
          +' need attention (missing time-out or no daily rate set).</div>' : '')
    + '<div class="hr-note">Estimate for '+d.startDate+' to '+d.endDate+', based on time records so far.</div>'
    + '</div>';

  // ── Approval inbox (pending first, then recently decided) ──
  html += _hraRenderInbox();

  // ── Per-employee ──
  if(!d.employees || !d.employees.length){
    html += '<div class="hr-card"><div class="hr-empty">No employee activity in this cutoff.</div></div>';
    el.innerHTML = html;
    return;
  }

  d.employees.forEach(function(e){
    const open = !!_hraExpanded[e.username];
    const hourly = e.payType === 'hourly';
    const needsAttention = e.incompleteDays > 0 || !e.rateSet;

    // Middle line: hourly shows hours, daily shows late/half counts
    const meta = hourly
      ? e.daysWorked+' day'+(e.daysWorked!==1?'s':'')+' · '+e.hoursPaid+'h'
        +(e.fullDays?' · '+e.fullDays+' full':'')
      : e.daysWorked+' day'+(e.daysWorked!==1?'s':'')
        +(e.lateDays?' · '+e.lateDays+' late':'')
        +(e.undertimeDays?' · '+e.undertimeDays+' undertime':'')
        +(e.halfDays?' · '+e.halfDays+' half':'');

    html += '<div class="hra-emp'+(needsAttention?' warn':'')+'">'
      + '<div class="hra-emp-head" onclick="toggleHRAEmployee(\''+e.username.replace(/'/g,"\\'")+'\')">'
        + '<div class="hra-emp-main">'
          + '<div class="hra-emp-name">'+e.username
            + '<span class="hra-badge '+(hourly?'hourly':'daily')+'">'+(hourly?'HOURLY':'DAILY')+'</span>'
            + (e.role ? '<span class="hra-role">'+e.role+'</span>' : '')
            + (e.scheduleStart ? '<span class="hra-role">'+e.scheduleStart+'–'+e.scheduleEnd+'</span>' : '')
          + '</div>'
          + '<div class="hra-emp-meta">'+meta+'</div>'
          + (e.incompleteDays > 0
              ? '<div class="hra-emp-warn">⚠ '+e.incompleteDays+' day'+(e.incompleteDays!==1?'s':'')+' missing time-out</div>' : '')
          + (!e.rateSet ? '<div class="hra-emp-warn">⚠ No daily rate set</div>' : '')
        + '</div>'
        + '<div class="hra-emp-pay">'
          + (e.rateSet ? '<div class="hra-emp-amt">'+_hraPeso(e.expected)+'</div>' : '<div class="hra-emp-amt muted">—</div>')
          + '<div class="hra-emp-toggle">'+(open?'▲ Hide':'▼ Detail')+'</div>'
        + '</div>'
      + '</div>';

    if(open){
      html += '<div class="hra-emp-detail">'
        + '<button class="hra-viewas-btn" onclick="openHR(\''+e.username.replace(/'/g,"\\'")+'\')">'
          + '👤 Open '+e.username+'’s HR — file or check on their behalf</button>'
        + '<button class="hra-addpay-btn" onclick="openAddPayModal(\''+e.username.replace(/'/g,"\\'")+'\')">'
          + '➕ Add pay (allowance, incentive…)</button>'
        + '<div class="hra-detail-line"><span>Rate</span><span>'+_hraPeso(e.dailyRate)+'/day'
          + (hourly ? ' ('+_hraPeso(e.dailyRate/d.stdHours)+'/hr)' : '')+'</span></div>'
        + (e.allowance > 0 ? '<div class="hra-detail-line add"><span>Allowance ('+e.daysWorked+' × '+_hraPeso(e.allowanceRate)+')</span><span>+ '+_hraPeso(e.allowance)+'</span></div>' : '')
        + ((e.reimbursementItems && e.reimbursementItems.length)
            ? _hraItemLines(e.reimbursementItems, 'Reimbursement', '+')
            : (e.reimbursement > 0 ? '<div class="hra-detail-line add"><span>Reimbursements</span><span>+ '+_hraPeso(e.reimbursement)+'</span></div>' : ''))
        // Manual extras — one line each, and nothing at all when there are none
        + ((e.additionalPayItems||[]).map(function(ap){
            return '<div class="hra-detail-line add"><span>'+_hraEsc(ap.type)
              + (ap.note ? ' <span class="hra-ap-note">· '+_hraEsc(ap.note)+'</span>' : '')
              + ' <span class="hra-ap-date">'+ap.date+'</span>'
              + '<button class="hra-ap-x" title="Remove this entry" onclick="cancelAdditionalPay(\''+ap.id+'\')">✕</button>'
              + '</span><span>+ '+_hraPeso(ap.amount)+'</span></div>';
          }).join(''))
        + '<div class="hra-detail-line"><span>'+(hourly?'Hours worked ('+e.hoursPaid+'h)':'Basic ('+e.daysWorked+' days)')+'</span><span>'+_hraPeso(e.gross)+'</span></div>'
        + (e.totalDeduction > 0 ? '<div class="hra-detail-line ded"><span>Deductions</span><span>− '+_hraPeso(e.totalDeduction)+'</span></div>' : '')
        + ((e.advanceItems && e.advanceItems.length)
            ? _hraItemLines(e.advanceItems, 'Cash advance', '−')
            : (e.cashAdvance > 0 ? '<div class="hra-detail-line ded"><span>Cash advance'
                + (e.advanceSettled > 0 && !e.advanceOutstanding ? ' (already deducted)' : '')
                + '</span><span>− '+_hraPeso(e.cashAdvance)+'</span></div>' : ''))
        + (e.otHours > 0 ? '<div class="hr-note">'+e.otHours+'h beyond the '+d.stdHours+'-hour duty (not auto-paid).</div>' : '')
        + '<table class="hr-day-table" style="margin-top:8px"><thead><tr>'
          + '<th>Date</th><th>In</th><th>Out</th><th>Status</th><th class="r">Pay</th>'
        + '</tr></thead><tbody>';
      (e.days||[]).forEach(function(day){
        const bad = day.incomplete === true;
        const adj = day.adjustment;
        const cls = adj ? 'half' : bad ? 'half'
                  : /half/i.test(day.status) ? 'half' : /late/i.test(day.status) ? 'late' : 'ok';
        html += '<tr>'
          + '<td>'+(typeof phDate==='function' ? phDate(day.date) : day.date)+'</td>'
          + '<td>'+(day.timeIn||'—')+'</td>'
          + '<td>'+(day.timeOut||'—')+'</td>'
          + '<td><span class="hr-flag '+cls+'">'+(bad&&!adj?'⚠ ':'')+day.status+'</span>'
            + (adj && adj.response
                ? '<div class="hra-adj-reply">💬 '+adj.response+'</div>'
                : adj ? '<div class="hra-adj-wait">awaiting employee answer</div>' : '')
            + '</td>'
          + '<td class="r">'+(e.rateSet?_hraPeso(day.pay):'—')
            + '<div class="hra-day-act">'
            + (adj
                ? '<button class="hra-mini rel" onclick="releasePayAdj(\''+adj.id+'\',\'release\')">Release</button>'
                  +'<button class="hra-mini cxl" onclick="releasePayAdj(\''+adj.id+'\',\'cancel\')">Cancel</button>'
                : '<button class="hra-mini hold" onclick="openPayAdjModal(\''+e.username.replace(/'/g,"\\'")+'\',\''+day.date+'\','+(day.pay||0)+')">Hold / Void</button>')
            + '</div></td>'
          + '</tr>';
      });
      html += '</tbody></table></div>';
    }
    html += '</div>';
  });

  el.innerHTML = html;
}
