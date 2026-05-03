function onUnitChange(){
  const hasUnsaved=Object.values(quantities).some(q=>q.loaded>0||q.returned>0);
  if(hasUnsaved){
    const unitLabel=document.getElementById('unit-select').value;
    const confirmed=confirm('You have unsaved quantities for the current unit.\n\nSwitching to '+unitLabel+' will clear the current form.\n\nHave you already submitted the previous unit\'s data?');
    if(!confirmed){const sel=document.getElementById('unit-select');sel.value=sel.dataset.lastUnit||sel.options[0].value;return;}
  }
  quantities={};
  const sel=document.getElementById('unit-select');
  sel.dataset.lastUnit=sel.value;
  if(isReturnMode){
    isReturnMode=false;
    document.getElementById('mode-btn').textContent='LOAD';
    document.getElementById('mode-btn').className='mode-btn';
    document.getElementById('submit-btn').className='submit-btn';
    document.getElementById('submit-btn').textContent='Submit to Google Sheets';
  }
  buildSkuList();updateTotals();
  showBanner('success-bar','Switched to '+sel.value+' — form cleared and ready for new entry');
}

// ── TOGGLE MODE ──
// ── LIVE SKU MASTER ──
// ── STOCK COUNT SYSTEM ──
let countCat='All';
let countSaveTimer=null;
let currentCountType='dist';

function countSessionKey(loc){return 'alf_count_'+(loc||getCurrentCountLoc()).replace(/\s+/g,'_');}
function getCurrentCountLoc(){const el=document.getElementById('count-loc-select');return el?el.value:'Distribution WH';}
function getCountSession(loc){return LS.get(countSessionKey(loc))||{};}
function saveCountSession(loc,session){
  LS.set(countSessionKey(loc),session);
  const el=document.getElementById('count-save-status');
  if(el){const now=new Date().toLocaleTimeString('en-PH',{hour:'2-digit',minute:'2-digit'});el.textContent='Auto-saved at '+now;}
}

function openCount(){
  const canDist=currentUser&&currentUser.canCountDist!==false;
  const canRetail=currentUser&&currentUser.canCountRetail!==false;
  if(!canDist&&!canRetail){alert('You do not have permission to perform inventory counts.');return;}
  if(canDist&&canRetail){updateCountTypeCards();showScreen('count-type-screen');}
  else{startCount(canDist?'dist':'retail');}
  updateFabVisibility();
}

function updateCountTypeCards(){
  const allSkus=getAllCountSKUs();
  const distCount=liveSKUs.filter(s=>s.type==='DIST').length||allSkus.filter(s=>s.type==='DIST').length;
  const retailCount=liveSKUs.filter(s=>s.type==='RETAIL').length||allSkus.filter(s=>s.type==='RETAIL').length;
  const canDist=currentUser&&currentUser.canCountDist!==false;
  const canRetail=currentUser&&currentUser.canCountRetail!==false;
  const distCard=document.getElementById('count-card-dist');
  const retailCard=document.getElementById('count-card-retail');
  if(distCard){distCard.className='count-type-card dist'+(canDist?'':' disabled');distCard.onclick=canDist?()=>startCount('dist'):null;const dc=document.getElementById('count-card-dist-count');if(dc)dc.textContent=distCount+' SKUs';}
  if(retailCard){retailCard.className='count-type-card retail'+(canRetail?'':' disabled');retailCard.onclick=canRetail?()=>startCount('retail'):null;const rc=document.getElementById('count-card-retail-count');if(rc)rc.textContent=retailCount+' SKUs';}
}

function closeCountType(){if(currentUser&&currentUser.role==='driver')showDriver();else showHome();}

