// A SKU may list ALTERNATE suppliers ("Primary, Alternate" in the SKU Master's
// Supplier column). Match the PO's chosen supplier against ANY of them,
// case-insensitively, so the item is orderable from every listed source.
function skuHasSupplier(s, supplier){
  const want = String(supplier||'').trim().toLowerCase();
  if(Array.isArray(s.suppliers) && s.suppliers.length)
    return s.suppliers.some(x => String(x).trim().toLowerCase() === want);
  return String(s.supplier||'').trim().toLowerCase() === want;
}
function skuNoSupplier(s){
  if(Array.isArray(s.suppliers)) return s.suppliers.length === 0;
  return !s.supplier || String(s.supplier).trim() === '';
}

function generatePONumber(){
  const d=new Date(new Date().toLocaleString('en-US',{timeZone:'Asia/Manila'}));
  const date=d.getFullYear().toString()+String(d.getMonth()+1).padStart(2,'0')+String(d.getDate()).padStart(2,'0');
  const todayPOs=poList.filter(p=>p.poNumber&&p.poNumber.includes(date));
  return 'PO-'+date+'-'+String(todayPOs.length+1).padStart(3,'0');
}

function fmtPODate(d){ return phDateTime(d); }

async function openPO(){
  showScreen('po-screen');updateFabVisibility();
  showPOSubtab('list',document.getElementById('po-tab-list'));
  await Promise.all([loadPOs(), loadSuppliers()]);
  // Proactive receipt reminder — show after list loads
  const needReceipt = poList.filter(p=>p.status==='APPROVED'||p.status==='PARTIAL');
  if(needReceipt.length){
    showToast(
      needReceipt.length === 1
        ? '1 approved PO is waiting to be received'
        : needReceipt.length + ' approved POs are waiting to be received',
      'warning', 5000
    );
  }
}

async function loadSuppliers(){
  if(supplierList.length) return; // already loaded this session
  try{
    const r=await api({action:'getSuppliers'});
    if(r.status==='ok') supplierList=r.suppliers||[];
  }catch(e){console.error('loadSuppliers failed',e);}
}

function closePO(){showHome();}

function showPOSubtab(tab,el){
  document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));
  if(el)el.classList.add('active');
  const _prevTypeView=poTypeView;
  if(tab==='dist')       { poTypeView='DIST';   tab='list'; }
  else if(tab==='retail'){ poTypeView='RETAIL'; tab='list'; }
  else if(tab==='list')  { poTypeView='ALL'; }
  // Reset status filter when switching type views — a filter like DRAFT carried into a
  // view with zero drafts shows an empty list with no visible active chip (confusing)
  if(poTypeView!==_prevTypeView) poFilter='All';
  document.getElementById('po-view-list').style.display=tab==='list'?'flex':'none';
  document.getElementById('po-view-create').style.display=tab==='create'?'flex':'none';
  document.getElementById('po-view-detail').style.display=tab==='detail'?'flex':'none';
  if(tab==='create')initPOCreate();
  if(tab==='list'){
    updatePOTypeBanner();
    // Re-render from the cached list — tab switches are instant and don't refetch.
    // Fresh data is loaded by openPO() on entry and by savePO/receive/approve flows.
    // (Previously this fired loadPOs() too, duplicating the getPOs call on every
    // screen open and adding a full network round trip to every tab tap.)
    if(poList.length){ buildPOStatusChips(); renderPOList(); }
  }
}

