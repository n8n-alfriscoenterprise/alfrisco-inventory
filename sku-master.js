async function loadSKUMaster() {
  try {
    const r = await api({action: 'getAllSKUs'});
    if (r.status === 'ok' && Array.isArray(r.skus) && r.skus.length > 0) {
      liveSKUs = r.skus;
      rebuildSKUData();
      buildBoDropdown();
      return true;
    }
    // Fallback: try old single-sheet action
    const r2 = await api({action: 'getSKUMaster'});
    if (r2.status === 'ok' && Array.isArray(r2.skus) && r2.skus.length > 0) {
      liveSKUs = r2.skus;
      rebuildSKUData();
      buildBoDropdown();
      return true;
    }
    return false;
  } catch(e) { return false; }
}

function rebuildSKUData() {
  // Rebuild BOTH lists from the live SKU Master sheets. Retail used to be
  // additive only — seeded from the hardcoded CS_BASE and topped up each load —
  // so items deactivated or deleted in SKU Master - Retail lingered forever and
  // the cached copy in localStorage kept them alive across sessions. Both lists
  // are now wiped first, so the app can only ever show what the master says.
  DIST_CATS.length = 0;
  Object.keys(DIST_SKUS).forEach(k => delete DIST_SKUS[k]);
  Object.keys(csskus).forEach(k => delete csskus[k]);

  const distCatsSeen = [];
  liveSKUs.forEach(sku => {
    if (sku.type === 'DIST') {
      if (!DIST_SKUS[sku.category]) {
        DIST_SKUS[sku.category] = [];
        distCatsSeen.push(sku.category);
      }
      DIST_SKUS[sku.category].push({code: sku.code, name: sku.name});
    } else if (sku.type === 'RETAIL') {
      if (!csskus[sku.category]) csskus[sku.category] = [];
      // Names come from the master too, so a rename there shows up here
      const seen = csskus[sku.category].find(s => s.code === sku.code);
      if (seen) seen.name = sku.name;
      else csskus[sku.category].push({code: sku.code, name: sku.name});
    }
  });
  // Maintain ordered category list
  distCatsSeen.forEach(c => { if (!DIST_CATS.includes(c)) DIST_CATS.push(c); });
  // Persist the corrected list so the stale cached copy is replaced immediately
  if (typeof saveLocal === 'function') saveLocal();
}

function buildBoDropdown() {
  const sel = document.getElementById('bo-sku-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">-- Select item --</option>';

  // Group: Distribution categories first, then Retail
  const distCats = [...new Set(liveSKUs.filter(s=>s.type==='DIST').map(s=>s.category))];
  const retailCats = [...new Set(liveSKUs.filter(s=>s.type==='RETAIL').map(s=>s.category))];

  distCats.forEach(cat => {
    const og = document.createElement('optgroup');
    og.label = '📦 ' + cat;
    liveSKUs.filter(s=>s.type==='DIST'&&s.category===cat).forEach(sku => {
      const opt = document.createElement('option');
      opt.value = sku.code + '|' + sku.name;
      opt.textContent = sku.name;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });

  retailCats.forEach(cat => {
    const og = document.createElement('optgroup');
    og.label = '🌾 Retail — ' + cat;
    liveSKUs.filter(s=>s.type==='RETAIL'&&s.category===cat).forEach(sku => {
      const opt = document.createElement('option');
      opt.value = sku.code + '|' + sku.name;
      opt.textContent = sku.name;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
}

// ── BACKORDER FLOATING BUTTON ──
// ═══════════════════════════════════════════════════
// BACKORDER SYSTEM — per-line type toggle, always visible
// ═══════════════════════════════════════════════════
let boLines = [];
// Each line: { type:'dist'|'retail', skuValue:'', skuName:'', qty:1, unit:'bag' }

