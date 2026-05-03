
async function toggleMode(){
  isReturnMode=!isReturnMode;
  const b=document.getElementById('mode-btn'),s=document.getElementById('submit-btn');
  b.textContent=isReturnMode?'RETURN':'LOAD';
  b.className='mode-btn'+(isReturnMode?' return-mode':'');
  s.className='submit-btn'+(isReturnMode?' return-mode':'');
  s.textContent=isReturnMode?'Submit Return to Google Sheets':'Submit to Google Sheets';

  if(isReturnMode){
    // Fetch today's LOAD data and pre-fill loaded quantities
    const unit=document.getElementById('unit-select').value;
    b.textContent='Loading...';b.disabled=true;
    try{
      const r=await api({action:'getTodayLoads',unit});
      if(r.status==='ok'&&r.rows&&r.rows.length>0){
        r.rows.forEach(item=>{
          const code=item.code;
          if(!quantities[code])quantities[code]={loaded:0,returned:0,cat:item.cat||''};
          quantities[code].loaded=Number(item.loaded)||0;
          quantities[code].cat=item.cat||quantities[code].cat;
        });
        showBanner('success-bar',
          `Loaded ${r.rows.length} SKU quantities from today\'s morning load`);
      }else{
        showBanner('success-bar',
          'No LOAD submission found for today — enter loaded quantities manually if needed');
      }
    }catch(e){
      showBanner('success-bar','Could not fetch today\'s load — check connection');
    }
    b.textContent='RETURN';b.disabled=false;b.className='mode-btn return-mode';
  }
  buildSkuList();
}

function buildTab(){buildChips();buildSkuList();updateTotals();}

function buildChips(){
  const bar=document.getElementById('chips-bar');bar.innerHTML='';
  let cats=['All'];
  if(currentTab==='dist')cats=['All',...DIST_CATS];
  else if(currentTab==='retail')cats=['All',...Object.keys(csskus)];
  cats.forEach(cat=>{
    const c=document.createElement('div');
    c.className='chip'+(cat===currentCat?' active':'');
    c.textContent=cat;
    c.onclick=()=>{currentCat=cat;buildChips();buildSkuList();};
    bar.appendChild(c);
  });
}

function getGroups(){
  if(currentTab==='dist'){
    const cats=currentCat==='All'?DIST_CATS:[currentCat];
    return cats.map(c=>({cat:c,skus:DIST_SKUS[c]||[]}));
  }
  if(currentTab==='retail'){
    const cats=currentCat==='All'?Object.keys(csskus):[currentCat];
    return cats.map(c=>({cat:c,skus:csskus[c]||[]}));
  }
  const g=DIST_CATS.map(c=>({cat:`DIST — ${c}`,skus:DIST_SKUS[c]||[]}));
  Object.keys(csskus).forEach(c=>g.push({cat:`RETAIL — ${c}`,skus:csskus[c]||[]}));
  return g;
}

