function openBoModal(){
  document.getElementById('bo-modal').style.display='flex';
  document.getElementById('bo-dealer').value='';
  document.getElementById('bo-phone').value='';
  document.getElementById('bo-date').value='';
  document.getElementById('bo-notes').value='';
  document.getElementById('bo-err').textContent='';
  const btn=document.getElementById('bo-submit-btn');
  if(btn){btn.disabled=false;btn.textContent='Submit Backorder';}
  const toggle=document.getElementById('bo-type-toggle');
  if(toggle)toggle.style.display='none'; // Hide global toggle — now per-line
    // Default first line type based on permissions
  const _isAdmin = currentUser && currentUser.role==='admin';
  const _canDist = _isAdmin || (currentUser && currentUser.canBackorderDist!==false);
  const _canRetail = _isAdmin || (currentUser && currentUser.canBackorderRetail===true);
  const _defaultType = _canDist ? 'dist' : _canRetail ? 'retail' : 'dist';
  boLines=[];
  addBoLineItem(_defaultType);
  setTimeout(()=>document.getElementById('bo-dealer').focus(),150);
}

function closeBoModal(){
  document.getElementById('bo-modal').style.display='none';
}

function addBoLineItem(){
  // Distribution backorder — always dist
  boLines.push({type:'dist',skuValue:'',skuName:'',qty:1,unit:'bag'});
  renderBoLines();
  setTimeout(()=>{
    const container=document.getElementById('bo-line-items');
    if(container&&container.lastElementChild)
      container.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },150);
}

function removeBoLineItem(idx){
  boLines.splice(idx,1);
  renderBoLines();
}

function setLineType(idx,type){
  // Switch list for this line — clear SKU selection so correct list loads
  boLines[idx].type=type;
  boLines[idx].skuValue='';
  boLines[idx].skuName='';
  renderBoLines();
  // Focus the search input for this line
  setTimeout(()=>{
    const input=document.getElementById('bo-sku-input-'+idx);
    if(input){input.value='';input.focus();}
  },80);
}

function renderBoLines(){
  const container=document.getElementById('bo-line-items');
  if(!container)return;
  container.innerHTML='';
  const countEl=document.getElementById('bo-item-count');
  if(countEl)countEl.textContent=boLines.length+(boLines.length===1?' item':' items');

  // Distribution backorder — always DIST only, no toggle needed

  // Distribution backorder — build DIST datalist only
  const dlId='bo-dl-dist';
  let dl=document.getElementById(dlId);
  if(!dl){dl=document.createElement('datalist');dl.id=dlId;document.body.appendChild(dl);}
  dl.innerHTML=liveSKUs.filter(s=>s.type==='DIST').map(s=>`<option value="${s.name}">`).join('');

  boLines.forEach((line,idx)=>{
    const isDist=line.type==='dist';
    const activeColor=isDist?'#E24B4A':'#C07000';
    const inactiveStyle='background:white;color:#aaa;border:1.5px solid #e0e0e0';
    const activeStyle=`background:${activeColor};color:white;border:1.5px solid ${activeColor}`;

    const row=document.createElement('div');
    row.className='bo-line-row';
    row.id='bo-row-'+idx;

    // Type toggle — always visible, always switchable
    // Show for all users if canBoRetail, otherwise show only DIST (no toggle)
    // Distribution label — always shown, no toggle
    const typeToggleHtml = `<div style="font-size:10px;font-weight:600;margin-bottom:6px">
      <span style="background:#E24B4A;color:white;padding:2px 10px;border-radius:20px;font-size:10px">
        📦 Distribution
      </span></div>`;
// SKU search input — always text + datalist (searchable)
    const skuInputHtml=`
      <div style="font-size:10px;font-weight:600;color:#aaa;
        margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">
        Search distribution item
      </div>
      <input type="text"
        id="bo-sku-input-${idx}"
        placeholder="Type to filter distribution products..."
        list="bo-dl-dist"
        autocomplete="off"
        value="${line.skuName||''}"
        oninput="onBoSkuInput(${idx},this.value)"
        style="width:100%;padding:9px 12px;border:1.5px solid #e0e0e0;border-radius:8px;
        font-size:13px;outline:none;margin-bottom:${line.skuName?'4px':'8px'}">
      ${line.skuName
        ? `<div style="font-size:10px;color:#27AE60;margin-bottom:8px">✓ ${line.skuName}</div>`
        : ''}`;

    row.innerHTML=`
      <div class="bo-line-row-header">
        <span class="bo-line-num" style="color:${activeColor}">Item ${idx+1}</span>
        ${boLines.length>1
          ?`<button class="bo-line-remove" onclick="removeBoLineItem(${idx})">×</button>`:''}
      </div>
      ${typeToggleHtml}
      ${skuInputHtml}
      <div class="bo-line-qty-row">
        <div class="bo-line-qty-wrap">
          <span class="bo-line-input-label">Qty</span>
          <input class="bo-line-qty-input" type="number" min="1" step="1"
            value="${line.qty||1}" oninput="onBoQtyChange(${idx},this.value)">
        </div>
        <div class="bo-line-unit-wrap">
          <span class="bo-line-input-label">Unit</span>
          <select class="bo-line-unit-select" onchange="onBoUnitChange(${idx},this.value)">
            ${['bag','sack','box','case','pc','bottle','kg']
              .map(u=>`<option value="${u}"${line.unit===u?' selected':''}>${u}</option>`)
              .join('')}
          </select>
        </div>
      </div>`;
    container.appendChild(row);
  });
}

