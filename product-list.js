async function openPL(){
  showScreen('pl-screen');
  updateFabVisibility();
  document.getElementById('pl-search').value = '';
  plSearch = '';
  plTab = 'dist';
  plCat = 'All';
  document.querySelectorAll('.pl-subtab').forEach(t=>t.classList.remove('active'));
  document.getElementById('pl-tab-dist').classList.add('active');
  document.getElementById('pl-body').innerHTML = '<div class="pl-empty">Loading product list...</div>';
  document.getElementById('pl-summary-count').textContent = 'Loading...';
  await loadPLData();
  buildPLChips();
  renderPL();
}

function closePL(){ showHome(); }

async function loadPLData(){
  try{
    const r = await api({action:'getProductList'});
    if(r.status==='ok'){
      plData.dist   = r.dist   || [];
      plData.retail = r.retail || [];
      plLoaded = true;
    }
  }catch(e){
    console.error('loadPLData failed', e);
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
  let visible = plCat==='All' ? items : items.filter(i=>i.category===plCat);
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
    document.getElementById('pl-summary-updated').textContent = 'Stock as of: ' + latest.lastUpdated;
  } else {
    document.getElementById('pl-summary-updated').textContent = 'No stock counts yet';
  }

  if(!visible.length){
    body.innerHTML = '<div class="pl-empty">No products match your search.</div>';
    return;
  }

  body.innerHTML = '';

  // Group by category
  const cats = plCat==='All'
    ? [...new Set(visible.map(i=>i.category))]
    : [plCat];

  cats.forEach(cat=>{
    const catItems = visible.filter(i=>i.category===cat);
    if(!catItems.length) return;

    if(plCat==='All'){
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
        const cls = qty <= 0 ? 'pl-stock-out' : qty <= 5 ? 'pl-stock-low' : 'pl-stock-ok';
        const label = qty <= 0 ? 'FOR BACKORDER' : qty <= 5 ? 'LOW' : 'IN STOCK';
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

