function generatePONumber(){
  const d=new Date();const date=d.getFullYear().toString()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const todayPOs=poList.filter(p=>p.poNumber&&p.poNumber.includes(date));
  return 'PO-'+date+'-'+String(todayPOs.length+1).padStart(3,'0');
}

async function openPO(){
  showScreen('po-screen');updateFabVisibility();
  showPOSubtab('list',document.getElementById('po-tab-list'));
  await loadPOs();
}

function closePO(){showHome();}

function showPOSubtab(tab,el){
  document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  document.getElementById('po-view-list').style.display=tab==='list'?'flex':'none';
  document.getElementById('po-view-create').style.display=tab==='create'?'flex':'none';
  document.getElementById('po-view-detail').style.display=tab==='detail'?'flex':'none';
  if(tab==='create')initPOCreate();
  if(tab==='list')loadPOs();
}

async function loadPOs(){
  try{
    const r=await api({action:'getPOs'});
    if(r.status==='ok'){poList=r.pos||[];buildPOStatusChips();renderPOList();
      const pending=poList.filter(p=>p.status==='PENDING').length;
      const badge=document.getElementById('po-pending-badge');
      if(badge){badge.textContent=pending;badge.style.display=pending>0?'block':'none';}
    }
  }catch(e){document.getElementById('po-list-body').innerHTML='<div class="po-list-empty">Could not load POs.</div>';}
}

async function loadPendingBadge(){
  try{const r=await api({action:'getPOs'});if(r.status==='ok'){poList=r.pos||[];const pending=poList.filter(p=>p.status==='PENDING').length;const badge=document.getElementById('po-pending-badge');if(badge){badge.textContent=pending;badge.style.display=pending>0?'block':'none';}}}catch(e){}
}

function buildPOStatusChips(){
  const bar=document.getElementById('po-status-chips');
  const statuses=['All','DRAFT','PENDING','APPROVED','PARTIAL','RECEIVED','REJECTED','CANCELLED'];
  const counts={};poList.forEach(p=>{counts[p.status]=(counts[p.status]||0)+1;});
  bar.innerHTML='';
  statuses.forEach(s=>{
    const cnt=s==='All'?poList.length:(counts[s]||0);
    if(s!=='All'&&cnt===0)return;
    const c=document.createElement('div');c.className='po-chip'+(s===poFilter?' active':'');
    c.textContent=s==='All'?'All ('+cnt+')':s+' ('+cnt+')';
    c.onclick=()=>{poFilter=s;buildPOStatusChips();renderPOList();};
    bar.appendChild(c);
  });
}

function renderPOList(){
  const body=document.getElementById('po-list-body');
  const _isAdm2=currentUser.role==='admin';
  const _canDist2=_isAdm2||currentUser.canManagePODist===true||currentUser.role==='staff';
  const _canRet2=_isAdm2||currentUser.canManagePORetail===true||currentUser.role==='staff-retail';
  const canSee=_isAdm2?poList:poList.filter(p=>{
    if(p.type==='DIST'&&_canDist2)return true;
    if(p.type==='RETAIL'&&_canRet2)return true;
    if(p.createdBy===currentUser.username)return true;
    return false;
  });
  const visible=poFilter==='All'?canSee:canSee.filter(p=>p.status===poFilter);
  if(!visible.length){body.innerHTML='<div class="po-list-empty">No purchase orders found.<br>Tap "+ New PO" to create one.</div>';return;}
  body.innerHTML='';
  visible.sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
  visible.forEach(po=>{
    const card=document.createElement('div');card.className='po-card';card.onclick=()=>openPODetail(po.poNumber);
    const statusCls={DRAFT:'s-draft',PENDING:'s-pending',APPROVED:'s-approved',PARTIAL:'s-partial',RECEIVED:'s-received',REJECTED:'s-rejected',CANCELLED:'s-cancelled'}[po.status]||'s-draft';
    card.innerHTML=`<div class="po-card-row1"><div><div class="po-number">${po.poNumber}</div><div class="po-supplier">${po.supplier} · ${po.type}</div><div class="po-meta">${po.createdDate} · ${po.createdBy}</div></div><span class="po-status-badge ${statusCls}">${po.status}</span></div><div class="po-card-row2"><span style="font-size:11px;color:#888">${po.lineCount||0} item(s)</span><span class="po-total">₱${Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>`;
    body.appendChild(card);
  });
}