function updatePOTypeBanner(){
  const banner=document.getElementById('po-type-banner');
  if(!banner)return;
  if(poTypeView==='DIST'){
    banner.style.display='block';
    banner.className='po-type-banner dist';
    banner.textContent='📦 Distribution POs';
  }else if(poTypeView==='RETAIL'){
    banner.style.display='block';
    banner.className='po-type-banner retail';
    banner.textContent='🛒 Retail POs';
  }else{
    banner.style.display='none';
    banner.className='po-type-banner';
  }
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
  // Count only POs matching the active type view
  const basePOs=poTypeView==='ALL'?poList:poList.filter(p=>p.type===poTypeView);
  const counts={};basePOs.forEach(p=>{counts[p.status]=(counts[p.status]||0)+1;});
  bar.innerHTML='';
  statuses.forEach(s=>{
    const cnt=s==='All'?basePOs.length:(counts[s]||0);
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
  const _canDist2=_isAdm2||currentUser.canManagePODist===true;
  const _canRet2=_isAdm2||currentUser.canManagePORetail===true;
  const canSee=_isAdm2?poList:poList.filter(p=>{
    if(p.type==='DIST'&&_canDist2)return true;
    if(p.type==='RETAIL'&&_canRet2)return true;
    if(p.createdBy===currentUser.username)return true;
    return false;
  });
  // Apply type view filter (DIST / RETAIL / ALL)
  const typeFiltered=poTypeView==='ALL'?canSee:canSee.filter(p=>p.type===poTypeView);
  const visible=poFilter==='All'?typeFiltered:typeFiltered.filter(p=>p.status===poFilter);
  if(!visible.length){body.innerHTML='<div class="po-list-empty">No purchase orders found.<br>Tap "+ New PO" to create one.</div>';return;}
  body.innerHTML='';
  visible.sort((a,b)=>new Date(b.createdDate)-new Date(a.createdDate));
  visible.forEach(po=>{
    const card=document.createElement('div');card.className='po-card';card.onclick=()=>openPODetail(po.poNumber);
    const statusCls={DRAFT:'s-draft',PENDING:'s-pending',APPROVED:'s-approved',PARTIAL:'s-partial',RECEIVED:'s-received',REJECTED:'s-rejected',CANCELLED:'s-cancelled'}[po.status]||'s-draft';
    // Show type badge only in the "All" combined view
    const typeBadge=poTypeView==='ALL'
      ?(po.type==='DIST'
        ?'<span class="po-type-dist">DIST</span>'
        :'<span class="po-type-retail">RETAIL</span>')
      :'';
    card.innerHTML=`<div class="po-card-row1"><div><div class="po-number">${po.poNumber}${typeBadge}</div><div class="po-supplier">${po.supplier}</div><div class="po-meta">${fmtPODate(po.createdDate)} · ${po.createdBy}</div></div><span class="po-status-badge ${statusCls}">${po.status}</span></div><div class="po-card-row2"><span style="font-size:11px;color:#888">${po.lineCount||0} item(s)</span><span class="po-total">₱${Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2})}</span></div>`;
    body.appendChild(card);
  });
}

function initPOCreate(){
  poLineItems=[];
  // Always start in create mode — clears leftover edit state so a user who tapped
  // "Edit Draft" then switched to "+ New PO" doesn't silently overwrite the old draft.
  // (editPODraft re-sets these flags AFTER calling showPOSubtab/initPOCreate.)
  poEditMode=false; poEditingNumber=null;
  const _titleEl=document.getElementById('po-create-title');
  if(_titleEl) _titleEl.textContent='New Purchase Order';
  const _draftBtn=document.getElementById('po-save-draft-btn');
  if(_draftBtn) _draftBtn.textContent='Save Draft';
  const _subBtn=document.getElementById('po-submit-btn');
  if(_subBtn) _subBtn.textContent='Submit for Approval';
  const _isAdm=currentUser.role==='admin';
  const hasDist  =_isAdm||currentUser.canManagePODist===true;
  const hasRetail=_isAdm||currentUser.canManagePORetail===true;
  const typeEl=document.getElementById('po-type');
  if(typeEl){
    Array.from(typeEl.options).forEach(function(opt){
      if(opt.value==='DIST')   opt.hidden=!hasDist;
      if(opt.value==='RETAIL') opt.hidden=!hasRetail;
    });
    // Pre-select type based on the active tab view; fall back to permission-based default
    if(poTypeView==='DIST'&&hasDist)          typeEl.value='DIST';
    else if(poTypeView==='RETAIL'&&hasRetail) typeEl.value='RETAIL';
    else                                       typeEl.value=hasDist?'DIST':'RETAIL';
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

    // Rebuild options for this line — a SKU shows under ANY of its listed suppliers
    const filtered = liveSKUs.filter(s => s.type === type && skuHasSupplier(s, supplier));
    const unassigned = liveSKUs.filter(s => s.type === type && skuNoSupplier(s));
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
  const typeEl = document.getElementById('po-type');
  const type   = typeEl.value;
  const prevType = typeEl.dataset.prevType || '';

  // Confirm BEFORE touching anything — declining must leave the form exactly as it was
  // (previously the supplier list was rebuilt for the new type before the confirm,
  // so declining left DIST type showing RETAIL suppliers)
  const hasRealLines = poLineItems.some(l=>!l.removed&&l.skuCode);
  if(hasRealLines && prevType && type!==prevType){
    if(!confirm('Changing type will clear all current line items. Continue?')){
      typeEl.value = prevType;
      return;
    }
    poLineItems = [];
    renderPOLineItems();
    updatePOTotals();
  }
  typeEl.dataset.prevType = type;

  const sup = document.getElementById('po-supplier');
  // Use Suppliers sheet data when available, fall back to SKU Master derived list
  let supNames;
  if(supplierList.length){
    supNames = supplierList.filter(s=>s.type===type||s.type==='BOTH').map(s=>s.name).sort();
  }
  if(!supNames||!supNames.length){
    // Derive from SKU Master — include ALTERNATE suppliers, not just primaries
    const assigned=[...new Set(liveSKUs.filter(s=>s.type===type)
      .flatMap(s=>Array.isArray(s.suppliers)&&s.suppliers.length?s.suppliers:(s.supplier?[s.supplier]:[])))].sort();
    supNames = assigned.length ? assigned : (type==='DIST' ? DIST_SUPPLIERS : RETAIL_SUPPLIERS);
  }
  sup.innerHTML = supNames.map(s=>`<option value="${s}">${s}</option>`).join('');
}

// preData = {skuCode, skuName, qty, unitCost, unit} for edit-draft pre-fill
function addPOLineItem(preData){
  const type=document.getElementById('po-type').value;
  const supplier=document.getElementById('po-supplier').value;
  // Strictly the selected supplier — but a SKU listing it as an ALTERNATE
  // (comma-separated in the SKU Master) counts too
  const filtered = liveSKUs.filter(s => s.type === type && skuHasSupplier(s, supplier));
  // SKUs with no supplier assigned shown in separate group
  const unassigned = liveSKUs.filter(s => s.type === type && skuNoSupplier(s));

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
  const idx=poLineItems.length;
  const initQty      = preData ? preData.qty          : 1;
  const initCost     = preData ? preData.unitCost      : 0;
  const initUnit     = preData ? (preData.unit||'bag') : 'bag';
  const initDisc     = preData ? (preData.discount||0) : 0;
  const initDiscType = preData ? (preData.discountType||'%') : '%';
  poLineItems.push({skuCode:'',skuName:'',qty:initQty,unitCost:initCost,unit:initUnit,
    discount:initDisc, discountType:initDiscType});

  // Pre-select option if restoring from edit-draft
  let selectHtml = '<option value="">-- Select item --</option>' + skuOpts;
  if(preData && preData.skuCode){
    poLineItems[idx].skuCode = preData.skuCode;
    poLineItems[idx].skuName = preData.skuName||preData.skuCode;
    selectHtml = selectHtml.replace(
      'value="'+preData.skuCode+'|'+preData.skuName+'"',
      'value="'+preData.skuCode+'|'+preData.skuName+'" selected'
    );
  }

  const pctActive = initDiscType==='%'  ? 'po-disc-type-active' : '';
  const phpActive = initDiscType==='₱'  ? 'po-disc-type-active' : '';

  const div=document.createElement('div');div.className='po-line-item';div.id='po-line-'+idx;
  div.innerHTML=`
    <div class="po-line-info">
      <select style="width:100%;padding:6px 8px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:11px;outline:none;color:#222;background:white" onchange="onPOLineSelect(${idx},this)">${selectHtml}</select>
    </div>
    <div class="po-line-inputs">
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Qty</span>
        <input class="po-line-qty" type="number" min="1" value="${initQty}" oninput="onPOLineQty(${idx},this.value)">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Unit cost ₱</span>
        <input class="po-line-cost" type="number" min="0" placeholder="0.00" value="${initCost||''}" oninput="onPOLineCost(${idx},this.value)">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Discount</span>
        <div style="display:flex;gap:0">
          <button type="button" id="po-disc-pct-${idx}" class="po-disc-type-btn ${pctActive}" onclick="onPOLineDiscountType(${idx},'%')">%</button>
          <button type="button" id="po-disc-php-${idx}" class="po-disc-type-btn ${phpActive}" onclick="onPOLineDiscountType(${idx},'₱')">₱</button>
        </div>
        <input class="po-line-disc" type="number" min="0" placeholder="0" value="${initDisc||''}" oninput="onPOLineDiscount(${idx},this.value)" style="width:52px;margin-top:3px">
      </div>
      <div style="display:flex;flex-direction:column;align-items:center">
        <span style="font-size:9px;color:#aaa;margin-bottom:2px">Net total</span>
        <div class="po-line-net" id="po-line-net-${idx}" style="font-size:11px;font-weight:700;color:#1A3A5C;padding-top:6px">—</div>
      </div>
    </div>
    <button class="po-line-del" onclick="removePOLine(${idx})">×</button>`;
  document.getElementById('po-line-items').appendChild(div);updatePOTotals();
}

function onPOLineDiscount(idx,val){
  poLineItems[idx].discount=parseFloat(val)||0;
  updatePOTotals();
}
function onPOLineDiscountType(idx,type){
  poLineItems[idx].discountType=type;
  const pctBtn=document.getElementById('po-disc-pct-'+idx);
  const phpBtn=document.getElementById('po-disc-php-'+idx);
  if(pctBtn) pctBtn.className='po-disc-type-btn'+(type==='%'?' po-disc-type-active':'');
  if(phpBtn) phpBtn.className='po-disc-type-btn'+(type==='₱'?' po-disc-type-active':'');
  updatePOTotals();
}

function editPODraft(){
  if(!currentPO||!['DRAFT','REJECTED'].includes(currentPO.status)) return;

  // Switch to create tab FIRST — initPOCreate resets edit state, so the
  // edit flags must be set after it runs, not before
  showPOSubtab('create', document.getElementById('po-tab-create'));
  poEditMode      = true;
  poEditingNumber = currentPO.poNumber;

  // Pre-fill header
  const typeEl = document.getElementById('po-type');
  if(typeEl){ typeEl.value = currentPO.type; onPOTypeChange(); }
  setTimeout(()=>{
    const supEl = document.getElementById('po-supplier');
    if(supEl) supEl.value = currentPO.supplier;
    onPOSupplierChange();

    // Pre-fill delivery date (YYYY-MM-DD format for date input)
    const ddEl = document.getElementById('po-delivery-date');
    if(ddEl && currentPO.deliveryDate){
      try{ ddEl.value = new Date(currentPO.deliveryDate).toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}); }
      catch(e){}
    }
    document.getElementById('po-notes').value = currentPO.notes || '';

    // Restore line items
    poLineItems = [];
    document.getElementById('po-line-items').innerHTML = '';
    (currentPO.lineItems||[]).forEach(li=>{
      addPOLineItem({
        skuCode:      li.skuCode,
        skuName:      li.itemName||li.skuCode,
        qty:          li.qtyOrdered,
        unitCost:     li.unitCost,
        unit:         li.unit||'bag',
        discount:     li.discount||0,
        discountType: li.discountType||'%'
      });
    });
    updatePOTotals();

    // Update button labels + title
    const isRejected = currentPO.status === 'REJECTED';
    const titleEl = document.getElementById('po-create-title');
    if(titleEl) titleEl.textContent = (isRejected ? 'Edit & Resubmit: ' : 'Editing Draft: ') + currentPO.poNumber + ' · ' + currentUser.username;
    const draftBtn = document.getElementById('po-save-draft-btn');
    if(draftBtn) draftBtn.textContent = isRejected ? 'Save as Draft' : 'Update Draft';
    const subBtn = document.getElementById('po-submit-btn');
    if(subBtn) subBtn.textContent = isRejected ? 'Resubmit for Approval' : 'Update & Submit for Approval';
  }, 80); // short delay to let supplier dropdown render
}

function onPOLineSelect(idx,sel){if(!sel.value)return;const parts=sel.value.split('|');poLineItems[idx].skuCode=parts[0];poLineItems[idx].skuName=parts[1]||parts[0];const skuData=liveSKUs.find(s=>s.code===parts[0]);if(skuData&&skuData.cost){poLineItems[idx].unitCost=skuData.cost;const costInput=document.querySelector('#po-line-'+idx+' .po-line-cost');if(costInput)costInput.value=skuData.cost;}updatePOTotals();}
function onPOLineQty(idx,val){poLineItems[idx].qty=parseFloat(val)||0;updatePOTotals();}
function onPOLineCost(idx,val){poLineItems[idx].unitCost=parseFloat(val)||0;updatePOTotals();}
function removePOLine(idx){poLineItems[idx]={removed:true};const el=document.getElementById('po-line-'+idx);if(el)el.remove();updatePOTotals();}
function renderPOLineItems(){document.getElementById('po-line-items').innerHTML='';poLineItems=[];}
function calcLineNet(l){
  const gross = l.qty * (l.unitCost||0);
  const disc  = l.discount || 0;
  if(!disc) return gross;
  if(l.discountType === '₱') return Math.max(0, gross - (disc * l.qty));
  return Math.max(0, gross * (1 - disc/100));
}
function updatePOTotals(){
  const active=poLineItems.filter(l=>!l.removed&&l.skuCode);
  let total=0;
  active.forEach((l,_)=>{
    const net=calcLineNet(l);
    total+=net;
    // Update per-line net display
    const origIdx=poLineItems.indexOf(l);
    const netEl=document.getElementById('po-line-net-'+origIdx);
    if(netEl) netEl.textContent='₱'+net.toLocaleString('en-PH',{minimumFractionDigits:2});
  });
  document.getElementById('po-item-count').textContent=active.length;
  document.getElementById('po-grand-total').textContent='₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2});
}
async function savePODraft(){await savePO('DRAFT');}
async function submitPOForApproval(){await savePO('PENDING');}
async function savePO(status){
  // ── Guard: block double-tap / concurrent submissions ──────────────────
  if(_poSaving) return;
  _poSaving = true;
  const draftBtn = document.getElementById('po-save-draft-btn');
  const subBtn   = document.getElementById('po-submit-btn');
  if(draftBtn){ draftBtn.disabled=true; draftBtn.style.opacity='0.6'; }
  if(subBtn)  { subBtn.disabled=true;   subBtn.style.opacity='0.6';   }

  try{
    const type      = document.getElementById('po-type').value;
    const supplier  = document.getElementById('po-supplier').value;
    const notes     = document.getElementById('po-notes').value.trim();
    const delivDate = document.getElementById('po-delivery-date').value;
    const active    = poLineItems.filter(l=>!l.removed&&l.skuCode);
    if(!supplier){ alert('Please select a supplier.'); return; }
    if(active.length===0){ alert('Please add at least one line item.'); return; }
    const total = active.reduce((s,l)=>s+calcLineNet(l),0);

    if(poEditMode && poEditingNumber){
      // ── UPDATE EXISTING DRAFT ──────────────────────────────────────────
      const r=await api({action:'updatePODraft',poNumber:poEditingNumber,type,supplier,
        status, deliveryDate:delivDate,notes,totalValue:total,
        editedBy:currentUser.username,
        lineItems:active.map(l=>[poEditingNumber,l.skuCode,l.skuName,'',l.qty,l.unit||'bag',l.unitCost,calcLineNet(l),0,l.qty,'Open',l.discount||0,l.discountType||'%'])});
      if(r.status==='ok'){
        showBanner('po-success-bar','Draft '+poEditingNumber+(status==='PENDING'?' updated & submitted for approval':' updated'));
        showToast(status==='PENDING'?poEditingNumber+' updated & submitted for approval':poEditingNumber+' draft updated','info');
      } else { alert('Error: '+(r.msg||'Could not update PO')); return; }

    } else {
      // ── CREATE NEW PO ─────────────────────────────────────────────────
      // createdDate is generated server-side (avoids D/M vs M/D ambiguity in Sheets)
      const poNumber = generatePONumber();
      const r=await api({action:'createPO',poNumber,type,supplier,status,
        createdBy:currentUser.username,
        deliveryDate:delivDate,notes,totalValue:total,
        lineItems:active.map(l=>[poNumber,l.skuCode,l.skuName,'',l.qty,l.unit||'bag',l.unitCost,calcLineNet(l),0,l.qty,'Open',l.discount||0,l.discountType||'%'])});
      if(r.status==='ok'){
        // Server may have bumped the number if another user created a PO concurrently
        const savedNum = r.poNumber || poNumber;
        showBanner('po-success-bar','PO '+savedNum+' '+(status==='DRAFT'?'saved as draft':'submitted for approval'));
        showToast(status==='DRAFT'?savedNum+' saved as draft':savedNum+' submitted for approval','info');
      } else { alert('Error: '+(r.msg||'Could not save PO')); return; }
    }

    // ── Reset and return to list ─────────────────────────────────────────
    poEditMode=false; poEditingNumber=null;
    const titleEl=document.getElementById('po-create-title');
    if(titleEl) titleEl.textContent='New Purchase Order';
    if(draftBtn) draftBtn.textContent='Save as Draft';
    if(subBtn)   subBtn.textContent='Submit for Approval';
    poLineItems=[];
    await loadPOs();
    showPOSubtab('list',document.getElementById('po-tab-list'));

  } catch(e){
    alert('Network error: '+e.message);
  } finally {
    // Always re-enable buttons and clear the save lock
    _poSaving = false;
    if(draftBtn){ draftBtn.disabled=false; draftBtn.style.opacity=''; }
    if(subBtn)  { subBtn.disabled=false;   subBtn.style.opacity='';   }
  }
}

async function openPODetail(poNumber){
  try{const r=await api({action:'getPODetail',poNumber});if(r.status==='ok'){currentPO={...r.po,lineItems:r.lineItems};renderPODetail();document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));document.getElementById('po-view-list').style.display='none';document.getElementById('po-view-create').style.display='none';const detail=document.getElementById('po-view-detail');detail.style.display='flex';detail.style.flexDirection='column';}}catch(e){alert('Could not load PO details.');}
}

