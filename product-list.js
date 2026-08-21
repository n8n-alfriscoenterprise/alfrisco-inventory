async function openPL(){
  showScreen('pl-screen');
  updateFabVisibility();
  document.getElementById('pl-search').value = '';
  plSearch = '';
  plCat = 'All';

  // Enforce plView permission — show/hide tabs and set default
  const view = (currentUser && currentUser.plView) || 'both';
  const distTab   = document.getElementById('pl-tab-dist');
  const retailTab = document.getElementById('pl-tab-retail');
  const subtabBar = document.querySelector('.pl-subtabs');

  if(view === 'dist'){
    plTab = 'dist';
    if(subtabBar) subtabBar.style.display = 'none'; // only one list — hide tabs
  } else if(view === 'retail'){
    plTab = 'retail';
    if(subtabBar) subtabBar.style.display = 'none';
  } else {
    plTab = 'dist';
    if(subtabBar) subtabBar.style.display = '';     // show both tabs
  }

  document.querySelectorAll('.pl-subtab').forEach(t=>t.classList.remove('active'));
  const activeTab = document.getElementById('pl-tab-' + plTab);
  if(activeTab) activeTab.classList.add('active');

  // Alignment audit is an admin tool
  const aBtn = document.getElementById('pl-audit-btn');
  if(aBtn) aBtn.style.display = (currentUser && currentUser.role==='admin') ? 'block' : 'none';
  const aRes = document.getElementById('pl-audit-result');
  if(aRes){ aRes.style.display = 'none'; aRes.innerHTML = ''; }

  // Instant paint from the session's last data, then refresh in the background —
  // the screen used to blank out for a full Apps Script round trip on every open
  if((plData.dist && plData.dist.length) || (plData.retail && plData.retail.length)){
    buildPLChips();
    renderPL();
    loadPLData().then(function(){ buildPLChips(); renderPL(); });
  } else {
    document.getElementById('pl-body').innerHTML = '<div class="pl-empty">Loading product list...</div>';
    document.getElementById('pl-summary-count').textContent = 'Loading...';
    await loadPLData();
    buildPLChips();
    renderPL();
  }
}

// ── SKU ALIGNMENT AUDIT (admin) ──────────────────────────────────
// Answers "is my inventory actually aligned to the item master?" with evidence.
async function runSKUAudit(){
  const box = document.getElementById('pl-audit-result');
  const btn = document.getElementById('pl-audit-btn');
  if(!box) return;
  box.style.display = 'block';
  box.innerHTML = '<div style="padding:12px;color:#888;font-size:12px">Comparing stock against the SKU Masters…</div>';
  btn.disabled = true;
  try{
    const r = await api({action:'auditSKUAlignment'});
    if(r.status !== 'ok'){ box.innerHTML = '<div style="padding:12px;color:#C0392B;font-size:12px">'+(r.msg||'Audit failed')+'</div>'; btn.disabled=false; return; }
    if(!r.totalIssues){
      box.innerHTML = '<div style="padding:12px;background:#E8F5E9;border:1.5px solid #A5D6A7;border-radius:9px;color:#1B5E20;font-size:12.5px;font-weight:600">✓ Fully aligned — every item holding stock exists and is active in the SKU Master.</div>';
      btn.disabled=false; return;
    }
    const sect = function(title, list, note, tone){
      if(!list.length) return '';
      return '<div style="margin-bottom:9px;padding:10px 12px;background:'+tone.bg+';border:1.5px solid '+tone.br+';border-radius:9px">'
        + '<div style="font-size:12px;font-weight:800;color:'+tone.fg+'">'+title+' ('+list.length+')</div>'
        + '<div style="font-size:11px;color:#666;margin:3px 0 6px;line-height:1.5">'+note+'</div>'
        + list.slice(0,25).map(function(x){
            return '<div style="font-size:11.5px;color:#333;padding:2px 0">• <strong>'+x.code+'</strong> '
              + (x.name||'') + ' <span style="color:#888">('+x.type+(x.stock!==undefined?' · '+x.stock+' on hand':'')+')</span></div>';
          }).join('')
        + (list.length>25 ? '<div style="font-size:11px;color:#888;margin-top:4px">…and '+(list.length-25)+' more</div>' : '')
        + '</div>';
    };
    box.innerHTML =
        sect('⚠ Holding stock but NOT in the SKU Master', r.orphans,
             'These hold inventory the app can’t show or count. Add them to the master, or zero them out.',
             {bg:'#FDEDEC',br:'#E6B0AA',fg:'#C0392B'})
      + sect('⏸ Inactive but still holding stock', r.inactiveWithStock,
             'Deactivated items with stock left behind — that stock is stranded and invisible.',
             {bg:'#FFF6E5',br:'#F0C36D',fg:'#8A5A00'})
      + sect('◦ In the master but never counted', r.neverCounted,
             'Active items with no stock record yet — normal for new SKUs, worth a look otherwise.',
             {bg:'#F5F7F9',br:'#d0d7dd',fg:'#0D3349'});
  }catch(e){
    box.innerHTML = '<div style="padding:12px;color:#C0392B;font-size:12px">Network error: '+e.message+'</div>';
  }
  btn.disabled = false;
}