function initPOCreate(){
  poLineItems=[];
  const _isAdm=currentUser.role==='admin';
  const hasDist  =_isAdm||currentUser.canManagePODist===true;
  const hasRetail=_isAdm||currentUser.canManagePORetail===true;
  const typeEl=document.getElementById('po-type');
  if(typeEl){
    Array.from(typeEl.options).forEach(function(opt){
      if(opt.value==='DIST')   opt.hidden=!hasDist;
      if(opt.value==='RETAIL') opt.hidden=!hasRetail;
    });
    typeEl.value=hasDist?'DIST':'RETAIL';
  }
  document.getElementById('po-notes').value='';
  document.getElementById('po-delivery-date').value='';
  const errEl=document.getElementById('po-create-err');
  if(errEl)errEl.textContent='';
  onPOTypeChange();renderPOLineItems();updatePOTotals();
}

function onPOSupplierChange(){
  // Rebuild ALL existing line item dropdowns when supplier changes
  if(!poLineItems.length) return;
  const type     = document.getElementById('po-type').value;
  const supplier = document.getElementById('po-supplier').value;

  poLineItems.forEach((line, idx) => {
    if(line.removed) return;
    const sel = document.querySelector(`#po-line-${idx} select`);
    if(!sel) return;

    // Rebuild options for this line
    const filtered = liveSKUs.filter(s => s.type === type && s.supplier === supplier);
    const unassigned = liveSKUs.filter(s =>
      s.type === type && (!s.supplier || s.supplier.trim() === '')
    );
    const cats = [...new Set(filtered.map(s=>s.category))];
    let skuOpts = '<option value="">-- Select item --</option>';
    skuOpts += cats.map(cat=>{
      const items = filtered.filter(s=>s.category===cat)
        .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
        .join('');
      return items ? `<optgroup label="📦 ${cat}">${items}</optgroup>` : '';
    }).join('');
    if(unassigned.length){
      const uItems = unassigned
        .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
        .join('');
      skuOpts += `<optgroup label="⚠️ No Supplier Assigned">${uItems}</optgroup>`;
    }
    sel.innerHTML = skuOpts;

    // Re-select current value if it still exists for this supplier
    if(line.skuCode){
      const matchOpt = sel.querySelector(`option[value="${line.skuCode}|${line.skuName}"]`);
      if(matchOpt){
        sel.value = `${line.skuCode}|${line.skuName}`;
      } else {
        // SKU not in new supplier — clear it
        sel.value = '';
        poLineItems[idx].skuCode = '';
        poLineItems[idx].skuName = '';
        poLineItems[idx].unitCost = 0;
        const costInput = document.querySelector(`#po-line-${idx} .po-line-cost`);
        if(costInput) costInput.value = '';
        updatePOTotals();
      }
    }
  });
}

function onPOTypeChange(){
  const type = document.getElementById('po-type').value;
  const sup  = document.getElementById('po-supplier');
  const assignedSups = [...new Set(liveSKUs.filter(s=>s.type===type&&s.supplier).map(s=>s.supplier))].sort();
  const allSups = type==='DIST' ? DIST_SUPPLIERS : RETAIL_SUPPLIERS;
  const supList = assignedSups.length > 0 ? assignedSups : allSups;
  sup.innerHTML = supList.map(s=>`<option value="${s}">${s}</option>`).join('');
  // Clear all line items when type changes — SKUs are different
  if(poLineItems.length > 0){
    if(confirm('Changing type will clear all current line items. Continue?')){
      poLineItems = [];
      renderPOLineItems();
      updatePOTotals();
    } else {
      // Revert type selection
      document.getElementById('po-type').value = type === 'DIST' ? 'RETAIL' : 'DIST';
    }
  }
}