function renderPODetail(){
  const po = currentPO;
  const isAdmin = currentUser.role === 'admin';
  const isCreator = po.createdBy === currentUser.username;
  const canReceive = isAdmin
    || (po.type==='DIST'   && currentUser.canManagePODist===true)
    || (po.type==='RETAIL' && currentUser.canManagePORetail===true);
  // Edit access: admin, original creator, or staff with matching type permission
  const canEditDraft = isAdmin || isCreator
    || (po.type==='DIST'   && currentUser.canManagePODist===true)
    || (po.type==='RETAIL' && currentUser.canManagePORetail===true);
  const canCancel = isAdmin
    || (isCreator && ['DRAFT','PENDING'].includes(po.status));
  // Resubmit inherits from canEditDraft — anyone who can edit can resubmit
  const canResubmit = canEditDraft && po.status === 'REJECTED';
  // Approval authority: admin, or a supervisor with delegated approval for this PO type
  const canApprovePO = isAdmin
    || (po.type==='DIST'   && currentUser.canApprovePODist===true)
    || (po.type==='RETAIL' && currentUser.canApprovePORetail===true);

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
    + 'Type: ' + po.type + ' &nbsp;·&nbsp; Created: ' + fmtPODate(po.createdDate) + '<br>'
    + 'Created by: ' + po.createdBy
    + (po.approvedBy ? '<br>' + (po.status==='REJECTED' ? 'Rejected by: ' : 'Approved by: ') + po.approvedBy : '')
    + (po.lastEditedBy ? '<br><span style="font-size:11px;color:#B35C00;font-weight:600">✏️ Last edited by: ' + po.lastEditedBy + (po.lastEditedAt ? ' · ' + fmtPODate(po.lastEditedAt) : '') + '</span>' : '')
    + (po.receivedBy ? '<br><span style="color:#1B5E20;font-weight:600">📦 Received by: ' + po.receivedBy + (po.dateReceived ? ' · ' + fmtPODate(po.dateReceived) : '') + '</span>' : '')
    + (po.paymentMode ? '<br>Payment: ' + po.paymentMode
        + (po.chequeRef ? ' — Cheque #' + po.chequeRef : '')
        + (po.paymentMode !== 'Split / Installment' && po.amountPaid > 0 ? ' — Amount: <strong>₱' + Number(po.amountPaid).toLocaleString('en-PH',{minimumFractionDigits:2}) + '</strong>' : '')
        + (po.paymentMode !== 'Split / Installment' && po.dueDate ? ' — Due: <strong>' + po.dueDate + '</strong>' : '')
        + (po.paymentMode === 'Split / Installment' ? ' — see schedule below' : '') : '')
    + (po.overpayment > 0
        ? '<br><span class="po-overpay-badge">⚠️ Overpayment: ₱' + Number(po.overpayment).toLocaleString('en-PH',{minimumFractionDigits:2}) + ' — credit pending from ' + po.supplier + '</span>' : '')
    + (po.docRef ? '<br>Doc Ref #: <strong>' + po.docRef + '</strong>' : '')
    + '<br>Total: <strong>₱' + Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2}) + '</strong>'
    + (po.notes ? '<br>Notes: ' + po.notes : '')
    + '</div>';
  body.appendChild(hdr);

  // ── SPLIT PAYMENT SCHEDULE CARD ──────────────────────────────────────────
  if(Array.isArray(po.paymentSchedule) && po.paymentSchedule.length){
    const schedDiv = document.createElement('div');
    schedDiv.className = 'po-pay-schedule';
    const allPaid = po.paymentSchedule.every(i => i.status === 'Paid');
    schedDiv.innerHTML = '<div class="po-pay-schedule-title">💳 Split Payment Schedule'
      + (allPaid ? ' &nbsp;✅ Fully Settled' : '') + '</div>'
      + po.paymentSchedule.map((inst, idx) => {
          const isPaid = inst.status === 'Paid';
          const canMark = isAdmin && !isPaid && ['APPROVED','PARTIAL','RECEIVED'].includes(po.status);
          return '<div class="po-pay-sched-row">'
            + '<span class="po-pay-sched-num">' + inst.num + '</span>'
            + '<div class="po-pay-sched-info">'
              + '<div class="po-pay-sched-amt">₱' + Number(inst.amount).toLocaleString('en-PH',{minimumFractionDigits:2}) + '</div>'
              + '<div class="po-pay-sched-meta">' + inst.label + ' &nbsp;·&nbsp; Due: ' + inst.dueDate + '</div>'
              + (isPaid
                ? '<div class="po-pay-sched-paid-tag">✓ Paid ₱' + Number(inst.paidAmount||inst.amount).toLocaleString('en-PH',{minimumFractionDigits:2})
                  + ' on ' + inst.paidDate + (inst.paidBy ? ' by ' + inst.paidBy : '') + '</div>'
                : '')
            + '</div>'
            + (canMark
              ? '<button class="po-pay-sched-mark-btn" onclick="markInstallmentPaid(' + idx + ')">Mark Paid</button>'
              : (isPaid ? '<span class="po-pay-sched-done">✓</span>' : ''))
            + '</div>';
        }).join('');
    body.appendChild(schedDiv);
  }

  // ── PAYMENT HISTORY LOG (shown when previous payment edits exist) ──
  if(po.paymentHistory){
    const entries = po.paymentHistory.split('|||').map(e=>e.trim()).filter(Boolean);
    if(entries.length){
      const histDiv = document.createElement('div');
      histDiv.className = 'po-pay-history';
      histDiv.innerHTML = '<div class="po-pay-history-title">Previous Payment Records</div>'
        + entries.map(e => '<div class="po-pay-history-entry">' + e + '</div>').join('');
      hdr.appendChild(histDiv);
    }
  }

  // ── EDIT HISTORY LOG ──
  if(po.editHistory){
    const edits = po.editHistory.split('|||').map(e=>e.trim()).filter(Boolean);
    if(edits.length){
      const eHistDiv = document.createElement('div');
      eHistDiv.className = 'po-edit-history';
      eHistDiv.innerHTML = '<div class="po-edit-history-title">✏️ Edit History</div>'
        + edits.map(e => '<div class="po-edit-history-entry">' + e + '</div>').join('');
      hdr.appendChild(eHistDiv);
    }
  }

  // ── RECEIPT HISTORY LOG (who received what, per delivery) ──
  if(po.receiptHistory){
    const rcpts = po.receiptHistory.split('|||').map(e=>e.trim()).filter(Boolean);
    if(rcpts.length){
      const rHistDiv = document.createElement('div');
      rHistDiv.className = 'po-receipt-history';
      rHistDiv.innerHTML = '<div class="po-receipt-history-title">📦 Receipt History</div>'
        + rcpts.map(e => '<div class="po-receipt-history-entry">' + e + '</div>').join('');
      hdr.appendChild(rHistDiv);
    }
    // Duplicate-receipt warning + reversal (admin only) — catches double-submits
    if(isAdmin && _poDupReceiptCount(po.receiptHistory) > 0){
      const dupDiv = document.createElement('div');
      dupDiv.className = 'po-dup-warn';
      dupDiv.innerHTML =
        '<div class="po-dup-msg">⚠ <strong>Duplicate receipt detected.</strong> This delivery looks like it was recorded more than once (a double-tap during a slowdown), so the received quantity and warehouse stock may be doubled.</div>'
        + '<button class="po-dup-btn" onclick="reverseDuplicatePO()">↩ Reverse duplicate receipt</button>';
      hdr.appendChild(dupDiv);
    }
  }

  // ── EDIT PAYMENT DETAILS (admin only — APPROVED or PARTIAL) ──
  if(isAdmin && ['APPROVED','PARTIAL'].includes(po.status)){
    const epmDiv = document.createElement('div');
    epmDiv.className = 'po-action-row';
    epmDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="openEditPaymentModal()" style="background:#1F4E78">✏️ Edit Payment Details</button>';
    body.appendChild(epmDiv);
  }

  // ── EDIT LINE ITEMS ──
  // Admin: any active PO. Approver: the PENDING PO they're being asked to decide —
  // so a wrong quantity or price can be corrected on the spot instead of rejecting
  // it and making the creator raise the whole thing again. Either way the backend
  // stamps "Line items edited by <name>" into the PO's edit history.
  if(canEditPOLines(po)){
    const eliDiv = document.createElement('div');
    eliDiv.className = 'po-action-row';
    eliDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="openEditLineItemsModal()" style="background:#4A235A">✏️ Edit Line Items</button>'
      + (!isAdmin ? '<div class="po-edit-hint">You’re approving this PO — correct any wrong quantity or cost before you approve. Your name is recorded on the change.</div>' : '');
    body.appendChild(eliDiv);
  }

  // ── EDIT DRAFT / REJECTED (creator, authorized staff, or admin) ──
  if(['DRAFT','REJECTED'].includes(po.status) && canEditDraft){
    const editDiv = document.createElement('div');
    editDiv.className = 'po-action-row';
    const editLabel = po.status === 'REJECTED' ? '✏️ Edit Before Resubmitting' : '✏️ Edit Draft';
    editDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="editPODraft()">' + editLabel + '</button>';
    body.appendChild(editDiv);
  }

  // ── APPROVAL SECTION (admin or delegated approver, PENDING status) ──
  if(canApprovePO && po.status === 'PENDING'){
    // Auto-fill supplier defaults if available
    const supDef = supplierList.find(s=>s.name===po.supplier)||{};
    const defMode  = supDef.defPayMode || '';
    const defTerms = supDef.defTerms   || '';
    // Convert po.deliveryDate to YYYY-MM-DD for date input
    let delivVal = '';
    if(po.deliveryDate){ try{ delivVal = new Date(po.deliveryDate).toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'}); }catch(e){} }

    const approvalDiv = document.createElement('div');
    approvalDiv.innerHTML = ''
      + '<div class="po-payment-section">'
        + '<div class="po-payment-title">Delivery &amp; Payment Terms</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Confirm delivery date</span>'
            + '<input class="po-cheque-ref" id="po-approval-delivery-date" type="date" value="' + delivVal + '" onchange="updatePODueDate()">'
          + '</div>'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Mode of payment</span>'
            + '<select class="po-payment-select" id="po-payment-mode" onchange="onPOPaymentModeChange()">'
              + '<option value="">-- Select --</option>'
              + ['Cheque','Cash Out','GCash','Maya','Bank Transfer','Split / Installment']
                .map(m => '<option value="' + m + '"' + (m===defMode?' selected':'') + '>' + m + (m==='Split / Installment'?' (3 payments)':'') + '</option>').join('')
            + '</select>'
          + '</div>'
        + '</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Payment terms</span>'
            + '<select class="po-payment-select" id="po-terms-days" onchange="updatePODueDate()">'
              + '<option value="">-- Select --</option>'
              + '<option value="0"' + (defTerms==='0'?' selected':'') + '>Upon Delivery</option>'
              + ['7','15','30','45','60'].map(d => '<option value="' + d + '"' + (d===defTerms?' selected':'') + '>' + d + ' days</option>').join('')
            + '</select>'
          + '</div>'
          + '<div class="po-payment-field">'
            + '<span class="po-payment-label">Est. due date</span>'
            + '<div class="po-due-date-display" id="po-due-date-display">—</div>'
          + '</div>'
        + '</div>'
        + '<div class="po-payment-row">'
          + '<div class="po-payment-field" id="po-cheque-field" style="display:none">'
            + '<span class="po-payment-label">Cheque ref # (10 chars)</span>'
            + '<input class="po-cheque-ref" id="po-cheque-ref" type="text" maxlength="10" placeholder="XXXXXXXXXX">'
          + '</div>'
        + '</div>'
        + '<div id="po-split-wrap" style="display:none"></div>'
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
    // Initialise field visibility for whatever mode/terms are pre-selected from supplier defaults.
    // Without these, onchange never fires on load so cheque field and due date stay at their blank defaults.
    onPOPaymentModeChange();
    updatePODueDate();
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

    const discAmt  = Number(li.discount||0);
    const discType = li.discountType || '%';
    const discLabel = discAmt > 0
      ? (discType==='₱' ? '−₱'+discAmt.toLocaleString('en-PH')+'/unit' : '−'+discAmt+'%') : '';
    const netUnit = discAmt > 0
      ? (discType==='₱' ? Number(li.unitCost)-discAmt : Number(li.unitCost)*(1-discAmt/100)) : Number(li.unitCost);

    const lineTotal = Math.max(0, netUnit) * Number(li.qtyOrdered||0);

    lineHTML += '<div class="po-receive-row">'
      + '<div class="po-receive-info">'
        + '<div class="po-receive-name">' + (li.itemName||li.skuCode) + '</div>'
        + '<div class="po-receive-ordered">Ordered: ' + li.qtyOrdered
          + ' &nbsp;·&nbsp; Received: ' + received
          + ' &nbsp;·&nbsp; Outstanding: ' + outstanding + '</div>'
        + '<div class="po-receive-ordered">Unit cost: ₱' + Number(li.unitCost||0).toLocaleString('en-PH',{minimumFractionDigits:2})
          + (discLabel ? ' &nbsp;<span style="color:#E24B4A;font-weight:600">'+discLabel+'</span>'
            + ' &nbsp;→ Net ₱'+Math.max(0,netUnit).toLocaleString('en-PH',{minimumFractionDigits:2}) : '')
          + '</div>'
        + '<div class="po-receive-ordered" style="font-weight:700;color:#1A3A5C">Line Total: ₱' + lineTotal.toLocaleString('en-PH',{minimumFractionDigits:2}) + '</div>'
      + '</div>';

    if(isFull){
      lineHTML += '<span class="po-received-badge">Received ✓</span>';
    } else if(canEdit){
      lineHTML += '<input class="po-recv-qty" type="number" min="0" max="' + outstanding + '"'
          + ' placeholder="' + outstanding + '" id="recv-qty-' + i + '" value="' + outstanding + '">'
        + '<input class="po-recv-cost" type="number" min="0" step="0.01"'
          + ' placeholder="cost" id="recv-cost-' + i + '" value="' + defaultCost + '"'
          + ' oninput="updateRecvPriceBadge(' + i + ')">';
    }

    lineHTML += '</div>';
    // Price-change insight (editable lines only) — filled in by updateRecvPriceBadge
    if(canEdit && !isFull){
      lineHTML += '<div class="recv-price-badge" id="recv-badge-' + i + '"></div>';
    }
  });

  itemsSection.innerHTML = lineHTML;
  body.appendChild(itemsSection);
  // Initialise the price-change badges now that the inputs exist in the DOM
  (po.lineItems||[]).forEach((li, i) => { if(document.getElementById('recv-cost-'+i)) updateRecvPriceBadge(i); });

  // ── RECEIVE BUTTON ──
  if(canReceive && ['APPROVED','PARTIAL'].includes(po.status)){
    const recvDiv = document.createElement('div');
    recvDiv.className = 'po-action-row';
    recvDiv.innerHTML = '<button class="po-btn po-btn-primary" onclick="receiveItems()">📦 Confirm Receipt &amp; Update Inventory</button>';
    body.appendChild(recvDiv);
  }

  // ── CANCEL ──
  // Admin: any active status (not already CANCELLED or fully RECEIVED)
  // Creator (non-admin): DRAFT or PENDING only, and not in resubmit state
  const showCancel = isAdmin
    ? !['CANCELLED','RECEIVED'].includes(po.status)
    : (isCreator && ['DRAFT','PENDING'].includes(po.status) && !canResubmit);
  if(showCancel){
    const cancelDiv = document.createElement('div');
    cancelDiv.className = 'po-action-row';
    cancelDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="cancelPO()">Cancel PO</button>';
    body.appendChild(cancelDiv);
  }

  // ── DELETE (admin only — permanent, removes PO + line items from sheet) ──
  if(isAdmin){
    const delDiv = document.createElement('div');
    delDiv.className = 'po-action-row';
    delDiv.innerHTML = '<button class="po-btn po-btn-danger" onclick="deletePO()" style="background:#8B0000">🗑 Delete PO Permanently</button>';
    body.appendChild(delDiv);
  }

  // ── BACK ──
  const backDiv = document.createElement('div');
  backDiv.className = 'po-action-row';
  backDiv.style.marginTop = '4px';
  backDiv.innerHTML = '<button class="po-btn po-btn-secondary" onclick="backToPOList()">← Back to list</button>';
  body.appendChild(backDiv);
}