function buildSkuList(){
  const list=document.getElementById('sku-list');list.innerHTML='';
  getGroups().forEach(({cat,skus})=>{
    if(!skus.length)return;
    const hdr=document.createElement('div');hdr.className='cat-header';hdr.textContent=cat;list.appendChild(hdr);
    skus.forEach(sku=>{
      if(!quantities[sku.code])quantities[sku.code]={loaded:0,returned:0,cat};
      const q=quantities[sku.code];
      const sold=Math.max(0,q.loaded-q.returned);
      const sid='sold_'+sku.code.replace(/[^a-z0-9]/gi,'_');

      // Mode-locked: LOAD mode locks Returned, RETURN mode shows loaded as badge
      const loadedLocked=isReturnMode;
      const returnedLocked=!isReturnMode;

      // In RETURN mode: show loaded as a read-only display badge (not an input)
      // This way the pre-filled value from Sheets is visible but not editable
      const loadedDisplay = isReturnMode
        ? `<div class="qty-col">
            <div class="qty-lbl">Loaded</div>
            <div class="sold-val ${q.loaded===0?'zero':''}" style="width:44px;font-size:13px;border-radius:8px;border:1.5px solid #85B7EB;background:#EEF5FE;color:#0C447C;padding:5px 2px;">${q.loaded||0}</div>
           </div>`
        : `<div class="qty-col">
            <div class="qty-lbl">Loaded</div>
            <input class="qty-input loaded active-input"
              type="number" min="0" step="1"
              value="${q.loaded||''}" placeholder="0"
              oninput="setQty('${sku.code}','loaded',this.value,'${cat}')">
           </div>`;

      const row=document.createElement('div');row.className='sku-row';
      row.innerHTML=`
        <div class="sku-info">
          <div class="sku-name">${sku.name}</div>
          <div class="sku-code">${sku.code}</div>
        </div>
        <div class="qty-group">
          ${loadedDisplay}
          <div class="qty-col">
            <div class="qty-lbl">Returned</div>
            <input class="qty-input returned ${returnedLocked?'locked-input':'active-input'}"
              type="number" min="0" step="1"
              value="${q.returned||''}" placeholder="0"
              ${returnedLocked?'disabled':''}
              oninput="setQty('${sku.code}','returned',this.value,'${cat}')">
          </div>
          <div class="sold-col">
            <div class="qty-lbl">Sold</div>
            <div class="sold-val ${sold===0?'zero':''}" id="${sid}">${sold}</div>
          </div>
        </div>`;
      list.appendChild(row);
    });
  });
}

function setQty(code,field,val,cat){
  if(!quantities[code])quantities[code]={loaded:0,returned:0,cat};
  quantities[code][field]=Math.max(0,parseFloat(val)||0);
  quantities[code].cat=cat;
  const sold=Math.max(0,quantities[code].loaded-quantities[code].returned);
  const el=document.getElementById('sold_'+code.replace(/[^a-z0-9]/gi,'_'));
  if(el){el.textContent=sold;el.className='sold-val'+(sold===0?' zero':'');}
  updateTotals();
}

function updateTotals(){
  let tl=0,tr=0;
  Object.values(quantities).forEach(q=>{tl+=q.loaded;tr+=q.returned;});
  document.getElementById('t-loaded').textContent=Math.round(tl);
  document.getElementById('t-returned').textContent=Math.round(tr);
  document.getElementById('t-sold').textContent=Math.round(Math.max(0,tl-tr));
}

async function submitForm(){
  const entries=Object.entries(quantities).filter(([k,v])=>v.loaded>0||v.returned>0);
  if(!entries.length){alert('Please enter at least one quantity before submitting.');return;}
  const btn=document.getElementById('submit-btn');
  btn.disabled=true;btn.textContent='Submitting...';
  const mode=isReturnMode?'RETURN':'LOAD';
  const unit=document.getElementById('unit-select').value;
  const now=new Date().toLocaleString('en-PH');
  const allSkus={};
  Object.values(DIST_SKUS).flat().forEach(s=>allSkus[s.code]=s.name);
  Object.values(csskus).flat().forEach(s=>allSkus[s.code]=s.name);
  const rows=entries.map(([code,q])=>[
    now,currentUser.username,unit,mode,code,
    allSkus[code]||code,q.cat||'',q.loaded,q.returned,
    Math.max(0,q.loaded-q.returned)
  ]);
  try{
    const r=await api({sheet:'Stock Movements',rows});
    if(r.status==='ok'){
      showBanner('success-bar',`${mode} submitted — ${rows.length} SKUs logged by ${currentUser.username}`);
      accessLog.unshift({who:currentUser.username,what:`${mode} — ${rows.length} SKUs via ${unit}`,when:now});
      saveLocal();quantities={};buildSkuList();updateTotals();
    }else{alert('Error: '+(r.msg||'Unknown'));}
  }catch(e){alert('Network error: '+e.message);}
  btn.disabled=false;
  btn.textContent=isReturnMode?'Submit Return to Google Sheets':'Submit to Google Sheets';
}

function showBanner(id,msg){
  const b=document.getElementById(id);
  b.textContent=msg;b.style.display='block';
  setTimeout(()=>b.style.display='none',5000);
}

// ── DRIVER SCREEN ──