function addPOLineItem(){
  const type=document.getElementById('po-type').value;
  const supplier=document.getElementById('po-supplier').value;
  // Filter strictly to selected supplier — no fallback bleed-through
  const filtered = liveSKUs.filter(s => {
    if(s.type !== type) return false;
    return s.supplier === supplier;
  });
  // SKUs with no supplier assigned shown in separate group
  const unassigned = liveSKUs.filter(s =>
    s.type === type && (!s.supplier || s.supplier.trim() === '')
  );

  const cats = [...new Set(filtered.map(s=>s.category))];
  let skuOpts = cats.map(cat=>{
    const items = filtered.filter(s=>s.category===cat)
      .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
      .join('');
    return items ? `<optgroup label="📦 ${cat}">${items}</optgroup>` : '';
  }).join('');

  if(unassigned.length){
    const uItems = unassigned
      .map(s=>`<option value="${s.code}|${s.name}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
      .join('');
    skuOpts += `<optgroup label="⚠️ No Supplier Assigned">${uItems}</optgroup>`;
  }

  if(!filtered.length && !unassigned.length){
    skuOpts = '<option value="" disabled>No SKUs found for this supplier</option>';
  }
  const idx=poLineItems.length;poLineItems.push({skuCode:'',skuName:'',qty:1,unitCost:0,unit:'bag'});
  const div=document.createElement('div');div.className='po-line-item';div.id='po-line-'+idx;
  div.innerHTML=`<div class="po-line-info"><select style="width:100%;padding:6px 8px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:11px;outline:none;color:#222;background:white" onchange="onPOLineSelect(${idx},this)"><option value="">-- Select item --</option>${skuOpts}</select></div><div class="po-line-inputs"><div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:9px;color:#aaa;margin-bottom:2px">Qty</span><input class="po-line-qty" type="number" min="1" value="1" oninput="onPOLineQty(${idx},this.value)"></div><div style="display:flex;flex-direction:column;align-items:center"><span style="font-size:9px;color:#aaa;margin-bottom:2px">Unit cost ₱</span><input class="po-line-cost" type="number" min="0" placeholder="0.00" oninput="onPOLineCost(${idx},this.value)"></div></div><button class="po-line-del" onclick="removePOLine(${idx})">×</button>`;
  document.getElementById('po-line-items').appendChild(div);updatePOTotals();
}

function onPOLineSelect(idx,sel){if(!sel.value)return;const parts=sel.value.split('|');poLineItems[idx].skuCode=parts[0];poLineItems[idx].skuName=parts[1]||parts[0];const skuData=liveSKUs.find(s=>s.code===parts[0]);if(skuData&&skuData.cost){poLineItems[idx].unitCost=skuData.cost;const costInput=document.querySelector('#po-line-'+idx+' .po-line-cost');if(costInput)costInput.value=skuData.cost;}updatePOTotals();}
function onPOLineQty(idx,val){poLineItems[idx].qty=parseFloat(val)||0;updatePOTotals();}
function onPOLineCost(idx,val){poLineItems[idx].unitCost=parseFloat(val)||0;updatePOTotals();}
function removePOLine(idx){poLineItems[idx]={removed:true};const el=document.getElementById('po-line-'+idx);if(el)el.remove();updatePOTotals();}
function renderPOLineItems(){document.getElementById('po-line-items').innerHTML='';poLineItems=[];}
function updatePOTotals(){const active=poLineItems.filter(l=>!l.removed&&l.skuCode);const total=active.reduce((s,l)=>s+(l.qty*l.unitCost),0);document.getElementById('po-item-count').textContent=active.length;document.getElementById('po-grand-total').textContent='₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2});}
async function savePODraft(){await savePO('DRAFT');}
async function submitPOForApproval(){await savePO('PENDING');}
async function savePO(status){
  const type=document.getElementById('po-type').value;const supplier=document.getElementById('po-supplier').value;const notes=document.getElementById('po-notes').value.trim();const delivDate=document.getElementById('po-delivery-date').value;
  const active=poLineItems.filter(l=>!l.removed&&l.skuCode);
  if(!supplier){alert('Please select a supplier.');return;}if(active.length===0){alert('Please add at least one line item.');return;}
  const poNumber=generatePONumber();const now=new Date().toLocaleString('en-PH');const total=active.reduce((s,l)=>s+(l.qty*l.unitCost),0);
  try{
    const r=await api({action:'createPO',poNumber,type,supplier,status,createdBy:currentUser.username,createdDate:now,deliveryDate:delivDate,notes,totalValue:total,lineItems:active.map(l=>[poNumber,l.skuCode,l.skuName,'',l.qty,'bag',l.unitCost,l.qty*l.unitCost,0,l.qty,'Open'])});
    if(r.status==='ok'){showBanner('po-success-bar','PO '+poNumber+' '+(status==='DRAFT'?'saved as draft':'submitted for approval'));poLineItems=[];await loadPOs();showPOSubtab('list',document.getElementById('po-tab-list'));}
    else{alert('Error: '+(r.msg||'Could not save PO'));}
  }catch(e){alert('Network error: '+e.message);}
}

async function openPODetail(poNumber){
  try{const r=await api({action:'getPODetail',poNumber});if(r.status==='ok'){currentPO={...r.po,lineItems:r.lineItems};renderPODetail();document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));document.getElementById('po-view-list').style.display='none';document.getElementById('po-view-create').style.display='none';const detail=document.getElementById('po-view-detail');detail.style.display='flex';detail.style.flexDirection='column';}}catch(e){alert('Could not load PO details.');}
}

function renderPODetail(){
  const po = currentPO;
  const isAdmin = currentUser.role === 'admin';
  const isCreator = po.createdBy === currentUser.username;
  const canReceive = isAdmin
    || (po.type==='DIST'   && (currentUser.canManagePODist===true   || currentUser.role==='staff'))
    || (po.type==='RETAIL' && (currentUser.canManagePORetail===true || currentUser.role==='staff-retail'));
  const canCancel = isAdmin
    || (isCreator && ['DRAFT','PENDING'].includes(po.status));
  const canResubmit = isCreator && po.status === 'REJECTED';

  const statusCls = {
    DRAFT:'s-draft', PENDING:'s-pending', APPROVED:'s-approved',
    PARTIAL:'s-partial', RECEIVED:'s-received',
    REJECTED:'s-rejected', CANCELLED:'s-cancelled'
  }[po.status] || '';

  const body = document.getElementById('po-detail-body');
  body.innerHTML = '';

  // ── REJECTION BANNER (visible to creator on REJECTED) ──
  if(po.status === 'REJECTED' && po.rejectionReason){
    const rb = document.createElement('div');
    rb.className = 'po-rejection-banner';
    rb.innerHTML = '<div class="po-rejection-title">⛔ PO Rejected</div>'
      + '<div class="po-rejection-comment">' + po.rejectionReason + '</div>'
      + '<div class="po-resubmit-note">Please review the comment above, update the PO as needed, then tap Resubmit for Re-approval.</div>';
    body.appendChild(rb);
  }

  // ── APPROVED BANNER (visible to creator on APPROVED) ──
  if(po.status === 'APPROVED' && isCreator && !isAdmin){
    const ab = document.createElement('div');
    ab.className = 'po-approved-banner';
    ab.innerHTML = '<div class="po-approved-title">✅ PO Approved</div>'
      + '<div style="font-size:12px;color:#1B5E20">Your PO has been approved'
      + (po.paymentTermsDays ? ' with ' + po.paymentTermsDays + '-day payment terms' : '')
      + (po.dueDate ? ' — due by <strong>' + po.dueDate + '</strong>' : '') + '.'
      + ' Proceed to receive items when goods arrive.</div>';
    body.appendChild(ab);
  }

  // ── HEADER ──
  const hdr = document.createElement('div');
  hdr.className = 'po-detail-header';
  hdr.innerHTML = '<div class="po-detail-num">' + po.poNumber + '</div>'
    + '<div><span class="po-status-badge ' + statusCls + '">' + po.status + '</span></div>'
    + '<div class="po-detail-meta" style="margin-top:8px">'
    + 'Supplier: <strong>' + po.supplier + '</strong><br>'
    + 'Type: ' + po.type + ' &nbsp;·&nbsp; Created: ' + po.createdDate + '<br>'
    + 'Created by: ' + po.createdBy
    + (po.approvedBy ? '<br>Approved by: ' + po.approvedBy : '')
    + (po.paymentMode ? '<br>Payment: ' + po.paymentMode
        + (po.chequeRef ? ' — Cheque #' + po.chequeRef : '')
        + (po.dueDate ? ' — Due: <strong>' + po.dueDate + '</strong>' : '') : '')
    + (po.docRef ? '<br>Doc Ref #: <strong>' + po.docRef + '</strong>' : '')
    + '<br>Total: <strong>₱' + Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2}) + '</strong>'
    + (po.notes ? '<br>Notes: ' + po.notes : '')
    + '</div>';
  body.appendChild(hdr);

  // ── APPROVAL SECTION (admin only, PENDING status) ──
  if(isAdmin && po.status === 'PENDING'){
    const approvalDiv = document.createElement('div');
    approvalDiv.innerHTML = ''
      // Payment terms
      + '<div class="po-payment-section">'
        + '<div class="po-payment-title">Payment Terms</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Terms (days)</span>'
            + '<select class="po-payment-select" id="po-terms-days" onchange="updatePODueDate()">'
              + '<option value="">-- Select --</option>'
              + ['7','15','30','45','60'].map(d => '<option value="' + d + '">' + d + ' days</option>').join('')
            + '</select>'
          + '</div>'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Due date (auto)</span>'
            + '<div class="po-due-date-display" id="po-due-date-display">—</div>'
          + '</div>'
        + '</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Mode of payment</span>'
            + '<select class="po-payment-select" id="po-payment-mode" onchange="onPOPaymentModeChange()">'
              + '<option value="">-- Select --</option>'
              + ['Cheque','Cash Out','GCash','Maya','Bank Transfer']
                .map(m => '<option value="' + m + '">' + m + '</option>').join('')
            + '</select>'
          + '</div>'
          + '<div class="po-payment-field" id="po-cheque-field" style="display:none">'
            + '<span class="po-payment-label">Cheque ref # (10 chars)</span>'
            + '<input class="po-cheque-ref" id="po-cheque-ref" type="text" maxlength="10" placeholder="XXXXXXXXXX">'
          + '</div>'
        + '</div>'
      + '</div>'
      // Reject reason (hidden until Reject tapped)
      + '<div class="po-reject-section" id="po-reject-section">'
        + '<div class="po-reject-title">Rejection reason (required)</div>'
        + '<textarea class="po-reject-textarea" id="po-reject-reason" placeholder="Explain why this PO is being rejected and what changes are needed..."></textarea>'
        + '<div class="modal-err" id="po-reject-err" style="margin-top:4px"></div>'
      + '</div>'
      // Action buttons
      + '<div class="po-action-row">'
        + '<button class="po-btn po-btn-success" onclick="approvePO()">✓ Approve</button>'
        + '<button class="po-btn po-btn-danger" id="po-reject-toggle-btn" onclick="toggleRejectSection()">✗ Reject</button>'
        + '<button class="po-btn po-btn-danger" id="po-reject-confirm-btn" onclick="rejectPO()" style="display:none">Confirm Rejection</button>'
      + '</div>';
    body.appendChild(approvalDiv);
  }

  // ── RESUBMIT (creator on REJECTED) ──
  if(canResubmit){
    const rsDiv = document.createElement('div');
    rsDiv.innerHTML = '<div class="po-action-row">'
      + '<button class="po-btn po-btn-primary" onclick="resubmitPO()">↩ Resubmit for Approval</button>'
      + '<button class="po-btn po-btn-secondary" onclick="cancelPO()">Cancel PO</button>'
      + '</div>';
    body.appendChild(rsDiv);
  }

  // ── RECEIPT SECTION (on APPROVED/PARTIAL, for receiving staff) ──
  if(canReceive && ['APPROVED','PARTIAL'].includes(po.status)){
    const rcptDiv = document.createElement('div');
    rcptDiv.className = 'po-receipt-header';
    rcptDiv.innerHTML = '<div class="po-receipt-title">📦 Delivery Acknowledgment</div>'
      + '<span class="po-payment-label">Document Ref # &nbsp;<span style="font-size:10px;color:#aaa">(DR / SI / AR — whichever applies)</span></span>'
      + '<input class="po-doc-ref-input" id="po-doc-ref" type="text" maxlength="30" placeholder="e.g. DR-2026-001234">';
    body.appendChild(rcptDiv);
  }

  // ── LINE ITEMS ──
  const itemsSection = document.createElement('div');
  itemsSection.className = 'po-detail-section';
  const canEdit = canReceive && ['APPROVED','PARTIAL'].includes(po.status);

  let lineHTML = '<div class="po-detail-section-title">Line Items</div>';

  if(canEdit){
    lineHTML += '<div style="font-size:10px;color:#888;margin-bottom:8px">'
      + 'Qty and unit cost are editable — adjust for price changes or partial returns.</div>';
  }

  (po.lineItems||[]).forEach((li, i) => {
    const outstanding = Number(li.qtyOutstanding) || (Number(li.qtyOrdered) - Number(li.qtyReceived||0));
    const received    = Number(li.qtyReceived||0);
    const isFull      = outstanding <= 0;
    const defaultCost = Number(li.unitCost||0);

    lineHTML += '<div class="po-receive-row">'
      + '<div class="po-receive-info">'
        + '<div class="po-receive-name">' + (li.itemName||li.skuCode) + '</div>'
        + '<div class="po-receive-ordered">Ordered: ' + li.qtyOrdered
          + ' &nbsp;·&nbsp; Received: ' + received
          + ' &nbsp;·&nbsp; Outstanding: ' + outstanding + '</div>'
      + '</div>';

    if(isFull){
      lineHTML += '<span class="po-received-badge">Received ✓</span>';
    } else if(canEdit){
      lineHTML += '<input class="po-recv-qty" type="number" min="0" max="' + outstanding + '"'
          + ' placeholder="' + outstanding + '" id="recv-qty-' + i + '" value="' + outstanding + '">'
        + '<input class="po-recv-cost" type="number" min="0" step="0.01"'
          + ' placeholder="cost" id="recv-cost-' + i + '" value="' + defaultCost + '">';
    }

    lineHTML += '</div>';
  });

  itemsSection.innerHTML = lineHTML;
  body.appendChild(itemsSection);

  // ── RECEIVE BUTTON ──
  if(canReceive && ['APPROVED','PARTIAL'].includes(po.status)){
    const recvDiv = document.createElement('div');
    recvDiv.className = 'po-action-row';
    recvDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="receiveItems()">📦 Confirm Receipt &amp; Update Inventory</button>';
    body.appendChild(recvDiv);
  }

  // ── CANCEL (non-received statuses, authorized) ──
  if(canCancel && !canResubmit && !['RECEIVED','CANCELLED','REJECTED'].includes(po.status)
     && !(isAdmin && po.status==='PENDING')){
    const cancelDiv = document.createElement('div');
    cancelDiv.className = 'po-action-row';
    cancelDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="cancelPO()">Cancel PO</button>';
    body.appendChild(cancelDiv);
  }

  // ── BACK ──
  const backDiv = document.createElement('div');
  backDiv.className = 'po-action-row';
  backDiv.style.marginTop = '4px';
  backDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="backToPOList()">← Back to list</button>';
  body.appendChild(backDiv);
}