function closePL(){
  if(currentUser && currentUser.role === 'driver') showDriver();
  else showHome();
}

async function loadPLData(){
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      plData.dist   = r.dist   || [];
      plData.retail = r.retail || [];
      plLoaded = true;
      updateLowStockBadge();
    }
  }catch(e){
    console.error('loadPLData failed', e);
  }
}

function countLowStock(){
  const all = [...(plData.dist||[]), ...(plData.retail||[])];
  return all.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel).length;
}

function updateLowStockBadge(){
  const badge = document.getElementById('ls-alert-badge');
  if(!badge) return;
  const n = countLowStock();
  if(n > 0){
    badge.textContent = n;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function setPLTab(tab, el){
  plTab = tab;
  plCat = 'All';
  plSearch = '';
  document.getElementById('pl-search').value = '';
  document.querySelectorAll('.pl-subtab').forEach(t=>t.classList.remove('active'));
  if(el) el.classList.add('active');
  buildPLChips();
  renderPL();
}

function buildPLChips(){
  const bar = document.getElementById('pl-chips');
  bar.innerHTML = '';
  const items = plData[plTab];

  // Low Stock chip — shown when any items in this tab have par levels set
  const lowCount = items.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel).length;
  if(lowCount > 0){
    const lc = document.createElement('div');
    lc.className = 'pl-chip pl-chip-alert' + (plCat==='__lowstock__'?' active':'');
    lc.textContent = '⚠️ Low Stock (' + lowCount + ')';
    lc.onclick = ()=>{ plCat='__lowstock__'; buildPLChips(); renderPL(); };
    bar.appendChild(lc);
  }

  const cats = ['All', ...new Set(items.map(i=>i.category).filter(Boolean))];
  cats.forEach(cat=>{
    const c = document.createElement('div');
    c.className = 'pl-chip' + (cat===plCat?' active':'');
    const count = cat==='All' ? items.length : items.filter(i=>i.category===cat).length;
    c.textContent = cat + ' (' + count + ')';
    c.onclick = ()=>{ plCat=cat; buildPLChips(); renderPL(); };
    bar.appendChild(c);
  });
}

function onPLSearch(val){
  plSearch = val.toLowerCase().trim();
  renderPL();
}

function renderPL(){
  const body   = document.getElementById('pl-body');
  const items  = plData[plTab];
  if(!items.length){
    body.innerHTML = '<div class="pl-empty">No products found.<br>Make sure SKU Master sheets are uploaded.</div>';
    document.getElementById('pl-summary-count').textContent = '0 products';
    return;
  }

  // Filter
  let visible;
  if(plCat==='__lowstock__'){
    visible = items.filter(i=> i.parLevel > 0 && i.stock !== null && Number(i.stock) < i.parLevel);
  } else {
    visible = plCat==='All' ? items : items.filter(i=>i.category===plCat);
  }
  if(plSearch){
    visible = visible.filter(i=>
      i.name.toLowerCase().includes(plSearch) ||
      String(i.sku).toLowerCase().includes(plSearch)
    );
  }

  // Summary
  const withPrice = visible.filter(i=>i.price>0).length;
  const withStock = visible.filter(i=>i.stock!==null).length;
  document.getElementById('pl-summary-count').textContent =
    visible.length + ' product' + (visible.length!==1?'s':'') +
    ' · ' + withPrice + ' priced · ' + withStock + ' with stock';

  // Latest update timestamp
  const dated = visible.filter(i=>i.lastUpdated);
  if(dated.length){
    const latest = dated.reduce((a,b)=>new Date(a.lastUpdated)>new Date(b.lastUpdated)?a:b);
    const d = new Date(latest.lastUpdated);
    let label = latest.lastUpdated;
    if(!isNaN(d.getTime())){
      const mn = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
      const ph = new Date(d.toLocaleString('en-US',{timeZone:'Asia/Manila'}));
      const h  = ph.getHours(), ampm = h>=12?'PM':'AM', h12 = h%12||12;
      const mi = String(ph.getMinutes()).padStart(2,'0');
      label = mn[ph.getMonth()]+' '+ph.getDate()+', '+ph.getFullYear()+' · '+h12+':'+mi+' '+ampm;
    }
    document.getElementById('pl-summary-updated').textContent = 'Stock as of: '+label;
  } else {
    document.getElementById('pl-summary-updated').textContent = 'No stock counts yet';
  }

  if(!visible.length){
    body.innerHTML = '<div class="pl-empty">No products match your search.</div>';
    return;
  }

  body.innerHTML = '';

  // Group by category
  const groupAll = plCat==='All' || plCat==='__lowstock__';
  const cats = groupAll
    ? [...new Set(visible.map(i=>i.category))]
    : [plCat];

  cats.forEach(cat=>{
    const catItems = visible.filter(i=>i.category===cat);
    if(!catItems.length) return;

    if(groupAll){
      const hdr = document.createElement('div');
      hdr.className = 'pl-cat-header';
      hdr.textContent = cat + ' (' + catItems.length + ')';
      body.appendChild(hdr);
    }

    catItems.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'pl-row';

      // Stock display
      let stockHtml = '';
      if(item.stock === null){
        stockHtml = `<div class="pl-stock">
          <div class="pl-stock-val pl-stock-na">—</div>
          <div class="pl-stock-label">no count</div>
        </div>`;
      } else {
        const qty = Number(item.stock);
        const par = Number(item.parLevel) || 0;
        let cls, label;
        if(qty <= 0){
          cls = 'pl-stock-out'; label = 'FOR BACKORDER';
        } else if(par > 0 && qty < par){
          cls = 'pl-stock-low'; label = 'LOW (par ' + par + ')';
        } else {
          cls = 'pl-stock-ok'; label = 'IN STOCK';
        }
        stockHtml = `<div class="pl-stock">
          <div class="pl-stock-val ${cls}">${qty <= 0 ? '0' : qty}</div>
          <div class="pl-stock-label">${label}</div>
        </div>`;
      }

      // Price display
      const priceHtml = item.price > 0
        ? `<div class="pl-price">
            <div class="pl-price-val">₱${Number(item.price).toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
            <div class="pl-price-label">per ${item.unit||'unit'}</div>
          </div>`
        : `<div class="pl-price">
            <div class="pl-price-val" style="color:#ccc">—</div>
            <div class="pl-price-label">no price</div>
          </div>`;

      row.innerHTML = `
        <div class="pl-info">
          <div class="pl-name">${item.name}</div>
          <div class="pl-code">${item.sku}</div>
        </div>
        ${priceHtml}
        ${stockHtml}`;
      body.appendChild(row);
    });
  });
}


// ════════════════════════════════════════════════════════
// COST PRICE EDITOR — admin only
// ════════════════════════════════════════════════════════
let ceType = 'dist';
let ceSearch = '';
let ceEdits = {};  // {skuCode: newCost}
let ceSKUs = [];   // current type's SKUs from liveSKUs