function onBoSkuInput(idx,val){
  const line=boLines[idx];
  const typeSKUs=liveSKUs.filter(s=>s.type===(line.type==='retail'?'RETAIL':'DIST'));
  const match=typeSKUs.find(s=>s.name.toLowerCase()===val.toLowerCase());
  boLines[idx].skuName=val;
  boLines[idx].skuValue=match?match.code+'|'+match.name:val;
  // Update green confirm without full re-render (preserves focus)
  const row=document.getElementById('bo-row-'+idx);
  if(row){
    const existing=row.querySelector('[data-confirm]');
    let confirmEl=existing;
    if(!confirmEl){
      confirmEl=document.createElement('div');
      confirmEl.setAttribute('data-confirm','1');
      const input=document.getElementById('bo-sku-input-'+idx);
      if(input&&input.nextSibling){input.insertAdjacentElement('afterend',confirmEl);}
    }
    if(confirmEl){
      confirmEl.style.fontSize='10px';
      confirmEl.style.marginBottom='8px';
      if(match){
        confirmEl.style.color='#27AE60';
        confirmEl.textContent='✓ '+match.name;
      }else{
        confirmEl.style.color='#bbb';
        confirmEl.textContent=val?'Type exact name or pick from suggestions':'';
      }
    }
  }
}

function onBoQtyChange(idx,val){boLines[idx].qty=parseFloat(val)||1;}
function onBoUnitChange(idx,val){boLines[idx].unit=val;}

async function submitBackorder(){
  const dealer=document.getElementById('bo-dealer').value.trim();
  const phone=document.getElementById('bo-phone').value.trim();
  const date=document.getElementById('bo-date').value;
  const notes=document.getElementById('bo-notes').value.trim();
  const errEl=document.getElementById('bo-err');

  if(!dealer){errEl.textContent='Please enter a dealer name.';return;}

  // Sync skuName from inputs before submitting (in case user typed but didn't blur)
  boLines.forEach((line,idx)=>{
    const input=document.getElementById('bo-sku-input-'+idx);
    if(input&&input.value.trim())boLines[idx].skuName=input.value.trim();
  });

  const validLines=boLines.filter(l=>l.skuName&&l.skuName.trim()&&l.qty>0);
  if(!validLines.length){
    errEl.textContent='Please add at least one item with a name and quantity.';return;
  }

  const btn=document.getElementById('bo-submit-btn');
  btn.disabled=true;
  btn.textContent='Submitting '+validLines.length+' item(s)...';
  errEl.textContent='';

  const now=new Date().toLocaleString('en-PH');
  const promisedDate=date?new Date(date).toLocaleDateString('en-PH'):'';
  const who=currentUser?currentUser.username:'Unknown';

  const rows=validLines.map(line=>{
    const parts=line.skuValue?line.skuValue.split('|'):['',line.skuName];
    return[now,who,dealer,phone,parts[0]||'',parts[1]||line.skuName,
           line.qty,line.unit,promisedDate,'OPEN',notes];
  });

  try{
    const r=await api({sheet:'Backorders',rows});
    if(r.status==='ok'){
      closeBoModal();
      const activeScreen=document.querySelector('.screen.active');
      const barId=activeScreen&&activeScreen.id==='driver-screen'
        ?'driver-success-bar':'success-bar';
      const summary=validLines.length===1
        ?validLines[0].qty+' '+validLines[0].unit+' of '+validLines[0].skuName
        :validLines.length+' items';
      showBanner(barId,'Backorder logged — '+dealer+': '+summary);
    }else{
      errEl.textContent='Error: '+(r.msg||'Could not submit');
      btn.disabled=false;btn.textContent='Submit Backorder';
    }
  }catch(e){
    errEl.textContent='Network error. Check your connection.';
    btn.disabled=false;btn.textContent='Submit Backorder';
  }
}


