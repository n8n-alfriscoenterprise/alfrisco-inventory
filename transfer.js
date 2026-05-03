async function openTransfer(){
  showScreen('transfer-screen');
  updateFabVisibility();
  showTrfSubtab('create', document.getElementById('trf-tab-create'));
  initTrfCreate();
  await loadTransfers();
}

function closeTransfer(){ showHome(); }

function showTrfSubtab(tab, el){
  document.querySelectorAll('.trf-subtab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  document.getElementById('trf-view-create').style.display = tab==='create'?'flex':'none';
  document.getElementById('trf-view-pending').style.display = tab==='pending'?'flex':'none';
  document.getElementById('trf-view-all').style.display    = tab==='all'?'flex':'none';
  if(tab==='pending') renderPendingTransfers();
  if(tab==='all')     renderAllTransfers();
}

// ── TRANSFER NUMBER ───────────────────────────────────
function generateTrfNumber(){
  const d = new Date();
  const date = d.getFullYear().toString() +
    String(d.getMonth()+1).padStart(2,'0') +
    String(d.getDate()).padStart(2,'0');
  const todayTrfs = trfList.filter(t=>t.trfNumber&&t.trfNumber.includes(date));
  return 'TRF-'+date+'-'+String(todayTrfs.length+1).padStart(3,'0');
}

// ── LOAD TRANSFERS ────────────────────────────────────
async function loadTransfers(){
  try{
    const r = await api({action:'getTransfers'});
    if(r.status==='ok'){
      trfList = r.transfers || [];
      updatePendingBadge();
    }
  }catch(e){ console.error('loadTransfers failed',e); }
}

function updatePendingBadge(){
  const myLoc = getCurrentUserLocation();
  const pending = trfList.filter(t=>
    t.status==='IN TRANSIT' && t.toLocation===myLoc
  ).length;
  const badge = document.getElementById('trf-pending-badge');
  if(badge){
    badge.textContent = pending;
    badge.style.display = pending>0 ? 'inline' : 'none';
  }
}

function getCurrentUserLocation(){
  if(!currentUser) return '';
  if(currentUser.role==='staff') return 'Distribution WH';
  if(currentUser.role==='staff-retail') return 'Retail Store';
  if(currentUser.role==='driver') return currentUser.assignedUnit||'Bajaj1';
  return ''; // admin sees all
}

// ── CREATE TRANSFER ───────────────────────────────────
function initTrfCreate(){
  trfLines = [];
  document.getElementById('trf-from').value = 'Distribution WH';
  document.getElementById('trf-to').value   = 'Retail Store';
  document.getElementById('trf-via').value  = 'Bajaj1';
  document.getElementById('trf-notes').value = '';
  document.getElementById('trf-create-err').textContent = '';
  const btn = document.getElementById('trf-submit-btn');
  if(btn){ btn.disabled=false; btn.textContent='Create Transfer & Mark as Dispatched'; }
  addTrfLine();
}

function swapTrfLocations(){
  const from = document.getElementById('trf-from');
  const to   = document.getElementById('trf-to');
  const tmp  = from.value;
  from.value = to.value;
  to.value   = tmp;
  onTrfRouteChange();
}

function onTrfRouteChange(){
  // Rebuild SKU datalist based on from location
  buildTrfDatalist();
  renderTrfLines();
}

function buildTrfDatalist(){
  const from = document.getElementById('trf-from').value;
  // If from Distribution WH → show DIST SKUs
  // If from Retail Store → show RETAIL SKUs
  // If from Bajaj → show both (can carry either)
  let typeFilter = null;
  if(from === 'Distribution WH') typeFilter = 'DIST';
  else if(from === 'Retail Store') typeFilter = 'RETAIL';

  const dlId = 'trf-sku-datalist';
  let dl = document.getElementById(dlId);
  if(!dl){ dl=document.createElement('datalist'); dl.id=dlId; document.body.appendChild(dl); }
  const skus = typeFilter
    ? liveSKUs.filter(s=>s.type===typeFilter)
    : liveSKUs;
  dl.innerHTML = skus.map(s=>`<option value="${s.name}" data-code="${s.code}" data-type="${s.type}">`).join('');
}

function addTrfLine(){
  trfLines.push({skuCode:'', skuName:'', qty:1, unit:'bag'});
  buildTrfDatalist();
  renderTrfLines();
  setTimeout(()=>{
    const container = document.getElementById('trf-line-items');
    if(container&&container.lastElementChild)
      container.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function removeTrfLine(idx){
  trfLines.splice(idx,1);
  renderTrfLines();
}

function renderTrfLines(){
  const container = document.getElementById('trf-line-items');
  if(!container) return;
  container.innerHTML = '';
  const countEl = document.getElementById('trf-item-count');
  if(countEl) countEl.textContent = trfLines.length+(trfLines.length===1?' item':' items');

  trfLines.forEach((line,idx)=>{
    const row = document.createElement('div');
    row.className = 'trf-line-row';
    row.id = 'trf-row-'+idx;
    row.innerHTML = `
      <div class="trf-line-num">
        Item ${idx+1}
        ${trfLines.length>1
          ?`<button class="trf-line-remove" onclick="removeTrfLine(${idx})">×</button>`:''}
      </div>
      <input type="text"
        id="trf-sku-${idx}"
        class="trf-line-sku"
        placeholder="Type to search SKU or item name..."
        list="trf-sku-datalist"
        autocomplete="off"
        value="${line.skuName||''}"
        oninput="onTrfSkuInput(${idx},this.value)">
      ${line.skuName
        ?`<div style="font-size:10px;color:#27AE60;margin-bottom:6px">✓ ${line.skuName}</div>`:''}
      <div class="trf-line-qty-row">
        <input type="number" class="trf-line-qty"
          min="1" step="1" value="${line.qty||1}"
          placeholder="Qty"
          oninput="trfLines[${idx}].qty=parseFloat(this.value)||1">
        <select class="trf-line-unit"
          onchange="trfLines[${idx}].unit=this.value">
          ${['bag','sack','box','case','pc','bottle','kg']
            .map(u=>`<option value="${u}"${line.unit===u?' selected':''}>${u}</option>`)
            .join('')}
        </select>
      </div>`;
    container.appendChild(row);
  });
}

function onTrfSkuInput(idx, val){
  const match = liveSKUs.find(s=>s.name.toLowerCase()===val.toLowerCase());
  trfLines[idx].skuName = val;
  trfLines[idx].skuCode = match ? match.code : '';
  // Update confirm without full re-render
  const row = document.getElementById('trf-row-'+idx);
  if(row){
    let confirmEl = row.querySelector('[data-trf-confirm]');
    if(!confirmEl){
      confirmEl = document.createElement('div');
      confirmEl.setAttribute('data-trf-confirm','1');
      const input = document.getElementById('trf-sku-'+idx);
      if(input) input.insertAdjacentElement('afterend', confirmEl);
    }
    confirmEl.style.fontSize='10px';
    confirmEl.style.marginBottom='6px';
    if(match){
      confirmEl.style.color='#27AE60';
      confirmEl.textContent='✓ '+match.name+' ('+match.type+')';
    } else {
      confirmEl.style.color='#bbb';
      confirmEl.textContent = val?'Type exact name or pick from suggestions':'';
    }
  }
}

async function submitTransfer(){
  const from  = document.getElementById('trf-from').value;
  const to    = document.getElementById('trf-to').value;
  const via   = document.getElementById('trf-via').value;
  const notes = document.getElementById('trf-notes').value.trim();
  const errEl = document.getElementById('trf-create-err');

  if(from===to){ errEl.textContent='From and To locations cannot be the same.'; return; }

  // Sync any partially typed names
  trfLines.forEach((line,idx)=>{
    const input = document.getElementById('trf-sku-'+idx);
    if(input&&input.value.trim()) trfLines[idx].skuName = input.value.trim();
  });

  const validLines = trfLines.filter(l=>l.skuName&&l.skuName.trim()&&l.qty>0);
  if(!validLines.length){
    errEl.textContent='Please add at least one item with a name and quantity.'; return;
  }

  const btn = document.getElementById('trf-submit-btn');
  btn.disabled=true; btn.textContent='Creating transfer...';
  errEl.textContent='';

  const trfNumber = generateTrfNumber();
  const now = new Date().toLocaleString('en-PH');

  const lineRows = validLines.map(line=>([
    trfNumber, line.skuCode||'', line.skuName,
    line.qty, line.unit, 0, line.qty,
    'Open', notes
  ]));

  try{
    const r = await api({
      action:'createTransfer',
      trfNumber, fromLocation:from, toLocation:to, via,
      status:'IN TRANSIT',
      createdBy: currentUser.username,
      createdDate: now,
      notes,
      lineItems: lineRows
    });
    if(r.status==='ok'){
      showBanner('trf-success-bar',
        `Transfer ${trfNumber} created & dispatched — ${validLines.length} item(s) via ${via}`);
      await loadTransfers();
      initTrfCreate();
    } else {
      errEl.textContent='Error: '+(r.msg||'Could not create transfer');
      btn.disabled=false;
      btn.textContent='Create Transfer & Mark as Dispatched';
    }
  }catch(e){
    errEl.textContent='Network error: '+e.message;
    btn.disabled=false;
    btn.textContent='Create Transfer & Mark as Dispatched';
  }
}

// ── PENDING TRANSFERS (for receiving staff) ───────────
function renderPendingTransfers(){
  const body = document.getElementById('trf-pending-body');
  const myLoc = getCurrentUserLocation();
  const isAdmin = currentUser && currentUser.role==='admin';

  const pending = isAdmin
    ? trfList.filter(t=>t.status==='IN TRANSIT')
    : trfList.filter(t=>t.status==='IN TRANSIT' && t.toLocation===myLoc);

  if(!pending.length){
    body.innerHTML = `<div class="trf-empty">
      No pending transfers for ${isAdmin?'any location':myLoc}.<br>
      All deliveries are up to date.
    </div>`;
    return;
  }

  body.innerHTML = '';
  pending.forEach(trf=>{
    const card = document.createElement('div');
    card.className = 'trf-card';
    card.onclick = () => openAcknowledgeView(trf.trfNumber);
    card.innerHTML = `
      <div class="trf-card-row1">
        <div>
          <div class="trf-num">${trf.trfNumber}</div>
          <div class="trf-route">
            <span style="font-weight:600">${trf.fromLocation}</span>
            <span style="color:#aaa">→</span>
            <span style="font-weight:600">${trf.toLocation}</span>
            <span style="font-size:10px;color:#aaa">via ${trf.via}</span>
          </div>
          <div class="trf-meta">${trf.createdDate} · ${trf.createdBy}</div>
        </div>
        <span class="trf-status-badge ts-transit">IN TRANSIT</span>
      </div>
      <div class="trf-card-row2">
        <span style="font-size:11px;color:#888">${trf.lineCount||0} item(s)</span>
        <span style="font-size:12px;font-weight:700;color:#3949AB">Tap to acknowledge →</span>
      </div>`;
    body.appendChild(card);
  });
}

// ── ACKNOWLEDGE RECEIPT ───────────────────────────────
async function openAcknowledgeView(trfNumber){
  try{
    const r = await api({action:'getTransferDetail', trfNumber});
    if(r.status==='ok'){
      currentTrf = {...r.transfer, lineItems: r.lineItems};
      // Show pending tab WITHOUT triggering renderPendingTransfers
      // (which would overwrite our acknowledge form)
      document.querySelectorAll('.trf-subtab').forEach(t=>t.classList.remove('active'));
      const tab = document.getElementById('trf-tab-pending');
      if(tab) tab.classList.add('active');
      document.getElementById('trf-view-create').style.display = 'none';
      document.getElementById('trf-view-pending').style.display = 'flex';
      document.getElementById('trf-view-all').style.display    = 'none';
      // Now render the form into the pending body
      renderAcknowledgeForm();
    }
  }catch(e){ alert('Could not load transfer details.'); }
}

function renderAcknowledgeForm(){
  const trf = currentTrf;
  const body = document.getElementById('trf-pending-body');

  const lineItemsHTML = (trf.lineItems||[]).map((li,i)=>{
    const remaining = Number(li.qtyDispatched||li.qtyOrdered||0) - Number(li.qtyReceived||0);
    const done = remaining <= 0;
    return `
      <div class="trf-ack-row">
        <div class="trf-ack-info">
          <div class="trf-ack-name">${li.itemName||li.skuCode}</div>
          <div class="trf-ack-dispatched">
            Dispatched: ${li.qtyDispatched||li.qtyOrdered||0} ${li.unit||'bag'}
            ${li.qtyReceived>0 ? ' · Already received: '+li.qtyReceived : ''}
          </div>
        </div>
        ${done
          ? '<span class="trf-ack-done">Received ✓</span>'
          : `<input class="trf-ack-input" type="number" min="0"
               max="${remaining}" placeholder="${remaining}"
               id="ack-qty-${i}" value="${remaining}">`}
      </div>`;
  }).join('');

  body.innerHTML = `
    <div style="padding:12px">
      <div class="trf-ack-section">
        <div class="trf-ack-header">
          <div class="trf-ack-num">${trf.trfNumber}</div>
          <div><span class="trf-status-badge ts-transit" style="font-size:11px">IN TRANSIT</span></div>
          <div class="trf-ack-meta" style="margin-top:8px">
            From: <strong>${trf.fromLocation}</strong> → To: <strong>${trf.toLocation}</strong><br>
            Via: ${trf.via} · Dispatched by: ${trf.createdBy}<br>
            ${trf.notes ? 'Notes: '+trf.notes : ''}
          </div>
        </div>
        <div style="font-size:11px;font-weight:700;color:#888;letter-spacing:0.5px;text-transform:uppercase;margin-bottom:8px">
          Enter quantities received
        </div>
        ${lineItemsHTML}
        <div class="modal-err" id="ack-err" style="margin-top:8px"></div>
        <button class="trf-ack-btn" id="trf-ack-submit-btn" onclick="submitAcknowledgment()">
          Confirm Receipt &amp; Update Inventory
        </button>
      </div>
      <button onclick="declineTransfer()"
        style="width:100%;padding:10px;background:none;border:1.5px solid #E24B4A;color:#E24B4A;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:8px">
        ✗ Decline Receipt
      </button>
      <button onclick="renderPendingTransfers()"
        style="width:100%;padding:10px;background:none;border:1.5px solid #e0e0e0;color:#888;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer">
        ← Back to pending list
      </button>
    </div>`;
}

async function submitAcknowledgment(){
  if(!currentTrf) return;
  const lines = currentTrf.lineItems||[];
  const receipts = [];

  lines.forEach((li,i)=>{
    const input = document.getElementById('ack-qty-'+i);
    if(!input) return; // already fully received
    const qty = parseFloat(input.value)||0;
    if(qty>0) receipts.push({
      skuCode: li.skuCode,
      itemName: li.itemName||li.skuCode,
      qtyReceived: qty,
      unit: li.unit||'bag',
      lineIndex: i
    });
  });

  if(!receipts.length){
    document.getElementById('ack-err').textContent='Enter received quantities for at least one item.';
    return;
  }

  const btn = document.getElementById('trf-ack-submit-btn');
  if(btn){ btn.disabled=true; btn.textContent='Updating inventory...'; }
  const errEl2 = document.getElementById('ack-err');
  if(errEl2) errEl2.textContent='';

  try{
    const r = await api({
      action: 'acknowledgeTransfer',
      trfNumber: currentTrf.trfNumber,
      receivedBy: currentUser.username,
      fromLocation: currentTrf.fromLocation,
      toLocation: currentTrf.toLocation,
      receipts
    });
    if(r.status==='ok'){
      currentTrf = null;
      await loadTransfers();
      showBanner('trf-success-bar',
        `${receipts.length} item(s) acknowledged — inventory updated for ${r.toLocation||'destination'}`);
      // Now safe to call showTrfSubtab — currentTrf is null so no form to protect
      showTrfSubtab('pending', document.getElementById('trf-tab-pending'));
    } else {
      const errEl3 = document.getElementById('ack-err');
      if(errEl3) errEl3.textContent='Error: '+(r.msg||'Could not submit');
      if(btn){ btn.disabled=false; btn.textContent='Confirm Receipt & Update Inventory'; }
    }
  }catch(e){
    const errEl4 = document.getElementById('ack-err');
    if(errEl4) errEl4.textContent='Network error: '+e.message;
    if(btn){ btn.disabled=false; btn.textContent='Confirm Receipt & Update Inventory'; }
  }
}


// ── DECLINE + CANCEL TRANSFERS ────────────────────────
async function declineTransfer(){
  if(!currentTrf) return;
  const reason = prompt(
    'Reason for declining this transfer (required):\n' +
    currentTrf.trfNumber + ' — ' +
    currentTrf.fromLocation + ' → ' + currentTrf.toLocation
  );
  if(reason === null) return; // user cancelled prompt
  if(!reason.trim()){
    alert('Please enter a reason for declining.');
    return;
  }
  const btn = document.getElementById('trf-ack-submit-btn');
  if(btn){ btn.disabled=true; }

  try{
    const r = await api({
      action: 'declineTransfer',
      trfNumber: currentTrf.trfNumber,
      declinedBy: currentUser.username,
      reason: reason.trim()
    });
    if(r.status==='ok'){
      currentTrf = null;
      await loadTransfers();
      showBanner('trf-success-bar',
        `Transfer ${r.trfNumber} declined — sender has been notified in the log`);
      showTrfSubtab('pending', document.getElementById('trf-tab-pending'));
    } else {
      alert('Error: '+(r.msg||'Could not decline transfer'));
      if(btn){ btn.disabled=false; }
    }
  }catch(e){
    alert('Network error: '+e.message);
    if(btn){ btn.disabled=false; }
  }
}

async function cancelTransfer(trfNumber){
  const reason = prompt('Reason for cancelling ' + trfNumber + ' (optional):');
  if(reason === null) return; // user cancelled prompt
  try{
    const r = await api({
      action: 'cancelTransfer',
      trfNumber,
      cancelledBy: currentUser.username,
      reason: reason.trim()
    });
    if(r.status==='ok'){
      await loadTransfers();
      showBanner('trf-success-bar', trfNumber + ' cancelled');
      renderAllTransfers();
    } else {
      alert('Error: '+(r.msg||'Could not cancel'));
    }
  }catch(e){
    alert('Network error: '+e.message);
  }
}

// ── ALL TRANSFERS LIST ────────────────────────────────
function renderAllTransfers(){
  const statuses = ['All','IN TRANSIT','RECEIVED','PARTIAL','CANCELLED','DECLINED'];
  const counts = {};
  trfList.forEach(t=>{ counts[t.status]=(counts[t.status]||0)+1; });

  const chips = document.getElementById('trf-status-chips');
  chips.innerHTML = '';
  statuses.forEach(s=>{
    const cnt = s==='All' ? trfList.length : (counts[s]||0);
    if(s!=='All'&&cnt===0) return;
    const c = document.createElement('div');
    c.className = 'trf-chip'+(s===trfFilter?' active':'');
    c.textContent = s==='All'?`All (${cnt})`:`${s} (${cnt})`;
    c.onclick = ()=>{ trfFilter=s; renderAllTransfers(); };
    chips.appendChild(c);
  });

  const body = document.getElementById('trf-all-body');
  const visible = trfFilter==='All'
    ? trfList
    : trfList.filter(t=>t.status===trfFilter);

  if(!visible.length){
    body.innerHTML='<div class="trf-empty">No transfers found.</div>';
    return;
  }
  body.innerHTML='';
  visible.sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
  visible.forEach(trf=>{
    const statusCls = {
      'PENDING':'ts-pending','IN TRANSIT':'ts-transit',
      'PARTIAL':'ts-partial','RECEIVED':'ts-received',
      'CANCELLED':'ts-cancelled','DECLINED':'ts-declined'
    }[trf.status]||'ts-pending';
    const card = document.createElement('div');
    card.className='trf-card';
    card.innerHTML=`
      <div class="trf-card-row1">
        <div>
          <div class="trf-num">${trf.trfNumber}</div>
          <div class="trf-route">
            <span style="font-weight:600">${trf.fromLocation}</span>
            <span style="color:#aaa">→</span>
            <span style="font-weight:600">${trf.toLocation}</span>
            <span style="font-size:10px;color:#aaa">via ${trf.via}</span>
          </div>
          <div class="trf-meta">${trf.createdDate} · ${trf.createdBy}</div>
        </div>
        <span class="trf-status-badge ${statusCls}">${trf.status}</span>
      </div>
      <div class="trf-card-row2">
        <span style="font-size:11px;color:#888">${trf.lineCount||0} item(s)</span>
        ${trf.receivedBy?`<span style="font-size:11px;color:#27AE60">Rcvd by ${trf.receivedBy}</span>`:''}
        ${trf.status==='IN TRANSIT'&&(currentUser.role==='admin'||trf.createdBy===currentUser.username)
          ?`<button onclick="event.stopPropagation();cancelTransfer('${trf.trfNumber}')"
              style="font-size:10px;background:none;border:1px solid #ccc;color:#888;padding:2px 8px;border-radius:6px;cursor:pointer">
              Cancel
            </button>`:''}
      </div>`;
    body.appendChild(card);
  });
}


// ════════════════════════════════════════════════════════
// PRODUCT LIST — read-only catalog with price + stock
// ════════════════════════════════════════════════════════
let plData = {dist:[], retail:[]};  // {sku, name, category, price, stock, unit, lastUpdated}
let plTab = 'dist';
let plCat = 'All';
let plSearch = '';
let plLoaded = false;

