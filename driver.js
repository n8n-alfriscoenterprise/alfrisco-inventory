async function showDriver(){
  showScreen('driver-screen');
  updateFabVisibility();
  const unit=currentUser.assignedUnit||'Bajaj1';
  document.getElementById('driver-topbar-user').textContent=`${currentUser.username} · driver`;
  document.getElementById('driver-unit-badge').textContent=unit;
  driverCat='All';
  await loadDriverManifest();
}

async function loadDriverManifest(){
  const unit=currentUser.assignedUnit||'Bajaj1';
  const listEl=document.getElementById('driver-sku-list');
  listEl.innerHTML='<div class="driver-empty">Loading manifest...</div>';
  try{
    const r=await api({action:'getTodayLoads',unit});
    if(r.status==='ok'){
      driverManifest=r.rows||[];
      // Preserve delivered state across refresh
      driverManifest.forEach(item=>{if(item.delivered===undefined)item.delivered=0;});
      buildDriverChips();
      buildDriverList();
      updateDriverTotals();
    }else{
      listEl.innerHTML='<div class="driver-empty">Could not load manifest. Pull to refresh.</div>';
    }
  }catch(e){
    listEl.innerHTML='<div class="driver-empty">Network error. Please check your connection.</div>';
  }
}

function buildDriverChips(){
  const bar=document.getElementById('driver-chips-bar');bar.innerHTML='';
  const cats=['All',...new Set(driverManifest.map(i=>i.cat).filter(Boolean))];
  cats.forEach(cat=>{
    const c=document.createElement('div');
    c.className='chip'+(cat===driverCat?' active':'');
    c.textContent=cat;
    c.onclick=()=>{driverCat=cat;buildDriverChips();buildDriverList();};
    bar.appendChild(c);
  });
}

function buildDriverList(){
  const list=document.getElementById('driver-sku-list');list.innerHTML='';
  const visible=driverCat==='All'?driverManifest:driverManifest.filter(i=>i.cat===driverCat);
  if(!visible.length){
    list.innerHTML='<div class="driver-empty">No items loaded yet for today.<br>Ask warehouse staff to submit the morning load.</div>';
    return;
  }
  // Group by category
  const cats=[...new Set(visible.map(i=>i.cat||'Uncategorised'))];
  cats.forEach(cat=>{
    if(driverCat==='All'){
      const hdr=document.createElement('div');hdr.className='cat-header';hdr.textContent=cat;list.appendChild(hdr);
    }
    visible.filter(i=>(i.cat||'Uncategorised')===cat).forEach((item,idx)=>{
      const remaining=Math.max(0,(item.loaded||0)-(item.delivered||0));
      const done=remaining===0&&(item.delivered||0)>0;
      const row=document.createElement('div');row.className='driver-sku-row';
      row.innerHTML=`
        <div class="driver-sku-info">
          <div class="driver-sku-name" style="${done?'text-decoration:line-through;color:#aaa':''}">${item.name}</div>
          <div class="driver-sku-code">${item.code}</div>
        </div>
        <div class="driver-qty-chips">
          <div class="driver-qty-chip loaded" title="Loaded">${item.loaded||0}</div>
          <div class="driver-qty-chip sold" title="Delivered">${item.delivered||0}</div>
          <div class="driver-qty-chip pending" title="Remaining">${remaining}</div>
        </div>
        <button class="deliver-btn ${done?'done':''}"
          onclick="${done?'':'openDeliverModal('+driverManifest.indexOf(item)+')'}"
          ${done?'disabled':''}>
          ${done?'Done ✓':'Deliver'}
        </button>`;
      list.appendChild(row);
    });
  });
}

function updateDriverTotals(){
  const totalLoaded=driverManifest.reduce((s,i)=>s+(i.loaded||0),0);
  const totalDelivered=driverManifest.reduce((s,i)=>s+(i.delivered||0),0);
  const totalRemaining=Math.max(0,totalLoaded-totalDelivered);
  document.getElementById('d-loaded').textContent=Math.round(totalLoaded);
  document.getElementById('d-delivered').textContent=Math.round(totalDelivered);
  document.getElementById('d-remaining').textContent=Math.round(totalRemaining);
}

function openDeliverModal(idx){
  deliverTarget=idx;
  const item=driverManifest[idx];
  const remaining=Math.max(0,(item.loaded||0)-(item.delivered||0));
  document.getElementById('deliver-modal-sub').textContent=`${item.name} — ${remaining} units remaining`;
  document.getElementById('deliver-qty').value=remaining;
  document.getElementById('deliver-dealer').value='';
  document.getElementById('deliver-backorder').value='No';
  document.getElementById('deliver-notes').value='';
  document.getElementById('deliver-err').textContent='';
  document.getElementById('deliver-modal').style.display='flex';
  setTimeout(()=>document.getElementById('deliver-qty').focus(),100);
}

function closeDeliverModal(){
  document.getElementById('deliver-modal').style.display='none';
  deliverTarget=null;
}

async function confirmDelivery(){
  if(deliverTarget===null)return;
  const qty=parseFloat(document.getElementById('deliver-qty').value)||0;
  if(qty<=0){document.getElementById('deliver-err').textContent='Enter a quantity greater than 0.';return;}
  const item=driverManifest[deliverTarget];
  const dealer=document.getElementById('deliver-dealer').value.trim();
  const backorder=document.getElementById('deliver-backorder').value;
  const notes=document.getElementById('deliver-notes').value.trim();
  const unit=currentUser.assignedUnit||'Bajaj1';
  document.getElementById('deliver-err').textContent='';
  try{
    const r=await api({
      action:'markDelivered',
      driver:currentUser.username,
      unit,
      dealer:dealer||'',
      code:item.code,
      name:item.name,
      qty,
      backorder,
      notes:notes||''
    });
    if(r.status==='ok'){
      driverManifest[deliverTarget].delivered=(driverManifest[deliverTarget].delivered||0)+qty;
      closeDeliverModal();
      buildDriverList();
      updateDriverTotals();
      showBanner('driver-success-bar',`Delivered ${qty} × ${item.name} — recorded ✓`);
    }else{
      document.getElementById('deliver-err').textContent='Error: '+(r.msg||'Could not record delivery');
    }
  }catch(e){
    document.getElementById('deliver-err').textContent='Network error. Please try again.';
  }
}

// ── ADMIN MODAL ──