function updatePODueDate(){
  const daysVal  = document.getElementById('po-terms-days')
    ? document.getElementById('po-terms-days').value : '';
  const days     = parseInt(daysVal) || 0;
  const el       = document.getElementById('po-due-date-display');
  if(!el) return;
  if(daysVal === '' ){ el.textContent = '—'; return; }
  if(days === 0){ el.textContent = 'Upon Delivery'; return; }
  // Base on confirmed delivery date, fall back to today
  const delivInput = document.getElementById('po-approval-delivery-date');
  const base = delivInput && delivInput.value ? new Date(delivInput.value) : new Date();
  const due  = new Date(base);
  due.setDate(due.getDate() + days);
  el.textContent = phDate(due) + ' (est.)';
}

// ── SPLIT / INSTALLMENT HELPERS ───────────────────────────────────────────

function buildSplitRowsHTML(total, existingSchedule){
  const third = Math.round(total / 3 * 100) / 100;
  const defAmts = (existingSchedule && existingSchedule.length === 3)
    ? existingSchedule.map(e => e.amount)
    : [third, third, Math.max(0, Math.round((total - third * 2) * 100) / 100)];
  const labels = ['1st — COD (Upon Delivery)','2nd — +10 days','3rd — +20 days'];
  return '<div class="po-installment-section">'
    + '<div class="po-installment-title">💳 Split Payment Schedule</div>'
    + labels.map((lbl, i) =>
        '<div class="po-installment-row">'
          + '<span class="po-installment-label">' + lbl + '</span>'
          + '<input class="po-installment-input" type="number" min="0" step="0.01"'
            + ' id="split-amt-' + i + '" value="' + defAmts[i] + '"'
            + ' oninput="updateSplitRemaining(' + total + ')">'
          + '<span class="po-installment-due">₱ each</span>'
        + '</div>'
      ).join('')
    + '<div class="po-installment-remaining" id="split-remaining"></div>'
    + '</div>';
}