function updatePODueDate(){
  const days  = parseInt(document.getElementById('po-terms-days').value) || 0;
  const el    = document.getElementById('po-due-date-display');
  if(!el) return;
  if(!days){ el.textContent = '—'; return; }
  const due = new Date();
  due.setDate(due.getDate() + days);
  el.textContent = due.toLocaleDateString('en-PH',{year:'numeric',month:'short',day:'numeric'});
}

function onPOPaymentModeChange(){
  const mode  = document.getElementById('po-payment-mode').value;
  const field = document.getElementById('po-cheque-field');
  if(field) field.style.display = mode === 'Cheque' ? 'block' : 'none';
}

function toggleRejectSection(){
  const sec   = document.getElementById('po-reject-section');
  const tog   = document.getElementById('po-reject-toggle-btn');
  const conf  = document.getElementById('po-reject-confirm-btn');
  if(!sec) return;
  const showing = sec.style.display !== 'none';
  sec.style.display  = showing ? 'none' : 'block';
  tog.style.display  = showing ? 'inline-flex' : 'none';
  conf.style.display = showing ? 'none' : 'inline-flex';
}

function backToPOList(){currentPO=null;document.getElementById('po-view-detail').style.display='none';showPOSubtab('list',document.getElementById('po-tab-list'));}
async function approvePO(){
  const days    = document.getElementById('po-terms-days') ? document.getElementById('po-terms-days').value : '';
  const mode    = document.getElementById('po-payment-mode') ? document.getElementById('po-payment-mode').value : '';
  const cheque  = document.getElementById('po-cheque-ref') ? document.getElementById('po-cheque-ref').value.trim().toUpperCase() : '';
  const dueDisp = document.getElementById('po-due-date-display') ? document.getElementById('po-due-date-display').textContent : '';

  if(mode==='Cheque' && cheque.length!==10){
    alert('Cheque reference must be exactly 10 characters.');return;
  }
  if(!confirm('Approve '+currentPO.poNumber+'?'))return;
  try{
    const r=await api({
      action:'approvePO',
      poNumber:currentPO.poNumber,
      approvedBy:currentUser.username,
      paymentTermsDays:days||'',
      paymentMode:mode||'',
      chequeRef:cheque||'',
      dueDate:dueDisp&&dueDisp!=='—'?dueDisp:''
    });
    if(r.status==='ok'){
      showBanner('po-success-bar','PO '+currentPO.poNumber+' approved'+(mode?' — '+mode+' payment':'')+' ✓');
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Network error');}
}
async function rejectPO(){
  const reasonEl = document.getElementById('po-reject-reason');
  const errEl    = document.getElementById('po-reject-err');
  const reason   = reasonEl ? reasonEl.value.trim() : '';
  if(!reason){
    if(errEl) errEl.textContent = 'Please enter a rejection reason — the creator needs this to make corrections.';
    return;
  }
  if(!confirm('Reject '+currentPO.poNumber+'? The creator will be notified to review your comment.'))return;
  try{
    const r=await api({action:'rejectPO',poNumber:currentPO.poNumber,rejectedBy:currentUser.username,reason});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO rejected — '+currentPO.createdBy+' has been notified');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Network error');}
}

async function resubmitPO(){
  if(!confirm('Resubmit '+currentPO.poNumber+' for approval? Make sure you have addressed the rejection comments.'))return;
  try{
    const r=await api({action:'resubmitPO',poNumber:currentPO.poNumber,resubmittedBy:currentUser.username});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO resubmitted for approval ✓');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Network error');}
}
async function cancelPO(){if(!confirm('Cancel '+currentPO.poNumber+'? This cannot be undone.'))return;try{const r=await api({action:'cancelPO',poNumber:currentPO.poNumber,cancelledBy:currentUser.username});if(r.status==='ok'){showBanner('po-success-bar','PO cancelled');await openPODetail(currentPO.poNumber);await loadPOs();}else alert('Error: '+r.msg);}catch(e){alert('Network error');}}
async function receiveItems(){
  const lines = currentPO.lineItems || [];
  const receipts = [];
  const docRef = document.getElementById('po-doc-ref') ? document.getElementById('po-doc-ref').value.trim() : '';

  lines.forEach((li, i)=>{
    const qtyInput  = document.getElementById('recv-qty-'+i);
    const costInput = document.getElementById('recv-cost-'+i);
    if(!qtyInput) return; // already fully received
    const qty  = parseFloat(qtyInput.value)  || 0;
    const cost = parseFloat(costInput ? costInput.value : li.unitCost) || Number(li.unitCost) || 0;
    if(qty > 0) receipts.push({
      skuCode:     li.skuCode,
      itemName:    li.itemName||li.skuCode,
      qtyReceived: qty,
      unitCost:    cost,
      lineIndex:   i
    });
  });

  if(!receipts.length){ alert('Enter quantities to receive for at least one item.'); return; }

  const confirmMsg = receipts.map(r =>
    r.qtyReceived + ' x ' + r.itemName + ' @ ₱' + Number(r.unitCost).toLocaleString('en-PH',{minimumFractionDigits:2})
  ).join('\n');

  if(!confirm('Confirm receipt of:\n\n' + confirmMsg + '\n\nThis will update inventory stock counts as STOCK IN.')) return;

  try{
    const r = await api({
      action:      'receivePO',
      poNumber:    currentPO.poNumber,
      receivedBy:  currentUser.username,
      poType:      currentPO.type,
      docRef:      docRef,
      receipts
    });
    if(r.status==='ok'){
      const summary = receipts.length + ' item(s) received'
        + (docRef ? ' — Doc Ref: ' + docRef : '')
        + ' — inventory updated as STOCK IN ✓';
      showBanner('po-success-bar', summary);
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){ alert('Network error: '+e.message); }
}

// ── PRODUCTION CONVERSION SYSTEM ──
let bom = [];
let prodLines = [];

