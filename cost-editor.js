function openCostEditor(){
  showScreen('cost-editor-screen');
  ceType = 'dist';
  ceSearch = '';
  ceEdits = {};
  document.getElementById('ce-search').value = '';
  document.getElementById('ce-btn-dist').classList.add('active');
  document.getElementById('ce-btn-retail').classList.remove('active');
  buildCEList();
}

function closeCostEditor(){
  if(Object.keys(ceEdits).length > 0){
    if(!confirm('You have unsaved changes. Leave without saving?')) return;
  }
  showAdmin();
}

function setCEType(type){
  if(Object.keys(ceEdits).length > 0){
    if(!confirm('Switching type will lose unsaved changes. Continue?')) return;
  }
  ceType = type;
  ceEdits = {};
  ceSearch = '';
  document.getElementById('ce-search').value = '';
  document.getElementById('ce-btn-dist').classList.toggle('active', type==='dist');
  document.getElementById('ce-btn-retail').classList.toggle('active', type==='retail');
  buildCEList();
}

function filterCostEditor(val){
  ceSearch = val.toLowerCase().trim();
  renderCEList();
}

function buildCEList(){
  const typeFilter = ceType === 'dist' ? 'DIST' : 'RETAIL';
  ceSKUs = liveSKUs.filter(s => s.type === typeFilter);
  renderCEList();
}

function renderCEList(){
  const body = document.getElementById('ce-body');
  if(!ceSKUs.length){
    body.innerHTML = '<div class="ce-empty">No SKUs found. Make sure SKU Masters are uploaded.</div>';
    updateCEProgress();
    return;
  }

  let visible = ceSearch
    ? ceSKUs.filter(s =>
        s.name.toLowerCase().includes(ceSearch) ||
        String(s.code).toLowerCase().includes(ceSearch))
    : ceSKUs;

  if(!visible.length){
    body.innerHTML = '<div class="ce-empty">No products match your search.</div>';
    updateCEProgress();
    return;
  }

  body.innerHTML = '';
  const cats = [...new Set(visible.map(s=>s.category))];

  cats.forEach(cat => {
    const catSkus = visible.filter(s=>s.category===cat);
    if(!catSkus.length) return;

    const hdr = document.createElement('div');
    hdr.className = 'ce-cat-header';
    const filled = catSkus.filter(s=>{
      const edit = ceEdits[s.code];
      return edit !== undefined ? edit > 0 : s.cost > 0;
    }).length;
    hdr.textContent = cat + ' — ' + filled + '/' + catSkus.length + ' filled';
    body.appendChild(hdr);

    catSkus.forEach(sku => {
      const currentCost = ceEdits[sku.code] !== undefined
        ? ceEdits[sku.code]
        : (sku.cost || 0);
      const hasCost = currentCost > 0;

      const row = document.createElement('div');
      row.className = 'ce-row' + (hasCost ? ' has-cost' : '');
      row.id = 'ce-row-' + sku.code.replace(/[^a-z0-9]/gi,'_');
      row.innerHTML = `
        <div class="ce-info">
          <div class="ce-name">${sku.name}</div>
          <div class="ce-code">${sku.code}${sku.supplier?' · '+sku.supplier:''}</div>
        </div>
        <div class="ce-input-wrap">
          <span class="ce-input-label">COST PRICE ₱</span>
          <input class="ce-cost-input ${hasCost?'filled':''}"
            type="number" min="0" step="0.01"
            value="${hasCost ? currentCost : ''}"
            placeholder="0.00"
            id="ce-input-${sku.code.replace(/[^a-z0-9]/gi,'_')}"
            oninput="onCEInput('${sku.code}', this)">
        </div>`;
      body.appendChild(row);
    });
  });

  updateCEProgress();
}

function onCEInput(code, input){
  const val = parseFloat(input.value) || 0;
  ceEdits[code] = val;

  // Update row highlight
  const rowId = 'ce-row-' + code.replace(/[^a-z0-9]/gi,'_');
  const row = document.getElementById(rowId);
  if(row) row.className = 'ce-row' + (val > 0 ? ' has-cost' : '');
  input.className = 'ce-cost-input' + (val > 0 ? ' filled' : '');

  updateCEProgress();
  const btn = document.getElementById('ce-save-fab');
  if(btn) btn.disabled = Object.keys(ceEdits).length === 0;
}

function updateCEProgress(){
  const total = ceSKUs.length;
  const filled = ceSKUs.filter(s => {
    const edit = ceEdits[s.code];
    return edit !== undefined ? edit > 0 : s.cost > 0;
  }).length;
  const pct = total > 0 ? Math.round(filled/total*100) : 0;
  const prog = document.getElementById('ce-progress-text');
  const pctEl = document.getElementById('ce-progress-pct');
  if(prog) prog.textContent = filled + ' of ' + total + ' SKUs have cost price';
  if(pctEl) pctEl.textContent = pct + '% complete';
}

async function saveCostPrices(){
  const edits = Object.entries(ceEdits).filter(([,v]) => v >= 0);
  if(!edits.length){ alert('No changes to save.'); return; }

  const btn = document.getElementById('ce-save-fab');
  btn.disabled = true;
  btn.textContent = '⏳ Saving ' + edits.length + ' prices...';

  try{
    const r = await api({
      action: 'updateCostPrices',
      type: ceType,
      edits: Object.fromEntries(edits)
    });
    if(r.status === 'ok'){
      // Update liveSKUs cache so PO auto-fill uses new costs immediately
      edits.forEach(([code, cost]) => {
        const sku = liveSKUs.find(s=>s.code===code);
        if(sku) sku.cost = cost;
      });
      ceEdits = {};
      btn.disabled = false;
      btn.innerHTML = '💾 Save Changes';
      // Show success in topbar area
      const prog = document.getElementById('ce-progress-text');
      if(prog){
        const old = prog.textContent;
        prog.style.color = '#27AE60';
        prog.textContent = '✓ ' + edits.length + ' cost prices saved!';
        setTimeout(()=>{ prog.style.color=''; buildCEList(); }, 2500);
      }
    } else {
      alert('Error: ' + (r.msg||'Could not save'));
      btn.disabled = false;
      btn.innerHTML = '💾 Save Changes';
    }
  }catch(e){
    alert('Network error: ' + e.message);
    btn.disabled = false;
    btn.innerHTML = '💾 Save Changes';
  }
}

// ════════════════════════════════════════════════════════
// STOCK ADJUSTMENT SYSTEM
// Types: receive | count | remove | damage
// Segments: dist | retail
// ════════════════════════════════════════════════════════
let saSegment = 'dist';
let saType    = 'receive';
let saLines   = [];
let saStockMap= {};

const SA_TYPES = {
  receive:{ label:'Receive',        hint:'Adds quantity to current stock' },
  count:  { label:'Inventory Count',hint:'Sets stock to the counted value' },
  remove: { label:'Remove',         hint:'Reduces stock — e.g. unrecorded transfer' },
  damage: { label:'Damage',         hint:'Reduces stock — records loss/damage' }
};