function updateSplitRemaining(total){
  const a0 = parseFloat(document.getElementById('split-amt-0')?.value) || 0;
  const a1 = parseFloat(document.getElementById('split-amt-1')?.value) || 0;
  const a2 = parseFloat(document.getElementById('split-amt-2')?.value) || 0;
  const sum = Math.round((a0 + a1 + a2) * 100) / 100;
  const diff= Math.round((total - sum) * 100) / 100;
  const el  = document.getElementById('split-remaining');
  if(!el) return;
  if(Math.abs(diff) < 0.01){
    el.style.background='#E8F5E9'; el.style.color='#27AE60';
    el.textContent = '✓ Total matches PO amount (₱' + total.toLocaleString('en-PH',{minimumFractionDigits:2}) + ')';
  } else if(diff > 0){
    el.style.background='#FFF8E1'; el.style.color='#7B5800';
    el.textContent = '⚠ ₱' + diff.toLocaleString('en-PH',{minimumFractionDigits:2}) + ' still unallocated';
  } else {
    el.style.background='#FFEBEE'; el.style.color='#C62828';
    el.textContent = '⚠ Over-allocated by ₱' + Math.abs(diff).toLocaleString('en-PH',{minimumFractionDigits:2});
  }
}

// Collects the 3 installment inputs and calculates due dates from delivery date
function getSplitData(delivDateStr){
  const base = delivDateStr ? new Date(delivDateStr) : new Date();
  const d2   = new Date(base); d2.setDate(d2.getDate() + 10);
  const d3   = new Date(base); d3.setDate(d3.getDate() + 20);
  const iso  = d => d.toLocaleString('sv-SE', {timeZone:'Asia/Manila'}).split(' ')[0];
  const amt  = i => parseFloat(document.getElementById('split-amt-' + i)?.value) || 0;
  return [
    {num:1, label:'1st (COD)',      amount:amt(0), dueDate:iso(base), status:'Pending'},
    {num:2, label:'2nd (+10 days)', amount:amt(1), dueDate:iso(d2),   status:'Pending'},
    {num:3, label:'3rd (+20 days)', amount:amt(2), dueDate:iso(d3),   status:'Pending'}
  ];
}

async function markInstallmentPaid(idx){
  if(!currentPO || !Array.isArray(currentPO.paymentSchedule)) return;
  const inst = currentPO.paymentSchedule[idx];
  if(!inst || inst.status === 'Paid') return;

  const paidAmtStr = prompt(
    'Mark installment ' + inst.num + ' as paid\n'
    + inst.label + ' — Scheduled: ₱' + Number(inst.amount).toLocaleString('en-PH',{minimumFractionDigits:2})
    + '\n\nEnter actual amount paid (₱):'
  );
  if(paidAmtStr === null) return; // cancelled
  const paidAmt = parseFloat(paidAmtStr);
  if(isNaN(paidAmt) || paidAmt <= 0){ alert('Please enter a valid amount.'); return; }

  const now = new Date().toLocaleString('sv-SE', {timeZone:'Asia/Manila'}).split(' ')[0];
  if(!confirm(
    'Confirm payment:\n\n'
    + 'Installment ' + inst.num + ' — ' + inst.label + '\n'
    + 'Scheduled: ₱' + Number(inst.amount).toLocaleString('en-PH',{minimumFractionDigits:2}) + '\n'
    + 'Actual paid: ₱' + paidAmt.toLocaleString('en-PH',{minimumFractionDigits:2}) + '\n'
    + 'Date: ' + now
  )) return;

  try{
    const r = await api({
      action:           'markInstallmentPaid',
      poNumber:         currentPO.poNumber,
      installmentIndex: idx,
      paidDate:         now,
      paidAmount:       paidAmt,
      markedBy:         currentUser.username
    });
    if(r.status === 'ok'){
      showToast('Installment ' + inst.num + ' marked as paid ✓', 'success');
      await openPODetail(currentPO.poNumber);
    } else {
      alert('Error: ' + (r.msg || 'Could not update'));
    }
  } catch(e){ alert('Network error: ' + e.message); }
}