function startCount(type){
  currentCountType=type;
  const isRetail=type==='retail';
  const color=isRetail?'#C07000':'#7B2D8B';
  const topbar=document.getElementById('count-topbar');
  const title=document.getElementById('count-topbar-title');
  const fill=document.getElementById('count-progress-fill');
  const pct=document.getElementById('count-progress-pct');
  const submitBtn=document.getElementById('count-submit-btn');
  const successBar=document.getElementById('count-success-bar');
  if(topbar)topbar.style.background=color;
  if(title)title.textContent=isRetail?'🛒 Retail Stock Count':'📦 Distribution Stock Count';
  if(fill)fill.style.background=color;
  if(pct)pct.style.color=color;
  if(submitBtn)submitBtn.style.background=color;
  if(successBar)successBar.style.background=color;
  showScreen('count-screen');
  updateFabVisibility();
  countCat='All';
  buildCountChips();buildCountList();updateCountProgress();
}

function closeCount(){if(currentUser&&currentUser.role==='driver')showDriver();else showHome();}

function switchCountLocation(){countCat='All';buildCountChips();buildCountList();updateCountProgress();}

function getAllCountSKUs(){
  const typeFilter=currentCountType==='retail'?'RETAIL':'DIST';
  const all=[];
  if(liveSKUs&&liveSKUs.length>0){
    liveSKUs.filter(s=>s.type===typeFilter).forEach(s=>all.push({code:s.code,name:s.name,category:s.category,type:s.type,unit:'bag'}));
  }else{
    if(typeFilter==='DIST'){DIST_CATS.forEach(cat=>{(DIST_SKUS[cat]||[]).forEach(s=>all.push({code:s.code,name:s.name,category:cat,type:'DIST',unit:'bag'}));});}
    else{Object.keys(csskus).forEach(cat=>{(csskus[cat]||[]).forEach(s=>all.push({code:s.code,name:s.name,category:cat,type:'RETAIL',unit:'bag'}));});}
  }
  return all;
}

function buildCountChips(){
  const bar=document.getElementById('count-chips-bar');bar.innerHTML='';
  const skus=getAllCountSKUs();
  const cats=['All',...new Set(skus.map(s=>s.category).filter(Boolean))];
  cats.forEach(cat=>{const c=document.createElement('div');c.className='count-chip'+(cat===countCat?' active':'');c.textContent=cat;c.onclick=()=>{countCat=cat;buildCountChips();buildCountList();};bar.appendChild(c);});
}

function buildCountList(){
  const list=document.getElementById('count-sku-list');list.innerHTML='';
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  const allSkus=getAllCountSKUs();
  const visible=countCat==='All'?allSkus:allSkus.filter(s=>s.category===countCat);
  const cats=countCat==='All'?[...new Set(allSkus.map(s=>s.category))]:[countCat];
  cats.forEach(cat=>{
    const catSkus=visible.filter(s=>s.category===cat);
    if(!catSkus.length)return;
    if(countCat==='All'){const hdr=document.createElement('div');hdr.className='count-cat-header';const counted=catSkus.filter(s=>session[s.code]!==undefined&&session[s.code]!=='').length;hdr.textContent=cat+' ('+counted+'/'+catSkus.length+')';list.appendChild(hdr);}
    catSkus.forEach(sku=>{
      const val=session[sku.code];const hasCounted=val!==undefined&&val!=='';
      const row=document.createElement('div');row.className='count-sku-row'+(hasCounted?' counted':'');row.id='count-row-'+sku.code.replace(/[^a-z0-9]/gi,'_');
      row.innerHTML=`<div class="count-sku-status ${hasCounted?'done':'pending'}"></div><div class="count-sku-info"><div class="count-sku-name">${sku.name}</div><div class="count-sku-code">${sku.code} · ${sku.type}</div></div><div class="count-qty-wrap"><div class="count-qty-lbl">On Hand</div><input class="count-qty-input ${hasCounted?'has-value':''}" type="number" min="0" step="1" value="${hasCounted?val:''}" placeholder="—" oninput="onCountInput('${sku.code}',this.value,'${sku.category}','${sku.type}')"><div class="count-unit">${sku.unit||'units'}</div></div>`;
      list.appendChild(row);
    });
  });
}