// ════════════════════════════════════════════════════════
// RETAIL CUSTOMER BACKORDER SYSTEM
// Separate from distribution — free-text customer, retail SKUs only
// ════════════════════════════════════════════════════════
let rboLines = [];

function openRboModal(){
  document.getElementById('rbo-modal').style.display='flex';
  document.getElementById('rbo-name').value='';
  document.getElementById('rbo-contact').value='';
  document.getElementById('rbo-date').value='';
  document.getElementById('rbo-notes').value='';
  document.getElementById('rbo-err').textContent='';
  const btn=document.getElementById('rbo-submit-btn');
  if(btn){btn.disabled=false;btn.textContent='Submit Retail Backorder';}
  rboLines=[];
  addRboLineItem();
  setTimeout(()=>document.getElementById('rbo-name').focus(),150);
}

function closeRboModal(){
  document.getElementById('rbo-modal').style.display='none';
}

function addRboLineItem(){
  rboLines.push({skuValue:'',skuName:'',qty:1,unit:'pc'});
  renderRboLines();
  setTimeout(()=>{
    const container=document.getElementById('rbo-line-items');
    if(container&&container.lastElementChild)
      container.lastElementChild.scrollIntoView({behavior:'smooth',block:'nearest'});
  },150);
}

function removeRboLineItem(idx){
  rboLines.splice(idx,1);
  renderRboLines();
}

function renderRboLines(){
  const container=document.getElementById('rbo-line-items');
  if(!container)return;
  container.innerHTML='';
  const countEl=document.getElementById('rbo-item-count');
  if(countEl)countEl.textContent=rboLines.length+(rboLines.length===1?' item':' items');

  // Build retail-only datalist
  const dlId='rbo-dl-retail';
  let dl=document.getElementById(dlId);
  if(!dl){dl=document.createElement('datalist');dl.id=dlId;document.body.appendChild(dl);}
  const retailSKUs=liveSKUs.filter(s=>s.type==='RETAIL');
  dl.innerHTML=retailSKUs.map(s=>`<option value="${s.name}">`).join('');

  rboLines.forEach((line,idx)=>{
    const row=document.createElement('div');
    row.className='bo-line-row';
    row.id='rbo-row-'+idx;
    row.innerHTML=`
      <div class="bo-line-row-header">
        <span class="bo-line-num" style="color:#C07000">🛒 Item ${idx+1}</span>
        ${rboLines.length>1
          ?`<button class="bo-line-remove" onclick="removeRboLineItem(${idx})">×</button>`:''}
      </div>
      <div style="font-size:10px;font-weight:600;color:#aaa;margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">
        Search retail item
      </div>
      <input type="text"
        id="rbo-sku-input-${idx}"
        placeholder="Type to filter retail products..."
        list="${dlId}"
        autocomplete="off"
        value="${line.skuName||''}"
        oninput="onRboSkuInput(${idx},this.value)"
        style="width:100%;padding:9px 12px;border:1.5px solid #e0e0e0;border-radius:8px;
        font-size:13px;outline:none;margin-bottom:${line.skuName?'4px':'8px'}">
      ${line.skuName
        ?`<div style="font-size:10px;color:#27AE60;margin-bottom:8px">✓ ${line.skuName}</div>`:''}
      <div class="bo-line-qty-row">
        <div class="bo-line-qty-wrap">
          <span class="bo-line-input-label">Qty</span>
          <input class="bo-line-qty-input" type="number" min="1" step="1"
            value="${line.qty||1}" oninput="onRboQtyChange(${idx},this.value)">
        </div>
        <div class="bo-line-unit-wrap">
          <span class="bo-line-input-label">Unit</span>
          <select class="bo-line-unit-select" onchange="onRboUnitChange(${idx},this.value)">
            ${['pc','bag','sack','box','case','bottle','kg']
              .map(u=>`<option value="${u}"${line.unit===u?' selected':''}>${u}</option>`)
              .join('')}
          </select>
        </div>
      </div>`;
    container.appendChild(row);
  });
}