function onPOPaymentModeChange(){
  const mode  = document.getElementById('po-payment-mode').value;
  const field = document.getElementById('po-cheque-field');
  if(field) field.style.display = mode === 'Cheque' ? 'block' : 'none';

  const splitWrap = document.getElementById('po-split-wrap');
  if(splitWrap){
    if(mode === 'Split / Installment'){
      if(!splitWrap.innerHTML.trim()){
        const total = currentPO ? Number(currentPO.totalValue || 0) : 0;
        splitWrap.innerHTML = buildSplitRowsHTML(total, currentPO?.paymentSchedule || null);
        updateSplitRemaining(total);
      }
      splitWrap.style.display = 'block';
    } else {
      splitWrap.style.display = 'none';
    }
  }
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

function backToPOList(){
  currentPO=null;
  document.getElementById('po-view-detail').style.display='none';
  document.getElementById('po-view-list').style.display='flex';
  // Restore the correct tab highlight without resetting poTypeView
  document.querySelectorAll('.po-subtab').forEach(t=>t.classList.remove('active'));
  const activeTabId=poTypeView==='DIST'?'po-tab-dist':poTypeView==='RETAIL'?'po-tab-retail':'po-tab-list';
  const activeTab=document.getElementById(activeTabId);
  if(activeTab)activeTab.classList.add('active');
  updatePOTypeBanner();
  renderPOList();
}
async function approvePO(){
  const days       = document.getElementById('po-terms-days')              ? document.getElementById('po-terms-days').value                              : '';
  const mode       = document.getElementById('po-payment-mode')            ? document.getElementById('po-payment-mode').value                            : '';
  const cheque     = document.getElementById('po-cheque-ref')              ? document.getElementById('po-cheque-ref').value.trim().toUpperCase()          : '';
  const dueDisp    = document.getElementById('po-due-date-display')        ? document.getElementById('po-due-date-display').textContent                   : '';
  const delivInput = document.getElementById('po-approval-delivery-date')  ? document.getElementById('po-approval-delivery-date').value                   : '';

  if(!mode){
    alert('Please select a payment mode before approving.');return;
  }
  // Cheque ref is optional at approval — a supervisor can request a cheque without the
  // number yet (Admin issues it and records the ref later). If entered, it must be valid.
  if(mode==='Cheque' && cheque.length>0 && cheque.length!==10){
    alert('Cheque reference must be exactly 10 characters (or leave it blank to request a cheque from Admin).');return;
  }

  // Collect and validate split schedule
  let splitSchedule = null;
  if(mode === 'Split / Installment'){
    splitSchedule = getSplitData(delivInput);
    const total   = Number(currentPO.totalValue || 0);
    const sum     = Math.round(splitSchedule.reduce((s,i)=>s+i.amount,0)*100)/100;
    if(Math.abs(sum - total) > 0.02){
      alert('Split amounts don\'t add up to the PO total (₱' + total.toLocaleString('en-PH',{minimumFractionDigits:2}) + ').\nCurrent sum: ₱' + sum.toLocaleString('en-PH',{minimumFractionDigits:2}) + '\nPlease adjust the installment amounts.');
      return;
    }
  }

  if(!confirm('Approve '+currentPO.poNumber+'?'))return;
  try{
    const r=await api({
      action:'approvePO',
      poNumber:currentPO.poNumber,
      approvedBy:currentUser.username,
      approverRole:currentUser.role,
      deliveryDate:delivInput||'',
      paymentTermsDays:mode==='Split / Installment'?'Split':days||'',
      paymentMode:mode||'',
      chequeRef:cheque||'',
      dueDate:dueDisp&&dueDisp!=='—'&&dueDisp!=='Upon Delivery'?dueDisp.replace(' (est.)',''):'',
      paymentSchedule: splitSchedule
    });
    if(r.status==='ok'){
      showBanner('po-success-bar','PO '+currentPO.poNumber+' approved'+(mode?' — '+mode+' payment':'')+' ✓');
      if(mode==='Cheque' && currentUser.role!=='admin'){
        showToast(r.chequeNotified
          ? currentPO.poNumber+' approved — Admin notified to prepare the cheque ✓'
          : currentPO.poNumber+' approved — please inform Admin to prepare the cheque',
          'info', 5000);
      } else {
        showToast(currentPO.poNumber+' approved'+(mode?' — '+mode:''),'success');
      }
      // Surface the delivery reminder so a silent Calendar failure is visible
      if(r.deliveryNote){
        const failed = String(r.deliveryNote).startsWith('ERROR');
        showToast(failed
          ? 'Calendar: could not add the delivery reminder — '+r.deliveryNote
          : '📅 Delivery reminder added — '+r.deliveryNote.replace(/^(Created|Updated) delivery reminder for /,''),
          failed ? 'error' : 'info', failed ? 7000 : 4500);
      }
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Approve failed: '+e.message);}
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
      showToast(currentPO.poNumber+' rejected — '+currentPO.createdBy+' needs to review','warning',5000);
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Reject failed: '+e.message);}
}

async function resubmitPO(){
  if(!confirm('Resubmit '+currentPO.poNumber+' for approval? Make sure you have addressed the rejection comments.'))return;
  try{
    const r=await api({action:'resubmitPO',poNumber:currentPO.poNumber,resubmittedBy:currentUser.username});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO resubmitted for approval ✓');
      showToast(currentPO.poNumber+' resubmitted for approval','info');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Resubmit failed: '+e.message);}
}
async function cancelPO(){
  if(!confirm('Cancel '+currentPO.poNumber+'? This cannot be undone.'))return;
  try{
    const r=await api({action:'cancelPO',poNumber:currentPO.poNumber,cancelledBy:currentUser.username});
    if(r.status==='ok'){
      showBanner('po-success-bar','PO cancelled');
      showToast(currentPO.poNumber+' cancelled','warning');
      await openPODetail(currentPO.poNumber);await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){alert('Cancel failed: '+e.message);}
}

async function deletePO(){
  const po = currentPO;
  const receivedWarning = po.status === 'RECEIVED'
    ? '\n\n⚠️ This PO has already been RECEIVED. Deleting it will NOT reverse the stock-in entries — inventory counts will remain as-is.'
    : '';
  if(!confirm(
    'Permanently delete ' + po.poNumber + '?\n\n'
    + 'This will remove the PO and all its line items from the database.\n'
    + 'This action cannot be undone.'
    + receivedWarning
  )) return;
  try{
    const r = await api({ action:'deletePO', poNumber:po.poNumber, deletedBy:currentUser.username });
    if(r.status==='ok'){
      showToast(po.poNumber+' permanently deleted','warning',4000);
      backToPOList();
      await loadPOs();
    } else alert('Error: '+r.msg);
  }catch(e){ alert('Network error: '+e.message); }
}

// Live price-change insight on the receive screen — compares the cost being entered
// against what was ordered (and the cost on file), so supplier increases are visible.
function updateRecvPriceBadge(i){
  if(!currentPO || !currentPO.lineItems) return;
  const li    = currentPO.lineItems[i];
  const input = document.getElementById('recv-cost-'+i);
  const badge = document.getElementById('recv-badge-'+i);
  if(!li || !input || !badge) return;
  const ordered  = Number(li.unitCost) || 0;
  const received = parseFloat(input.value);
  if(isNaN(received) || received <= 0 || ordered <= 0){ badge.innerHTML = ''; return; }
  const fmt  = v => '₱'+Math.abs(Number(v)).toLocaleString('en-PH',{minimumFractionDigits:2});
  const diff = received - ordered;
  const pct  = ordered > 0 ? (diff/ordered*100) : 0;

  let html;
  if(Math.abs(diff) < 0.005){
    html = '<span class="recv-price-same">✓ same as ordered ('+fmt(ordered)+')</span>';
  } else if(diff > 0){
    html = '<span class="recv-price-up">🔺 +'+fmt(diff)+' vs ordered (+'+pct.toFixed(1)+'%)</span>';
  } else {
    html = '<span class="recv-price-down">🔻 −'+fmt(diff)+' vs ordered ('+pct.toFixed(1)+'%)</span>';
  }
  // Context: current cost on file (SKU Master), when it differs from the ordered cost
  const sku    = (typeof liveSKUs !== 'undefined') ? liveSKUs.find(s => s.code === li.skuCode) : null;
  const onFile = (sku && sku.cost) ? Number(sku.cost) : null;
  if(onFile != null && Math.abs(onFile - ordered) >= 0.005){
    html += ' <span class="recv-price-note">· on file '+fmt(onFile)+'</span>';
  }
  badge.innerHTML = html;
}

let _poReceiving = false;   // guards against a double-tap on Confirm Receipt
async function receiveItems(){
  const lines = currentPO.lineItems || [];
  const receipts = [];
  const docRef = document.getElementById('po-doc-ref') ? document.getElementById('po-doc-ref').value.trim() : '';

  let overReceiptMsg = '';
  lines.forEach((li, i)=>{
    const qtyInput  = document.getElementById('recv-qty-'+i);
    const costInput = document.getElementById('recv-cost-'+i);
    if(!qtyInput) return; // already fully received
    const qty  = parseFloat(qtyInput.value)  || 0;
    const cost = parseFloat(costInput ? costInput.value : li.unitCost) || Number(li.unitCost) || 0;
    const outstanding = Number(li.qtyOutstanding) || (Number(li.qtyOrdered) - Number(li.qtyReceived||0));
    if(qty > outstanding){
      overReceiptMsg += '• ' + (li.itemName||li.skuCode) + ': entered ' + qty + ' but only ' + outstanding + ' outstanding\n';
    }
    if(qty > 0) receipts.push({
      skuCode:     li.skuCode,
      itemName:    li.itemName||li.skuCode,
      qtyReceived: qty,
      unitCost:    cost,
      unit:        li.unit || 'bag',
      lineIndex:   i
    });
  });

  if(overReceiptMsg){
    alert('Cannot receive more than the outstanding quantity:\n\n' + overReceiptMsg + '\nPlease correct the quantities. If the supplier delivered extra, edit the PO line items first.');
    return;
  }
  if(!receipts.length){ alert('Enter quantities to receive for at least one item.'); return; }

  const confirmMsg = receipts.map(r =>
    r.qtyReceived + ' x ' + r.itemName + ' @ ₱' + Number(r.unitCost).toLocaleString('en-PH',{minimumFractionDigits:2})
  ).join('\n');

  // Detect cost changes vs the price list (cost on file) to show before confirming
  const _cfmt = v => '₱'+Number(v).toLocaleString('en-PH',{minimumFractionDigits:2});
  const priceChanges = [];
  receipts.forEach(r => {
    const sku = (typeof liveSKUs!=='undefined') ? liveSKUs.find(s=>s.code===r.skuCode) : null;
    const onFile = (sku && sku.cost) ? Number(sku.cost) : null;
    if(onFile != null && Math.abs(Number(r.unitCost) - onFile) >= 0.005){
      priceChanges.push('• ' + r.itemName + ': ' + _cfmt(onFile) + ' → ' + _cfmt(r.unitCost));
    }
  });

  let confirmText = 'Confirm receipt of:\n\n' + confirmMsg + '\n\nThis will update inventory stock counts as STOCK IN.';
  if(priceChanges.length){
    confirmText += '\n\n💲 Your price list (cost on file) will update:\n' + priceChanges.join('\n');
  }
  if(!confirm(confirmText)) return;
  if(_poReceiving) return;          // block a double-tap while the request is in flight
  _poReceiving = true;

  try{
    const r = await api({
      action:      'receivePO',
      poNumber:    currentPO.poNumber,
      receivedBy:  currentUser.username,
      poType:      currentPO.type,
      docRef:      docRef,
      receipts
    });
    if(r.status==='ok' && r.duplicate){
      // Backend saw this exact receipt moments ago — a slow-response double-tap
      showToast('Already recorded — duplicate receipt ignored ✓','info',4500);
      await openPODetail(currentPO.poNumber);
    } else if(r.status==='ok'){
      const summary = receipts.length + ' item(s) received'
        + (docRef ? ' — Doc Ref: ' + docRef : '')
        + ' — inventory updated as STOCK IN ✓';
      showBanner('po-success-bar', summary);
      // Reflect price-list updates: refresh local cost cache + notify
      if(r.costUpdates && r.costUpdates.length){
        r.costUpdates.forEach(c => {
          const sku = (typeof liveSKUs!=='undefined') ? liveSKUs.find(s=>s.code===c.skuCode) : null;
          if(sku) sku.cost = Number(c.newCost);
        });
        showToast('Price list updated — new cost on file for ' + r.costUpdates.length + ' item' + (r.costUpdates.length!==1?'s':''), 'success', 4500);
        if(typeof loadPLData === 'function') loadPLData(); // refresh Product List data in background
      }
      if(r.calendarNote){
        const isErr = r.calendarNote.startsWith('ERROR:') || r.calendarNote.includes('not found');
        showToast(
          isErr ? 'Calendar: ' + r.calendarNote : 'Calendar event created — ' + r.calendarNote,
          isErr ? 'error' : 'success',
          isErr ? 6000 : 4000
        );
      }
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    }else alert('Error: '+r.msg);
  }catch(e){ alert('Network error: '+e.message); }
  finally { _poReceiving = false; }
}

// ── REVERSE DUPLICATE RECEIPT (admin — undo a double-submit) ───────────────
// Detects near-in-time identical receipt-history entries client-side to show the
// banner; the actual reversal is computed & applied server-side (dry-run first).
function _poDupReceiptCount(receiptHistory){
  if(!receiptHistory) return 0;
  const entries = receiptHistory.split('|||').map(e=>{
    const m = e.trim().match(/^\[([^\]·]+)·([^\]]*)\]\s*(.*)$/);
    return { ts:(m?m[1].trim():''), by:(m?m[2].trim():''), rest:(m?m[3].trim():e.trim()) };
  });
  const keep = entries.map(()=>true); let dups = 0;
  for(let i=0;i<entries.length;i++){
    for(let j=0;j<i;j++){
      if(!keep[j]) continue;
      if(entries[j].by===entries[i].by && entries[j].rest===entries[i].rest && entries[i].rest){
        const di=new Date(entries[i].ts.replace(' ','T')+':00');
        const dj=new Date(entries[j].ts.replace(' ','T')+':00');
        if(!isNaN(di.getTime()) && !isNaN(dj.getTime()) && Math.abs(di.getTime()-dj.getTime())<10*60*1000){
          keep[i]=false; dups++; break;
        }
      }
    }
  }
  return dups;
}

async function reverseDuplicatePO(){
  if(!currentPO) return;
  const po = currentPO;
  // 1) Dry-run to compute the exact plan
  let plan;
  try{
    const r = await api({action:'reverseDuplicateReceipt', poNumber:po.poNumber, poType:po.type,
      role:currentUser.role, by:currentUser.username, dryRun:true});
    if(r.status!=='ok'){ alert('Error: '+(r.msg||'Could not scan')); return; }
    if(!r.removedCount){ alert(r.message||'No duplicate receipts detected on this PO.'); return; }
    plan = r;
  }catch(e){ alert('Network error: '+e.message); return; }

  // 2) Confirm with the precise before/after
  let msg = 'Reverse '+plan.removedCount+' duplicate receipt'+(plan.removedCount!==1?'s':'')+' on '+po.poNumber+'?\n\nThis will correct:';
  (plan.plan||[]).forEach(p=>{
    msg += '\n• '+p.item+':  received '+p.receivedBefore+'→'+p.receivedAfter+',  stock '+p.stockBefore+'→'+p.stockAfter;
  });
  if(plan.unmapped && plan.unmapped.length) msg += '\n\n⚠ Could not match to a SKU (left alone): '+plan.unmapped.join(', ');
  msg += '\n\nThe duplicate line is removed from Receipt History. This cannot be auto-undone.';
  if(!confirm(msg)) return;

  // 3) Apply
  try{
    const r = await api({action:'reverseDuplicateReceipt', poNumber:po.poNumber, poType:po.type,
      role:currentUser.role, by:currentUser.username, dryRun:false});
    if(r.status!=='ok'){ alert('Error: '+(r.msg||'Could not reverse')); return; }
    showToast('Duplicate receipt reversed — stock & PO corrected ✓','success',5000);
    await openPODetail(po.poNumber);
    await loadPOs();
    if(typeof loadPLData==='function') loadPLData();
  }catch(e){ alert('Network error: '+e.message); }
}

// ── EDIT PAYMENT DETAILS ──────────────────────────────────────────────────
function openEditPaymentModal(){
  const po = currentPO;
  if(!po) return;

  // Pre-fill label
  document.getElementById('epm-po-label').textContent =
    po.poNumber + ' — ' + po.supplier;

  // Pre-fill mode
  const modeEl = document.getElementById('epm-mode');
  modeEl.value = po.paymentMode || '';
  epmOnModeChange();

  // Pre-fill cheque ref
  const chequeEl = document.getElementById('epm-cheque');
  chequeEl.value = po.chequeRef || '';

  // Pre-fill amount — use previously saved amountPaid, else default to PO total
  const amountEl = document.getElementById('epm-amount');
  amountEl.value = po.amountPaid > 0 ? po.amountPaid : (po.totalValue || 0);

  // Show PO total as reference
  const totalRef = document.getElementById('epm-total-ref');
  if(totalRef) totalRef.textContent = 'PO Total: ₱' + Number(po.totalValue||0).toLocaleString('en-PH',{minimumFractionDigits:2});

  // Pre-fill terms
  const termsEl = document.getElementById('epm-terms');
  termsEl.value = po.paymentTermsDays || '';

  // Pre-fill delivery date — derive from due date or use today
  const delivEl = document.getElementById('epm-delivery');
  try {
    const base = po.deliveryDate
      ? new Date(po.deliveryDate).toLocaleDateString('sv-SE',{timeZone:'Asia/Manila'})
      : phToday();
    delivEl.value = base;
  } catch(e){ delivEl.value = phToday(); }

  epmCalcDue();
  epmCheckOverpay();
  document.getElementById('epm-err').textContent = '';
  document.getElementById('edit-payment-modal').style.display = 'flex';
}

function epmCheckOverpay(){
  const po      = currentPO;
  const amount  = parseFloat(document.getElementById('epm-amount').value) || 0;
  const total   = po ? Number(po.totalValue||0) : 0;
  const warnEl  = document.getElementById('epm-overpay-warn');
  const noteEl  = document.getElementById('epm-underpay-note');
  if(!warnEl || !noteEl) return;

  if(amount > total && total > 0){
    const over = amount - total;
    warnEl.style.display = 'block';
    warnEl.innerHTML = '⚠️ <strong>Overpayment of ₱' + over.toLocaleString('en-PH',{minimumFractionDigits:2}) + '</strong>'
      + '<br>Cheque exceeds PO total by ₱' + over.toLocaleString('en-PH',{minimumFractionDigits:2})
      + '. This will be recorded as a credit balance from <strong>' + (po.supplier||'supplier') + '</strong>.';
    noteEl.style.display = 'none';
  } else if(amount > 0 && amount < total){
    const remaining = total - amount;
    noteEl.style.display = 'block';
    noteEl.textContent = 'ℹ️ Partial payment — ₱' + remaining.toLocaleString('en-PH',{minimumFractionDigits:2}) + ' remaining balance.';
    warnEl.style.display = 'none';
  } else {
    warnEl.style.display = 'none';
    noteEl.style.display = 'none';
  }
}

function closeEditPaymentModal(){
  document.getElementById('edit-payment-modal').style.display = 'none';
}

function epmOnModeChange(){
  const mode      = document.getElementById('epm-mode').value;
  const cheqWrap  = document.getElementById('epm-cheque-wrap');
  const splitWrap = document.getElementById('epm-split-wrap');
  const amtWrap   = document.getElementById('epm-amount-wrap');
  const termsLbl  = document.querySelector('#edit-payment-modal .epm-label[for-terms]');

  if(cheqWrap)  cheqWrap.style.display  = mode === 'Cheque' ? 'block' : 'none';
  if(amtWrap)   amtWrap.style.display   = mode === 'Split / Installment' ? 'none' : 'block';

  if(splitWrap){
    if(mode === 'Split / Installment'){
      const po    = currentPO;
      const total = po ? Number(po.totalValue || 0) : 0;
      splitWrap.innerHTML = buildSplitRowsHTML(total, po?.paymentSchedule || null);
      updateSplitRemaining(total);
      splitWrap.style.display = 'block';
    } else {
      splitWrap.style.display = 'none';
    }
  }
}

function epmCalcDue(){
  const terms   = document.getElementById('epm-terms').value;
  const delivEl = document.getElementById('epm-delivery');
  const disp    = document.getElementById('epm-due-display');
  if(!disp) return;
  if(terms === '') { disp.textContent = 'Est. due date: —'; return; }
  if(terms === '0'){ disp.textContent = 'Est. due date: Upon Delivery'; return; }
  try {
    const base = delivEl && delivEl.value ? new Date(delivEl.value) : new Date();
    const due  = new Date(base);
    due.setDate(due.getDate() + parseInt(terms));
    disp.textContent = 'Est. due date: ' + phDate(due);
  } catch(e){ disp.textContent = 'Est. due date: —'; }
}

async function savePaymentDetails(){
  const po         = currentPO;
  const mode       = document.getElementById('epm-mode').value;
  const cheque     = document.getElementById('epm-cheque').value.trim().toUpperCase();
  const terms      = document.getElementById('epm-terms').value;
  const dueDisp    = document.getElementById('epm-due-display').textContent.replace('Est. due date: ','').trim();
  const amountPaid = parseFloat(document.getElementById('epm-amount').value) || 0;
  const total      = Number(po.totalValue||0);
  const overpayment= Math.max(0, amountPaid - total);
  const errEl      = document.getElementById('epm-err');

  if(!mode){ errEl.textContent = 'Please select a payment mode.'; return; }
  if(mode === 'Cheque' && cheque.length !== 10){
    errEl.textContent = 'Cheque reference must be exactly 10 characters.'; return;
  }

  // Collect and validate split schedule
  let splitSchedule = null;
  if(mode === 'Split / Installment'){
    const delivEl2 = document.getElementById('epm-delivery');
    splitSchedule  = getSplitData(delivEl2 ? delivEl2.value : '');
    const splitSum = Math.round(splitSchedule.reduce((s,i)=>s+i.amount,0)*100)/100;
    if(Math.abs(splitSum - total) > 0.02){
      errEl.textContent = 'Split amounts (₱' + splitSum.toLocaleString('en-PH',{minimumFractionDigits:2}) + ') don\'t match PO total (₱' + total.toLocaleString('en-PH',{minimumFractionDigits:2}) + ').';
      return;
    }
  }

  if(mode !== 'Split / Installment' && amountPaid <= 0){
    errEl.textContent = 'Please enter the amount paid.'; return;
  }

  // Extra confirmation for overpayment
  if(mode !== 'Split / Installment' && overpayment > 0){
    if(!confirm(
      'Overpayment detected!\n\n'
      + 'PO Total:     ₱' + total.toLocaleString('en-PH',{minimumFractionDigits:2}) + '\n'
      + 'Amount Paid:  ₱' + amountPaid.toLocaleString('en-PH',{minimumFractionDigits:2}) + '\n'
      + 'Overpayment:  ₱' + overpayment.toLocaleString('en-PH',{minimumFractionDigits:2}) + '\n\n'
      + 'This overpayment will be recorded as a credit balance from ' + po.supplier + '.\n\nProceed?'
    )) return;
  }

  errEl.textContent = '';

  const btn = document.getElementById('epm-save-btn');
  btn.disabled = true; btn.textContent = 'Saving...';

  try{
    const r = await api({
      action:           'updatePOPayment',
      poNumber:         po.poNumber,
      editedBy:         currentUser.username,
      // old values (for history log)
      oldPaymentMode:   po.paymentMode     || '',
      oldChequeRef:     po.chequeRef       || '',
      oldTermsDays:     po.paymentTermsDays|| '',
      oldDueDate:       po.dueDate         || '',
      oldAmountPaid:    po.amountPaid      || 0,
      // new values
      paymentMode:      mode,
      chequeRef:        mode === 'Cheque' ? cheque : '',
      paymentTermsDays: mode === 'Split / Installment' ? 'Split' : terms,
      dueDate:          (dueDisp === '—' || dueDisp === 'Upon Delivery') ? dueDisp : dueDisp,
      amountPaid:       mode === 'Split / Installment' ? 0 : amountPaid,
      overpayment:      mode === 'Split / Installment' ? 0 : overpayment,
      paymentSchedule:  splitSchedule
    });

    if(r.status === 'ok'){
      closeEditPaymentModal();
      showToast('Payment details updated for ' + po.poNumber, 'success', 4000);
      await openPODetail(po.poNumber);
      await loadPOs();
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Unknown error');
    }
  } catch(e){
    errEl.textContent = 'Save failed: ' + e.message;
  }
  btn.disabled = false; btn.textContent = 'Save Changes';
}

// ── EDIT LINE ITEMS (admin only) ─────────────────────────────────────────────
let _eliItems = [];

// Single source of truth for who may edit a PO's line items, so the button and
// the modal can never disagree: admin on any active PO, or an approver on the
// PENDING PO they're being asked to decide.
function canEditPOLines(po){
  if(!po || !currentUser) return false;
  if(['RECEIVED','CANCELLED'].includes(po.status)) return false;
  if(currentUser.role === 'admin') return true;
  const isApprover = (po.type==='DIST'   && currentUser.canApprovePODist===true)
                  || (po.type==='RETAIL' && currentUser.canApprovePORetail===true);
  return isApprover && po.status === 'PENDING';
}

function openEditLineItemsModal(){
  if(!canEditPOLines(currentPO)) return;
  _eliItems = (currentPO.lineItems||[]).map(li=>({
    skuCode:      String(li.skuCode||''),
    itemName:     String(li.itemName||li.skuCode||''),
    qtyOrdered:   Number(li.qtyOrdered)||0,
    unit:         String(li.unit||'bag'),
    unitCost:     Number(li.unitCost)||0,
    discount:     Number(li.discount)||0,
    discountType: String(li.discountType||'%'),
    qtyReceived:  Number(li.qtyReceived)||0,
    removed:      false
  }));
  document.getElementById('eli-po-label').textContent =
    currentPO.poNumber + ' — ' + currentPO.supplier + ' (' + currentPO.status + ')';
  document.getElementById('eli-err').textContent = '';
  _eliRender();
  document.getElementById('edit-lineitems-modal').style.display = 'flex';
}

function closeEditLineItemsModal(){
  document.getElementById('edit-lineitems-modal').style.display = 'none';
}

function _eliCalcNet(item){
  const gross = item.qtyOrdered * (item.unitCost||0);
  if(!item.discount) return gross;
  return item.discountType === '₱'
    ? Math.max(0, gross - item.discount * item.qtyOrdered)
    : Math.max(0, gross * (1 - item.discount/100));
}

function _eliRender(){
  const body = document.getElementById('eli-body');
  body.innerHTML = '';
  _eliItems.forEach((item, idx)=>{
    if(item.removed) return;
    const net = _eliCalcNet(item);
    const rcvNote = item.qtyReceived > 0
      ? '<span style="font-size:10px;color:#2196F3;margin-left:5px">('+item.qtyReceived+' received)</span>' : '';
    const delDisabled = item.qtyReceived > 0
      ? 'disabled title="Cannot remove — items already received" style="opacity:0.3"' : '';
    const pctActive = item.discountType==='%' ? ' po-disc-type-active' : '';
    const phpActive = item.discountType==='₱' ? ' po-disc-type-active' : '';
    const row = document.createElement('div');
    row.className = 'eli-row';
    row.id = 'eli-row-'+idx;
    row.innerHTML =
      '<div class="eli-row-name">'+item.itemName
        +'<span style="font-size:10px;color:#aaa;margin-left:5px">'+item.skuCode+'</span>'
        +rcvNote
      +'</div>'
      +'<div class="eli-row-inputs">'
        +'<div class="eli-field"><span class="eli-lbl">Qty</span>'
          +'<input class="eli-input" type="number" min="'+item.qtyReceived+'" value="'+item.qtyOrdered+'" oninput="_eliUpdate('+idx+',\'qty\',this.value)"></div>'
        +'<div class="eli-field"><span class="eli-lbl">Unit Cost ₱</span>'
          +'<input class="eli-input" type="number" min="0" step="0.01" value="'+item.unitCost+'" oninput="_eliUpdate('+idx+',\'cost\',this.value)"></div>'
        +'<div class="eli-field"><span class="eli-lbl">Discount</span>'
          +'<div style="display:flex;gap:0">'
            +'<button type="button" class="po-disc-type-btn'+pctActive+'" onclick="_eliDiscType('+idx+',\'%\')">%</button>'
            +'<button type="button" class="po-disc-type-btn'+phpActive+'" onclick="_eliDiscType('+idx+',\'₱\')">₱</button>'
          +'</div>'
          +'<input class="eli-input" type="number" min="0" style="width:50px" value="'+(item.discount||'')+'" placeholder="0" oninput="_eliUpdate('+idx+',\'disc\',this.value)"></div>'
        +'<div class="eli-field"><span class="eli-lbl">Net</span>'
          +'<div class="eli-net" id="eli-net-'+idx+'">₱'+net.toLocaleString('en-PH',{minimumFractionDigits:2})+'</div></div>'
      +'</div>'
      +'<button class="po-line-del" onclick="_eliRemove('+idx+')" '+delDisabled+'>×</button>';
    body.appendChild(row);
  });
  _eliUpdateTotal();
}

function _eliUpdate(idx, field, val){
  if(field==='qty')  _eliItems[idx].qtyOrdered = Math.max(_eliItems[idx].qtyReceived||0, parseFloat(val)||0);
  if(field==='cost') _eliItems[idx].unitCost   = parseFloat(val)||0;
  if(field==='disc') _eliItems[idx].discount   = parseFloat(val)||0;
  const netEl = document.getElementById('eli-net-'+idx);
  if(netEl) netEl.textContent = '₱'+_eliCalcNet(_eliItems[idx]).toLocaleString('en-PH',{minimumFractionDigits:2});
  _eliUpdateTotal();
}

function _eliDiscType(idx, type){
  _eliItems[idx].discountType = type;
  _eliRender();
}

function _eliRemove(idx){
  if(_eliItems[idx].qtyReceived > 0){ alert('Cannot remove this line — '+_eliItems[idx].qtyReceived+' unit(s) have already been received.'); return; }
  if(!confirm('Remove "'+_eliItems[idx].itemName+'" from this PO?')) return;
  _eliItems[idx].removed = true;
  const row = document.getElementById('eli-row-'+idx);
  if(row) row.remove();
  _eliUpdateTotal();
}

function _eliUpdateTotal(){
  const total = _eliItems.filter(i=>!i.removed).reduce((s,i)=>s+_eliCalcNet(i),0);
  const el = document.getElementById('eli-grand-total');
  if(el) el.textContent = '₱'+total.toLocaleString('en-PH',{minimumFractionDigits:2});
}

function _eliAddLine(){
  const type     = currentPO.type;
  const supplier = currentPO.supplier;
  const filtered  = liveSKUs.filter(s=>s.type===type && s.supplier===supplier);
  const unassigned= liveSKUs.filter(s=>s.type===type && (!s.supplier||!s.supplier.trim()));
  const cats = [...new Set(filtered.map(s=>s.category))];
  let skuOpts = '<option value="">-- Select item --</option>';
  skuOpts += cats.map(cat=>{
    const items = filtered.filter(s=>s.category===cat)
      .map(s=>`<option value="${s.code}|${s.name}|${s.cost||0}|${s.unit||'bag'}">${s.name}${s.cost?' · ₱'+Number(s.cost).toLocaleString('en-PH'):''}</option>`)
      .join('');
    return items ? `<optgroup label="📦 ${cat}">${items}</optgroup>` : '';
  }).join('');
  if(unassigned.length){
    skuOpts += '<optgroup label="⚠️ No Supplier">'+unassigned.map(s=>
      `<option value="${s.code}|${s.name}|${s.cost||0}|${s.unit||'bag'}">${s.name}</option>`).join('')+'</optgroup>';
  }

  const newIdx = _eliItems.length;
  _eliItems.push({skuCode:'',itemName:'',qtyOrdered:1,unit:'bag',unitCost:0,discount:0,discountType:'%',qtyReceived:0,removed:false,isNew:true});

  const body = document.getElementById('eli-body');
  const row  = document.createElement('div');
  row.className = 'eli-row eli-new-row';
  row.id = 'eli-row-'+newIdx;
  row.innerHTML =
    '<div class="eli-row-name" style="margin-bottom:6px">'
      +'<select style="width:100%;padding:6px 8px;border:1.5px solid #e0e0e0;border-radius:7px;font-size:11px;outline:none;color:#222;background:white" onchange="_eliNewSelect('+newIdx+',this)">'+skuOpts+'</select>'
    +'</div>'
    +'<div class="eli-row-inputs">'
      +'<div class="eli-field"><span class="eli-lbl">Qty</span>'
        +'<input class="eli-input" type="number" min="1" value="1" oninput="_eliUpdate('+newIdx+',\'qty\',this.value)"></div>'
      +'<div class="eli-field"><span class="eli-lbl">Unit Cost ₱</span>'
        +'<input class="eli-input" type="number" min="0" step="0.01" id="eli-new-cost-'+newIdx+'" placeholder="0.00" oninput="_eliUpdate('+newIdx+',\'cost\',this.value)"></div>'
      +'<div class="eli-field"><span class="eli-lbl">Net</span>'
        +'<div class="eli-net" id="eli-net-'+newIdx+'">—</div></div>'
    +'</div>'
    +'<button class="po-line-del" onclick="_eliRemove('+newIdx+')">×</button>';
  body.appendChild(row);
}

function _eliNewSelect(idx, sel){
  if(!sel.value) return;
  const parts = sel.value.split('|');
  _eliItems[idx].skuCode  = parts[0];
  _eliItems[idx].itemName = parts[1]||parts[0];
  _eliItems[idx].unitCost = parseFloat(parts[2])||0;
  _eliItems[idx].unit     = parts[3]||'bag';
  const costInput = document.getElementById('eli-new-cost-'+idx);
  if(costInput) costInput.value = _eliItems[idx].unitCost||'';
  const netEl = document.getElementById('eli-net-'+idx);
  if(netEl) netEl.textContent = '₱'+_eliCalcNet(_eliItems[idx]).toLocaleString('en-PH',{minimumFractionDigits:2});
  _eliUpdateTotal();
}

async function saveEditedLineItems(){
  if(!canEditPOLines(currentPO)) return;
  const active = _eliItems.filter(i=>!i.removed && i.skuCode);
  if(!active.length){
    document.getElementById('eli-err').textContent = 'At least one line item is required.';
    return;
  }
  const incomplete = _eliItems.filter(i=>!i.removed && !i.skuCode);
  if(incomplete.length){
    document.getElementById('eli-err').textContent = 'Please select an item for all new lines, or remove them.';
    return;
  }
  const newTotal = active.reduce((s,i)=>s+_eliCalcNet(i),0);
  if(!confirm(
    'Update line items for '+currentPO.poNumber+'?\n\n'
    +active.length+' item(s) — New total: ₱'+newTotal.toLocaleString('en-PH',{minimumFractionDigits:2})+'\n\n'
    +'This will replace all current line items. Any already-received quantities will be preserved.'
  )) return;

  const btn = document.getElementById('eli-save-btn');
  btn.disabled=true; btn.textContent='Saving...';
  document.getElementById('eli-err').textContent='';

  try{
    const r = await api({
      action:    'editPOLineItems',
      poNumber:  currentPO.poNumber,
      editedBy:  currentUser.username,
      lineItems: active.map(i=>({
        skuCode:      i.skuCode,
        itemName:     i.itemName,
        unit:         i.unit||'bag',
        qtyOrdered:   i.qtyOrdered,
        unitCost:     i.unitCost,
        discount:     i.discount||0,
        discountType: i.discountType||'%',
        qtyReceived:  i.qtyReceived||0
      }))
    });
    if(r.status==='ok'){
      closeEditLineItemsModal();
      showToast('Line items updated for '+currentPO.poNumber+' ✓','success',4000);
      await openPODetail(currentPO.poNumber);
      await loadPOs();
    } else {
      document.getElementById('eli-err').textContent = 'Error: '+(r.msg||'Could not save');
    }
  }catch(e){
    document.getElementById('eli-err').textContent = 'Network error: '+e.message;
  }
  btn.disabled=false; btn.textContent='Save Changes';
}

// ── PRODUCTION CONVERSION SYSTEM ──
let bom = [];
let prodLines = [];
let prodCategory = 'All';