function onCountInput(code,val,category,type){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  if(val===''||val===null){delete session[code];}else{session[code]=parseFloat(val)||0;}
  const rowEl=document.getElementById('count-row-'+code.replace(/[^a-z0-9]/gi,'_'));
  const hasCounted=session[code]!==undefined;
  if(rowEl){rowEl.className='count-sku-row'+(hasCounted?' counted':'');const dot=rowEl.querySelector('.count-sku-status');if(dot)dot.className='count-sku-status '+(hasCounted?'done':'pending');const input=rowEl.querySelector('.count-qty-input');if(input)input.className='count-qty-input'+(hasCounted?' has-value':'');}
  clearTimeout(countSaveTimer);
  countSaveTimer=setTimeout(()=>{saveCountSession(loc,session);updateCountProgress();},800);
}

function updateCountProgress(){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);
  const total=getAllCountSKUs().length;const counted=Object.keys(session).length;
  const pct=total>0?Math.round(counted/total*100):0;
  const labelEl=document.getElementById('count-progress-label');const pctEl=document.getElementById('count-progress-pct');const fillEl=document.getElementById('count-progress-fill');const btnEl=document.getElementById('count-submit-btn');const noteEl=document.getElementById('count-submit-note');
  if(labelEl)labelEl.textContent=counted+' of '+total+' SKUs counted';
  if(pctEl)pctEl.textContent=pct+'%';
  if(fillEl)fillEl.style.width=pct+'%';
  if(btnEl){
    if(counted===0){btnEl.disabled=true;btnEl.textContent='Submit Count to Google Sheets';if(noteEl)noteEl.textContent='Count at least one SKU before submitting';}
    else if(counted<total){btnEl.disabled=false;btnEl.textContent='Submit Partial Count ('+counted+' SKUs)';if(noteEl)noteEl.textContent='Partial counts accepted — remaining SKUs unverified';}
    else{btnEl.disabled=false;btnEl.textContent='Submit Full Count — '+total+' SKUs ✓';if(noteEl)noteEl.textContent='All SKUs counted — ready to submit';}
  }
}

async function submitCount(){
  const loc=getCurrentCountLoc();const session=getCountSession(loc);const counted=Object.keys(session).length;
  if(counted===0){alert('Please count at least one SKU before submitting.');return;}
  const allSkus=getAllCountSKUs();const skuMap={};allSkus.forEach(s=>skuMap[s.code]=s);
  if(!confirm(counted+' SKU counts will be submitted for '+loc+'.\nThis will clear the current session. Continue?'))return;
  const btn=document.getElementById('count-submit-btn');btn.disabled=true;btn.textContent='Submitting...';
  const now=new Date().toLocaleString('en-PH');
  const rows=Object.entries(session).map(([code,qty])=>{const sku=skuMap[code]||{};return[now,currentUser.username,loc,code,sku.name||code,qty,sku.unit||'units',sku.type||'',sku.category||''];});
  try{
    const sheetName=currentCountType==='retail'?'Stock Counts - Retail':'Stock Counts - Distribution';
    const r=await api({sheet:sheetName,rows});
    if(r.status==='ok'){
      LS.set(countSessionKey(loc),{});
      const bar=document.getElementById('count-success-bar');bar.textContent=counted+' counts submitted for '+loc+' by '+currentUser.username+' — session cleared';bar.style.display='block';setTimeout(()=>{bar.style.display='none';},6000);
      buildCountList();updateCountProgress();
    }else{alert('Error: '+(r.msg||'Could not submit'));}
  }catch(e){alert('Network error: '+e.message);}
  btn.disabled=false;updateCountProgress();
}

// ── PURCHASE ORDER SYSTEM ──
const DIST_SUPPLIERS=['A-Legacy','AAS','CCPI','EMT','PDI','TFI','THB','TOPPERSWARE'];
const RETAIL_SUPPLIERS=['Alfrisco Distribution','Edzena','JFL','Jake','Magpayo','Zoe'];
let poList=[],currentPO=null,poFilter='All',poLineItems=[];