function onRboSkuInput(idx,val){
  const retailSKUs=liveSKUs.filter(s=>s.type==='RETAIL');
  const match=retailSKUs.find(s=>s.name.toLowerCase()===val.toLowerCase());
  rboLines[idx].skuName=val;
  rboLines[idx].skuValue=match?match.code+'|'+match.name:val;
  // Update confirm hint without re-render
  const row=document.getElementById('rbo-row-'+idx);
  if(row){
    let confirmEl=row.querySelector('[data-rbo-confirm]');
    if(!confirmEl){
      confirmEl=document.createElement('div');
      confirmEl.setAttribute('data-rbo-confirm','1');
      const input=document.getElementById('rbo-sku-input-'+idx);
      if(input)input.insertAdjacentElement('afterend',confirmEl);
    }
    confirmEl.style.fontSize='10px';
    confirmEl.style.marginBottom='8px';
    if(match){confirmEl.style.color='#27AE60';confirmEl.textContent='✓ '+match.name;}
    else{confirmEl.style.color='#bbb';confirmEl.textContent=val?'Type exact name or pick from suggestions':'';}
  }
}

function onRboQtyChange(idx,val){rboLines[idx].qty=parseFloat(val)||1;}
function onRboUnitChange(idx,val){rboLines[idx].unit=val;}

async function submitRetailBackorder(){
  const name=document.getElementById('rbo-name').value.trim();
  const contact=document.getElementById('rbo-contact').value.trim();
  const date=document.getElementById('rbo-date').value;
  const notes=document.getElementById('rbo-notes').value.trim();
  const errEl=document.getElementById('rbo-err');

  if(!name){errEl.textContent='Please enter the customer name.';return;}
  if(!contact){errEl.textContent='Contact number is required.';return;}

  // Sync any partially typed SKU names
  rboLines.forEach((line,idx)=>{
    const input=document.getElementById('rbo-sku-input-'+idx);
    if(input&&input.value.trim())rboLines[idx].skuName=input.value.trim();
  });

  const validLines=rboLines.filter(l=>l.skuName&&l.skuName.trim()&&l.qty>0);
  if(!validLines.length){
    errEl.textContent='Please add at least one item with a name and quantity.';return;
  }

  const btn=document.getElementById('rbo-submit-btn');
  btn.disabled=true;
  btn.textContent='Submitting '+validLines.length+' item(s)...';
  errEl.textContent='';

  const now=new Date().toLocaleString('en-PH');
  const promisedDate=date?new Date(date).toLocaleDateString('en-PH'):'';
  const who=currentUser?currentUser.username:'Unknown';

  const rows=validLines.map(line=>{
    const parts=line.skuValue?line.skuValue.split('|'):['',line.skuName];
    return[now,who,name,contact,parts[0]||'',parts[1]||line.skuName,
           line.qty,line.unit,promisedDate,'OPEN',notes];
  });

  try{
    const r=await api({sheet:'Backorders - Retail',rows});
    if(r.status==='ok'){
      closeRboModal();
      const activeScreen=document.querySelector('.screen.active');
      const barId=activeScreen&&activeScreen.id==='driver-screen'
        ?'driver-success-bar':'success-bar';
      const summary=validLines.length===1
        ?validLines[0].qty+' '+validLines[0].unit+' of '+validLines[0].skuName
        :validLines.length+' items';
      showBanner(barId,'Retail backorder logged — '+name+' ('+contact+'): '+summary);
    }else{
      errEl.textContent='Error: '+(r.msg||'Could not submit');
      btn.disabled=false;btn.textContent='Submit Retail Backorder';
    }
  }catch(e){
    errEl.textContent='Network error. Check your connection.';
    btn.disabled=false;btn.textContent='Submit Retail Backorder';
  }
}



// ════════════════════════════════════════════════════════
// TRANSFER SYSTEM
// 4-stage lifecycle: PENDING → IN TRANSIT → PARTIAL/RECEIVED
// Inventory updates ONLY on acknowledgment
// ════════════════════════════════════════════════════════
let trfLines = [];
let trfList = [];
let trfFilter = 'All';
let currentTrf = null;

// ── OPEN / CLOSE ──────────────────────────────────────
