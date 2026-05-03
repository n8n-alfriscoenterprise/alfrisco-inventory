async function openSA(){
  const isAdmin = currentUser && currentUser.role==='admin';
  const canSA   = isAdmin || currentUser.canStockAdjust===true;
  if(!canSA){ alert('You do not have permission to perform stock adjustments.'); return; }
  showScreen('sa-screen');
  updateFabVisibility();
  saSegment='dist'; saType='receive'; saLines=[]; saStockMap={};
  document.getElementById('sa-notes').value='';
  document.getElementById('sa-notes').classList.remove('required-empty');
  setSASegmentUI('dist');
  setSATypeUI('receive');
  await loadSAStockMap();
  addSALine();
  updateSASubmitBtn();
}

function closeSA(){ showHome(); }

async function loadSAStockMap(){
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      const items = saSegment==='dist' ? (r.dist||[]) : (r.retail||[]);
      saStockMap={};
      items.forEach(item=>{ saStockMap[item.sku] = item.stock!==null ? Number(item.stock) : 0; });
    }
  }catch(e){ console.error('loadSAStockMap',e); }
}

function setSASegment(seg){
  saSegment=seg; saLines=[]; saStockMap={};
  setSASegmentUI(seg);
  loadSAStockMap().then(()=>renderSALines());
}

function setSASegmentUI(seg){
  const d=document.getElementById('sa-seg-dist');
  const r=document.getElementById('sa-seg-retail');
  if(d) d.className='sa-seg-btn'+(seg==='dist'?' active-dist':'');
  if(r) r.className='sa-seg-btn'+(seg==='retail'?' active-retail':'');
}

function setSAType(type){
  saType=type;
  setSATypeUI(type);
  renderSALines();
}

function setSATypeUI(type){
  ['receive','count','remove','damage'].forEach(t=>{
    const btn=document.getElementById('sa-type-'+t);
    if(btn) btn.className='sa-type-btn'+(t===type?' active':'');
  });
}

function addSALine(){
  saLines.push({skuCode:'',skuName:'',qtyInput:'',costInput:'',currentStock:null});
  renderSALines();
  setTimeout(()=>{
    const el=document.getElementById('sa-lines');
    if(el&&el.lastElementChild) el.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },100);
}

function removeSALine(idx){
  saLines.splice(idx,1);
  if(!saLines.length) addSALine();
  else renderSALines();
  updateSASubmitBtn();
}

function renderSALines(){
  const container=document.getElementById('sa-lines');
  if(!container) return;
  container.innerHTML='';
  const typeFilter=saSegment==='dist'?'DIST':'RETAIL';
  const skus=liveSKUs.filter(s=>s.type===typeFilter);

  saLines.forEach((line,idx)=>{
    const skuOpts='<option value="">-- Select item --</option>'
      +skus.map(s=>'<option value="'+s.code+'|'+s.name+'"'+(line.skuCode===s.code?' selected':'')+'>'+s.name+'</option>').join('');

    const current = line.skuCode!=='' ? (saStockMap[line.skuCode]||0) : null;
    line.currentStock=current;

    const card=document.createElement('div');
    card.className='sa-line-card';
    card.id='sa-line-'+idx;
    card.innerHTML=
      '<div class="sa-line-header">'
        +'<span class="sa-line-num">Item '+(idx+1)+'</span>'
        +(saLines.length>1?'<button class="sa-line-del" onclick="removeSALine('+idx+')">&#215;</button>':'')
      +'</div>'
      +'<span class="sa-field-label">Item</span>'
      +'<select class="sa-sku-select" onchange="onSASKU('+idx+',this.value)">'+skuOpts+'</select>'
      +buildSAColsHTML(idx,line,current);
    container.appendChild(card);
  });
  updateSASubmitBtn();
}

function buildSAColsHTML(idx,line,current){
  const qty  = parseFloat(line.qtyInput)||0;
  const cur  = current!==null ? current : 0;
  const hasItem = line.skuCode!=='';

  if(saType==='receive'){
    const after = cur+qty;
    return '<div class="sa-cols-grid" style="grid-template-columns:1fr 1fr 1fr 1fr">'
      +'<div class="sa-col-cell"><span class="sa-field-label">In Stock</span>'
        +'<div class="sa-col-val">'+(hasItem?cur:'—')+'</div></div>'
      +'<div class="sa-col-cell"><span class="sa-field-label">Add Stock</span>'
        +'<input class="sa-col-input" type="number" min="0" step="1" value="'+(line.qtyInput||'')+'" placeholder="0" oninput="onSAQty('+idx+',this.value)"></div>'
      +'<div class="sa-col-cell"><span class="sa-field-label">Cost (&#8369;)</span>'
        +'<input class="sa-col-input" type="number" min="0" step="0.01" value="'+(line.costInput||'')+'" placeholder="0.00" oninput="saLines['+idx+'].costInput=this.value"></div>'
      +'<div class="sa-col-cell"><span class="sa-field-label">Stock After</span>'
        +'<div class="sa-col-val '+(hasItem&&qty>0?'positive':'')+'">'+(hasItem&&qty>0?after:'—')+'</div></div>'
      +'</div>';
  }
  if(saType==='count'){
    const diff=qty-cur;
    const diffStr=(diff>0?'+':'')+diff;
    const diffCls=diff>0?'positive':diff<0?'negative':'';
    return '<div class="sa-cols-grid" style="grid-template-columns:1fr 1fr 1fr">'
      +'<div class="sa-col-cell"><span class="sa-field-label">Expected Stock</span>'
        +'<div class="sa-col-val">'+(hasItem?cur:'—')+'</div></div>'
      +'<div class="sa-col-cell"><span class="sa-field-label">Counted Stock</span>'
        +'<input class="sa-col-input" type="number" min="0" step="1" value="'+(line.qtyInput||'')+'" placeholder="0" oninput="onSAQty('+idx+',this.value)"></div>'
      +'<div class="sa-col-cell"><span class="sa-field-label">Difference</span>'
        +'<div class="sa-col-val '+(hasItem&&line.qtyInput!==''?diffCls:'')+'">'+(hasItem&&line.qtyInput!==''?diffStr:'—')+'</div></div>'
      +'</div>';
  }
  // remove or damage
  const lbl   = saType==='damage'?'Damaged Stock':'Remove Stock';
  const after2= Math.max(0,cur-qty);
  return '<div class="sa-cols-grid" style="grid-template-columns:1fr 1fr 1fr">'
    +'<div class="sa-col-cell"><span class="sa-field-label">In Stock</span>'
      +'<div class="sa-col-val">'+(hasItem?cur:'—')+'</div></div>'
    +'<div class="sa-col-cell"><span class="sa-field-label">'+lbl+'</span>'
      +'<input class="sa-col-input" type="number" min="0" step="1" value="'+(line.qtyInput||'')+'" placeholder="0" oninput="onSAQty('+idx+',this.value)"></div>'
    +'<div class="sa-col-cell"><span class="sa-field-label">Stock After</span>'
      +'<div class="sa-col-val '+(hasItem&&qty>0?'negative':'')+'">'+(hasItem&&qty>0?after2:'—')+'</div></div>'
    +'</div>';
}

function onSASKU(idx,val){
  if(!val){ saLines[idx].skuCode=''; saLines[idx].skuName=''; renderSALines(); return; }
  const parts=val.split('|');
  saLines[idx].skuCode=parts[0]||'';
  saLines[idx].skuName=parts[1]||'';
  saLines[idx].currentStock=saStockMap[parts[0]]||0;
  const sku=liveSKUs.find(s=>s.code===parts[0]);
  if(sku&&sku.cost) saLines[idx].costInput=String(sku.cost);
  renderSALines();
}

function onSAQty(idx,val){
  saLines[idx].qtyInput=val;
  renderSALines();
}

function updateSASubmitBtn(){
  const btn=document.getElementById('sa-submit-btn');
  if(!btn) return;
  btn.disabled=!saLines.some(l=>l.skuCode&&l.qtyInput!=='');
}

async function submitSA(){
  const notes=document.getElementById('sa-notes').value.trim();
  if(!notes){
    document.getElementById('sa-notes').classList.add('required-empty');
    document.getElementById('sa-notes').focus();
    return;
  }
  document.getElementById('sa-notes').classList.remove('required-empty');

  const valid=saLines.filter(l=>l.skuCode&&l.qtyInput!=='');
  if(!valid.length){ alert('Select at least one item and enter a quantity.'); return; }

  const entries=valid.map(line=>{
    const qty=parseFloat(line.qtyInput)||0;
    const cur=saStockMap[line.skuCode]||0;
    let adjQty, stockAfter;
    if(saType==='receive')      { adjQty=qty;          stockAfter=cur+qty; }
    else if(saType==='count')   { adjQty=qty-cur;       stockAfter=qty; }
    else                        { adjQty=-Math.min(qty,cur); stockAfter=Math.max(0,cur-qty); }
    return { skuCode:line.skuCode, skuName:line.skuName,
             currentStock:cur, qtyInput:qty, adjQty, stockAfter,
             cost:saType==='receive'?(parseFloat(line.costInput)||0):0 };
  });

  const typeLabel=SA_TYPES[saType].label;
  const confirmLines=entries.map(e=>
    e.skuName+': '+e.currentStock+' → '+e.stockAfter
    +' ('+(e.adjQty>=0?'+':'')+e.adjQty+')'
  ).join('\n');

  if(!confirm(typeLabel+' — '+saSegment.toUpperCase()
    +'\n\n'+confirmLines
    +'\n\nNotes: '+notes
    +'\n\nApply these adjustments?')) return;

  const btn=document.getElementById('sa-submit-btn');
  btn.disabled=true; btn.textContent='Applying...';

  const now=new Date().toLocaleString('en-PH');
  const batchRef='SA-'+Date.now().toString().slice(-8);

  try{
    const r=await api({
      action:'submitStockAdjustment',
      segment:saSegment, adjType:saType, notes,
      batchRef, submittedBy:currentUser.username, timestamp:now, entries
    });
    if(r.status==='ok'){
      const bar=document.getElementById('sa-success-bar');
      bar.textContent='✓ '+typeLabel+' applied — '+entries.length+' item(s) updated';
      bar.style.display='block';
      setTimeout(()=>bar.style.display='none',5000);
      saLines=[]; saStockMap={};
      document.getElementById('sa-notes').value='';
      await loadSAStockMap();
      addSALine();
      btn.disabled=false; btn.textContent='📊 Apply Adjustment';
    } else {
      alert('Error: '+(r.msg||'Could not apply'));
      btn.disabled=false; btn.textContent='📊 Apply Adjustment';
    }
  }catch(e){
    alert('Network error: '+e.message);
    btn.disabled=false; btn.textContent='📊 Apply Adjustment';
  }
}

// ── UNIT SELECTOR CHANGE ──
