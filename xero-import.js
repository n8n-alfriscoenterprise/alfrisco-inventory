// ════════════════════════════════════════════════════════
// SALES IMPORT — Distribution (Xero) + Retail (Loyverse)
// ════════════════════════════════════════════════════════

let siActiveTab = 'xero';

function openSalesImport(){
  showScreen('sales-import-screen');
  updateFabVisibility();
  setSiTab('xero');
  resetXiTab();
  resetLyTab();
  // Pre-load dealer list so contact cross-check works immediately
  if(!dealerList.length) loadDealers();
}

function closeSalesImport(){ showHome(); }

function setSiTab(tab){
  siActiveTab = tab;
  document.querySelectorAll('.si-tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('si-tab-'+tab).classList.add('active');
  document.getElementById('si-panel-xero').style.display      = tab==='xero'      ? 'flex' : 'none';
  document.getElementById('si-panel-loyverse').style.display  = tab==='loyverse'  ? 'flex' : 'none';
}


// ════════════════════════════════════════════════════════
// TAB 1 — XERO  (Distribution Sales)
// ════════════════════════════════════════════════════════
let xiRows = [];

function resetXiTab(){
  xiRows = []; xiFileName = ''; xiOverlap = null;
  const fi = document.getElementById('xi-file-input'); if(fi) fi.value='';
  const pa = document.getElementById('xi-preview-area'); if(pa) pa.innerHTML='';
  const cb = document.getElementById('xi-confirm-btn'); if(cb) cb.style.display='none';
  const dz = document.getElementById('xi-drop-zone'); if(dz) dz.classList.remove('xi-drop-active');
  // Hide the upload-mode selector and reset it to the safe default (For Loading)
  const mw = document.getElementById('xi-mode-wrap'); if(mw) mw.style.display='none';
  const ml = document.querySelector('input[name="xi-mode"][value="load"]'); if(ml) ml.checked=true;
  // Reversal tool is admin-only, and always available on this tab (no file needed)
  const rt = document.getElementById('xi-reversal-tool');
  if(rt) rt.style.display = (currentUser && currentUser.role==='admin') ? 'block' : 'none';
  // Sales Log corrections — admin, or anyone granted "Can Edit Sales Log"
  const st = document.getElementById('xi-saleslog-tool');
  if(st) st.style.display = (currentUser && (currentUser.role==='admin'
      || currentUser.canEditSalesLog===true)) ? 'block' : 'none';
  setXiStatus('','');
}

// ── Drag-drop ─────────────────────────────────────────
function onXiFileSelect(input){ if(input.files[0]) readXiFile(input.files[0]); }
function onXiDragOver(e){ e.preventDefault(); document.getElementById('xi-drop-zone').classList.add('xi-drop-active'); }
function onXiDragLeave(){ document.getElementById('xi-drop-zone').classList.remove('xi-drop-active'); }
function onXiDrop(e){
  e.preventDefault();
  document.getElementById('xi-drop-zone').classList.remove('xi-drop-active');
  if(e.dataTransfer.files[0]) readXiFile(e.dataTransfer.files[0]);
}

// The file name is kept so an overwrite can say WHICH file is being replaced
// by WHICH — a bare "3 invoices updated" gives no way to tell whether the right
// file went in, and uploads happen several times a day as invoices accumulate.
let xiFileName = '';

function readXiFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){ setXiStatus('Please select a CSV file exported from Xero.','error'); return; }
  xiFileName = file.name;
  setXiStatus('Reading file…','ok');
  const reader = new FileReader();
  reader.onload = e => parseXiCSV(e.target.result);
  reader.readAsText(file);
}

// ── Parser ────────────────────────────────────────────
function parseXiCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2){ setXiStatus('File appears empty.','error'); return; }

  const headers = parseSiLine(lines[0]);
  const col = {};
  const needed = {
    contact:'ContactName', invoiceNum:'InvoiceNumber', invoiceDate:'InvoiceDate',
    dueDate:'DueDate', total:'Total', amountPaid:'InvoiceAmountPaid',
    amountDue:'InvoiceAmountDue', skuCode:'InventoryItemCode', description:'Description',
    quantity:'Quantity', unitAmount:'UnitAmount', lineAmount:'LineAmount',
    status:'Status', type:'Type'
  };
  Object.entries(needed).forEach(([k,v])=>{ col[k]=headers.indexOf(v); });

  // Xero's tracking categories land in fixed slots on the Sales Invoice export:
  //   TrackingOption1 = column AL = Location      (Warehouse / Retail Store)
  //   TrackingOption2 = column AN = Division      (Wholesale-Bajaj1/2 → routes the van)
  // Read them by header name, falling back to the known column positions if a
  // header is renamed or missing. An earlier version worked out the mapping from
  // the TrackingName values in the FIRST data row, which silently captured no
  // Location at all whenever that one row happened to have a blank name.
  const LOC_COL_AL = 37;   // column AL, 0-based
  const DIV_COL_AN = 39;   // column AN, 0-based
  col.location = headers.indexOf('TrackingOption1');
  col.division = headers.indexOf('TrackingOption2');
  if(col.location < 0 && headers.length > LOC_COL_AL) col.location = LOC_COL_AL;
  if(col.division < 0 && headers.length > DIV_COL_AN) col.division = DIV_COL_AN;

  if(col.invoiceNum<0||col.skuCode<0){
    setXiStatus('This doesn\'t look like a Xero Sales Invoice export. Export from Accounts → Sales Invoices and try again.','error');
    return;
  }

  // Xero (PH) exports dates as DD/MM/YYYY. Convert to ISO here so Google Sheets
  // can never re-interpret them: a US-locale sheet auto-parses "04/07/2026" as
  // April 7, which silently filed every day-1-to-12 invoice under the wrong
  // month and made it vanish from the Load List.
  const _xiToISO = s => {
    const m = String(s||'').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return m ? m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2) : String(s||'').trim();
  };

  xiRows = [];
  lines.slice(1).forEach(line=>{
    if(!line.trim()) return;
    const r = parseSiLine(line);
    const type   = String(r[col.type]  ||'').toLowerCase();
    const status = String(r[col.status]||'').toLowerCase();
    if(!type.includes('invoice')) return;
    if(status==='voided'||status==='deleted') return;
    const skuCode = String(r[col.skuCode]||'').trim();
    if(!skuCode) return;
    xiRows.push({
      invoiceNumber: String(r[col.invoiceNum]  ||'').trim(),
      invoiceDate:   _xiToISO(r[col.invoiceDate]),
      dueDate:       _xiToISO(r[col.dueDate]),
      contactName:   String(r[col.contact]     ||'').trim(),
      skuCode,
      description:   String(r[col.description]||'').trim(),
      quantity:      parseFloat(r[col.quantity])   ||0,
      unitAmount:    parseFloat(r[col.unitAmount]) ||0,
      lineAmount:    parseFloat(r[col.lineAmount]) ||0,
      invoiceTotal:  parseFloat(r[col.total])      ||0,
      amountPaid:    parseFloat(r[col.amountPaid]) ||0,
      amountDue:     parseFloat(r[col.amountDue])  ||0,
      status:        String(r[col.status]||'').trim(),
      division:      col.division>=0 ? String(r[col.division]||'').trim() : '',
      location:      col.location>=0 ? String(r[col.location]||'').trim() : ''
    });
  });

  if(!xiRows.length){ setXiStatus('No valid sales invoice line items found. Check that your export includes line-item detail.','error'); return; }
  renderXiPreview();
}

// ── Preview ───────────────────────────────────────────
function renderXiPreview(){
  const area = document.getElementById('xi-preview-area');
  const invoices = [...new Set(xiRows.map(r=>r.invoiceNumber))];
  const dealers  = [...new Set(xiRows.map(r=>r.contactName))];
  const revenue  = xiRows.reduce((s,r)=>s+r.lineAmount,0);
  const dates    = xiRows.map(r=>r.invoiceDate).filter(Boolean).sort();
  const dr = dates.length ? (dates[0]===dates[dates.length-1] ? dates[0] : dates[0]+' – '+dates[dates.length-1]) : '—';

  // ── Cross-check Xero SKUs against Dist SKU Master ─────────────
  const xiSkuCodes  = [...new Set(xiRows.map(r=>r.skuCode))];
  const distKnown   = new Set(
    (liveSKUs||[]).filter(s=>s.type==='DIST').map(s=>s.code.trim().toLowerCase())
  );
  const unknownXiSkus = xiSkuCodes.filter(s=>!distKnown.has(s.trim().toLowerCase()));

  // ── Cross-check contacts against dealer directory ──────────────
  const unrecognized = _findUnrecognizedContacts(dealers);

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${invoices.length}</div><div class="si-stat-label">Invoices</div></div>
      <div class="si-stat"><div class="si-stat-val">${xiRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val">${dealers.length}</div><div class="si-stat-label">Dealers</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Revenue</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}</div>
    ${xiFileName ? `<div class="xi-filename">📄 ${_xiEsc(xiFileName)}</div>` : ''}
    <div id="xi-overlap-area"><div class="xi-overlap-checking">Checking what this file would replace…</div></div>`;

  // ── Xero SKU mismatch warning banner ──────────────────────────
  if(unknownXiSkus.length){
    const skuItems = unknownXiSkus.map(s=>{
      const lines    = xiRows.filter(r=>r.skuCode===s);
      const itemName = lines[0]?.description || '—';
      const totalQty = lines.reduce((sum,r)=>sum+r.quantity,0);
      return `<div class="ly-sku-warn-item"><strong>${s}</strong> — ${itemName} <span class="ly-sku-warn-qty">(total qty: ${totalQty})</span></div>`;
    }).join('');
    html+=`<div class="ly-sku-warn-wrap">
      <div class="ly-sku-warn-title">⚠ ${unknownXiSkus.length} SKU${unknownXiSkus.length!==1?'s':''} not found in Distribution SKU Master</div>
      <div class="ly-sku-warn-sub">These Xero SKU codes don't match any item in your Distribution SKU Master. Sales will still be logged, but stock won't be deducted for these items. Update the SKU Master first if needed.</div>
      <div class="ly-sku-warn-list">${skuItems}</div>
    </div>`;
  }

  // ── Unrecognized contacts banner ───────────────────────────────
  if(unrecognized.length){
    html += `<div class="xi-new-contacts-wrap">
      <div class="xi-new-contacts-title">⚠ ${unrecognized.length} contact${unrecognized.length!==1?'s':''} not in your Dealer Directory</div>
      <div class="xi-new-contacts-sub">These names appear in Xero but have no matching dealer record. You can add them now or import the data as-is.</div>
      <div id="xi-new-contacts-list">`;
    unrecognized.forEach(c=>{
      const contactRows = xiRows.filter(r=>r.contactName===c.name);
      const invCount = [...new Set(contactRows.map(r=>r.invoiceNumber))].length;
      // Xero repeats the invoice Total on every line — count each invoice's total
      // ONCE (otherwise a 2-line invoice shows 2× its real amount, etc.)
      const seenInv = {}; let total = 0;
      contactRows.forEach(r=>{ if(!seenInv[r.invoiceNumber]){ seenInv[r.invoiceNumber]=true; total += r.invoiceTotal; } });
      const uid      = 'xnc-'+c.name.replace(/[^a-zA-Z0-9]/g,'_');
      html += `<div class="xi-new-contact-card" id="${uid}">
        <div class="xi-nc-info">
          <div class="xi-nc-name">${c.name}</div>
          <div class="xi-nc-meta">${invCount} invoice${invCount!==1?'s':''} &nbsp;·&nbsp; ₱${total.toLocaleString('en-PH',{minimumFractionDigits:2})}</div>
        </div>
        <button class="xi-nc-add-btn" onclick="xiShowAddDealer('${c.name.replace(/'/g,"\\'")}','${uid}')">➕ Add as Dealer</button>
      </div>
      <div class="xi-nc-form" id="${uid}-form" style="display:none"></div>`;
    });
    html += `</div></div>`;
  }

  html += `<div class="si-table-wrap">
    <table class="si-table">
      <thead><tr><th>Invoice</th><th>Date</th><th>Dealer</th><th>SKU</th><th>Item</th><th>Qty</th><th>Unit ₱</th><th>Amount</th><th>Status</th></tr></thead>
      <tbody>`;
  xiRows.forEach(r=>{
    const sc = r.status.toLowerCase().includes('paid') ? 'si-badge-paid'
             : r.status.toLowerCase().includes('awaiting') ? 'si-badge-awaiting' : '';
    html+=`<tr>
      <td>${r.invoiceNumber}</td><td class="si-nowrap">${r.invoiceDate}</td>
      <td>${r.contactName}</td><td><strong>${r.skuCode}</strong></td><td>${r.description}</td>
      <td>${r.quantity}</td>
      <td class="si-num">₱${r.unitAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td class="si-num si-green">₱${r.lineAmount.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td><span class="si-badge ${sc}">${r.status}</span></td>
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  area.innerHTML = html;
  const mw = document.getElementById('xi-mode-wrap'); if(mw) mw.style.display='block';
  document.getElementById('xi-confirm-btn').style.display='block';
  onXiModeChange();   // set confirm-button label to match the selected mode
  setXiStatus(`✓ ${xiRows.length} line items across ${invoices.length} invoices ready to import.`,'ok');
  _xiCheckOverlap(invoices);   // fills #xi-overlap-area once the server answers
}

// ── WHAT WILL THIS FILE REPLACE? ──────────────────────────────────────
// Asks the sheet which of these invoices are already imported, and from which
// file, so an overwrite is visible BEFORE anything is written. Read-only.
let xiOverlap = null;   // {byFile:[…], newInvoices:[…]} or null if not checked

async function _xiCheckOverlap(invoices){
  xiOverlap = null;
  const box = document.getElementById('xi-overlap-area');
  if(!box) return;
  try{
    const r = await api({ action:'checkXeroOverlap', invoiceNumbers: invoices });
    if(r.status!=='ok'){ box.innerHTML=''; return; }
    xiOverlap = r;
    const files = r.byFile || [];
    const fresh = (r.newInvoices || []).length;
    if(!files.length){
      box.innerHTML = '<div class="xi-overlap-new">✓ All '+fresh+' invoice'
        + (fresh!==1?'s are':' is') + ' new — nothing will be overwritten.</div>';
      return;
    }
    box.innerHTML = '<div class="xi-overlap-warn">'
      + '<div class="xi-overlap-title">⚠ This upload will REPLACE invoices already imported</div>'
      + files.map(function(f){
          const invs = f.invoices.slice(0,8).join(', ')
            + (f.invoices.length>8 ? ' +'+(f.invoices.length-8)+' more' : '');
          return '<div class="xi-overlap-file">'
            + '<div class="xi-ov-row"><span class="xi-ov-k">Was imported from</span>'
              + '<span class="xi-ov-v">'+_xiEsc(f.file||'(file name not recorded)')+'</span></div>'
            + (f.importedAt ? '<div class="xi-ov-row"><span class="xi-ov-k">On</span>'
              + '<span class="xi-ov-v">'+_xiEsc(f.importedAt)+'</span></div>' : '')
            + '<div class="xi-ov-row"><span class="xi-ov-k">Will be replaced by</span>'
              + '<span class="xi-ov-v xi-ov-new">'+_xiEsc(xiFileName||'this file')+'</span></div>'
            + '<div class="xi-ov-invs">'+f.invoices.length+' invoice'
              + (f.invoices.length!==1?'s':'')+': '+_xiEsc(invs)+'</div>'
          + '</div>';
        }).join('')
      + (fresh ? '<div class="xi-overlap-new">✓ Plus '+fresh+' new invoice'
          + (fresh!==1?'s':'')+' that will be added: '
          + _xiEsc((r.newInvoices||[]).slice(0,8).join(', '))
          + ((r.newInvoices||[]).length>8 ? ' +'+((r.newInvoices||[]).length-8)+' more' : '')
          + '</div>' : '')
      + '</div>';
  }catch(e){
    // Never block the import just because the look-ahead failed
    box.innerHTML = '<div class="xi-overlap-checking">Could not check for existing '
      + 'invoices — you will still be asked to confirm before anything is replaced.</div>';
  }
}

function _xiEsc(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

// Reflect the chosen upload mode on the confirm button so intent is unmistakable
function onXiModeChange(){
  const mode = (document.querySelector('input[name="xi-mode"]:checked')||{}).value || 'load';
  const btn = document.getElementById('xi-confirm-btn');
  if(!btn) return;
  btn.textContent = mode==='warehouse'
    ? '✅ Import & Deduct Warehouse Stock'
    : '✅ Import for Load List (no stock change)';
}

// Returns unique contact names that don't match any dealer (case-insensitive)
function _findUnrecognizedContacts(contactNames){
  if(!dealerList || !dealerList.length) return contactNames.map(n=>({name:n}));
  const known = new Set(dealerList.map(d=>d.storeName.toLowerCase().trim()));
  return contactNames
    .filter(n=>!known.has(n.toLowerCase().trim()))
    .map(n=>({name:n}));
}

// Shows the inline mini-form to add an unrecognized contact as a dealer
function xiShowAddDealer(contactName, uid){
  const formEl = document.getElementById(uid+'-form');
  const addBtn = document.querySelector('#'+uid+' .xi-nc-add-btn');
  if(!formEl) return;

  // If form already open, toggle it closed
  if(formEl.style.display !== 'none'){ formEl.style.display='none'; if(addBtn) addBtn.textContent='➕ Add as Dealer'; return; }
  if(addBtn) addBtn.textContent='✕ Cancel';

  formEl.innerHTML = `
    <div class="xi-nc-form-inner">
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Store Name *</label>
          <input class="xi-nc-input" id="${uid}-store" type="text" value="${contactName.replace(/"/g,'&quot;')}">
        </div>
        <div>
          <label class="xi-nc-label">Owner Name</label>
          <input class="xi-nc-input" id="${uid}-owner" type="text" placeholder="Contact person">
        </div>
      </div>
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Area / Municipality</label>
          <input class="xi-nc-input" id="${uid}-area" type="text" placeholder="e.g. Dagupan City">
        </div>
        <div>
          <label class="xi-nc-label">Phone</label>
          <input class="xi-nc-input" id="${uid}-phone" type="text" placeholder="09XX XXX XXXX">
        </div>
      </div>
      <div class="xi-nc-form-row">
        <div>
          <label class="xi-nc-label">Dealer Type</label>
          <select class="xi-nc-input" id="${uid}-type">
            <option value="Feed Store">Feed Store</option>
            <option value="Pet Shop">Pet Shop</option>
            <option value="Vet Clinic">Vet Clinic</option>
            <option value="General Store">General Store</option>
            <option value="Supermarket">Supermarket</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label class="xi-nc-label">Status</label>
          <select class="xi-nc-input" id="${uid}-status">
            <option value="Active">Active</option>
            <option value="Prospect">Prospect</option>
            <option value="On Hold">On Hold</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>
      <div class="xi-nc-err" id="${uid}-err"></div>
      <button class="xi-nc-save-btn" id="${uid}-save" onclick="xiSaveNewDealer('${uid}','${contactName.replace(/'/g,"\\'")}')">💾 Save to Dealer Directory</button>
    </div>`;
  formEl.style.display = 'block';
}

// Saves the new dealer and marks the contact card as linked
async function xiSaveNewDealer(uid, originalName){
  const storeName = document.getElementById(uid+'-store')?.value.trim();
  const errEl     = document.getElementById(uid+'-err');
  if(!storeName){ if(errEl) errEl.textContent='Store name is required.'; return; }

  const saveBtn = document.getElementById(uid+'-save');
  if(saveBtn){ saveBtn.disabled=true; saveBtn.textContent='Saving…'; }
  if(errEl)  errEl.textContent='';

  const now = new Date().toLocaleString('sv-SE',{timeZone:'Asia/Manila'});
  try{
    const r = await api({
      action:     'saveDealer',
      storeName,
      ownerName:  document.getElementById(uid+'-owner')?.value.trim()  || '',
      phone1:     document.getElementById(uid+'-phone')?.value.trim()  || '',
      area:       document.getElementById(uid+'-area')?.value.trim()   || '',
      dealerType: document.getElementById(uid+'-type')?.value          || 'Feed Store',
      status:     document.getElementById(uid+'-status')?.value        || 'Active',
      addedBy:    currentUser ? currentUser.username : '',
      addedAt:    now
    });
    if(r.status==='ok'){
      // Add to local dealer list so the invoice picker sees it immediately
      dealerList.push({
        dealerId:   r.dealerId,
        storeName,
        ownerName:  document.getElementById(uid+'-owner')?.value.trim()  || '',
        phone1:     document.getElementById(uid+'-phone')?.value.trim()  || '',
        area:       document.getElementById(uid+'-area')?.value.trim()   || '',
        dealerType: document.getElementById(uid+'-type')?.value          || 'Feed Store',
        status:     document.getElementById(uid+'-status')?.value        || 'Active'
      });
      // Replace the card with a success indicator
      const card = document.getElementById(uid);
      const formEl = document.getElementById(uid+'-form');
      if(card) card.innerHTML = `
        <div class="xi-nc-info">
          <div class="xi-nc-name">${storeName}</div>
          <div class="xi-nc-meta" style="color:#1B5E20">✓ Added as dealer — ${r.dealerId}</div>
        </div>`;
      if(formEl) formEl.style.display='none';
      showToast(storeName+' added to Dealer Directory ✓','success');
      // Refresh the invoice dealer picker if it's loaded
      if(typeof buildInvDealerSelect==='function') buildInvDealerSelect();
    } else {
      if(errEl) errEl.textContent = 'Error: '+(r.msg||'Could not save');
      if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 Save to Dealer Directory'; }
    }
  }catch(e){
    if(errEl) errEl.textContent = 'Network error: '+e.message;
    if(saveBtn){ saveBtn.disabled=false; saveBtn.textContent='💾 Save to Dealer Directory'; }
  }
}

// ── Confirm ───────────────────────────────────────────
async function confirmXiImport(){
  if(!xiRows.length) return;
  const mode = (document.querySelector('input[name="xi-mode"]:checked')||{}).value || 'load';

  // Nothing gets overwritten without an explicit yes. The look-ahead already
  // showed this in the preview; this is the last gate before data is replaced.
  const files = (xiOverlap && xiOverlap.byFile) || [];
  if(files.length){
    const totalInv = files.reduce(function(s,f){ return s + f.invoices.length; }, 0);
    const detail = files.map(function(f){
      return '  • ' + (f.file || '(file name not recorded)')
        + (f.importedAt ? '  [' + f.importedAt + ']' : '')
        + '\n    ' + f.invoices.length + ' invoice' + (f.invoices.length!==1?'s':'')
        + ': ' + f.invoices.slice(0,6).join(', ')
        + (f.invoices.length>6 ? ' +'+(f.invoices.length-6)+' more' : '');
    }).join('\n');
    const fresh = (xiOverlap.newInvoices||[]).length;
    const msg = 'REPLACE ' + totalInv + ' invoice' + (totalInv!==1?'s':'') + ' already imported?\n\n'
      + 'Being replaced:\n' + detail + '\n\n'
      + 'Replaced by:\n  • ' + (xiFileName || 'this file') + '\n\n'
      + (fresh ? 'Also adding ' + fresh + ' new invoice' + (fresh!==1?'s':'') + '.\n\n' : '')
      + 'The old lines for those invoices will be deleted and rewritten from this file.';
    if(!confirm(msg)) { setXiStatus('Import cancelled — nothing was changed.','ok'); return; }
  }

  const btn = document.getElementById('xi-confirm-btn');
  const label = btn.textContent;
  btn.disabled=true; btn.textContent='Importing…';
  setXiStatus('Sending to Google Sheets…','ok');
  try{
    const r = await api({action:'importXeroSales', rows:xiRows, importedBy:currentUser.username,
                         stockMode:mode, fileName:xiFileName});
    if(r.status==='ok'){
      const stockNote = r.stockUpdated > 0
        ? ` Warehouse stock deducted for ${r.stockUpdated} SKU${r.stockUpdated!==1?'s':''}.`
        : (mode==='load' ? ' Load list ready — no stock deducted (deducts when the van is loaded).' : '');
      // Name what was displaced, not just how much — "3 invoices updated" gives
      // no way to tell whether the intended file actually went in.
      const from = (r.replacedFrom||[]).map(f=>f.file||'(file name not recorded)');
      const replNote = r.replaced > 0
        ? ` ${r.replaced} invoice${r.replaced!==1?'s':''} replaced`
          + (from.length ? ` (was: ${from.join(', ')} → now: ${r.fileName||xiFileName||'this file'})` : '')
          + '.'
        : '';
      setXiStatus(`✅ Done — ${r.imported} line${r.imported!==1?'s':''} imported.${replNote}${stockNote}`,'ok');
      btn.style.display='none'; xiRows=[]; xiFileName=''; xiOverlap=null;
      document.getElementById('xi-file-input').value='';
      document.getElementById('xi-preview-area').innerHTML='';
      const mw = document.getElementById('xi-mode-wrap'); if(mw) mw.style.display='none';
      // Refresh product list data in background so low-stock badge updates
      if(typeof loadPLData === 'function') loadPLData();
    } else {
      setXiStatus('Import failed: '+(r.msg||'Unknown error'),'error');
      btn.disabled=false; btn.textContent=label;
    }
  }catch(e){
    setXiStatus('Import failed: '+e.message,'error');
    btn.disabled=false; btn.textContent=label;
  }
}

// ── XERO OVER-DEDUCTION REVERSAL (admin one-time cleanup) ────────────
let _xiRevItems = [];   // last scan's affected SKUs (for checkbox totals + apply)

function _xiRevBags(n){ return Math.round(n*100)/100; }

function _xiDateOffset(days){
  const t = (typeof phToday==='function') ? phToday() : new Date().toLocaleDateString('sv-SE');
  const d = new Date(t+'T00:00:00'); d.setDate(d.getDate()+days);
  return d.toLocaleDateString('sv-SE');   // yyyy-MM-dd, local (Manila device)
}

function openXeroReversal(){
  _xiRevItems = [];
  document.getElementById('xi-reversal-err').textContent='';
  document.getElementById('xi-reversal-apply').style.display='none';
  // Default range = yesterday (the usual culprit); chips let you widen instantly
  document.getElementById('xi-rev-from').value = _xiDateOffset(-1);
  document.getElementById('xi-rev-to').value   = _xiDateOffset(-1);
  document.getElementById('xi-reversal-modal').style.display='flex';
  _renderRevChips('yesterday');
  scanXeroReversal();
}

function _renderRevChips(active){
  const chips = [
    {key:'yesterday', label:'Yesterday'},
    {key:'today',     label:'Today'},
    {key:'all',       label:'All dates'}
  ];
  document.getElementById('xi-rev-chips').innerHTML = chips.map(c=>
    `<div class="xi-rev-chip${c.key===active?' active':''}" onclick="_xiRevChip('${c.key}')">${c.label}</div>`
  ).join('');
}

function _xiRevChip(key){
  const from = document.getElementById('xi-rev-from');
  const to   = document.getElementById('xi-rev-to');
  if(key==='yesterday'){ from.value=_xiDateOffset(-1); to.value=_xiDateOffset(-1); }
  else if(key==='today'){ from.value=_xiDateOffset(0); to.value=_xiDateOffset(0); }
  else { from.value=''; to.value=''; }   // all dates
  _renderRevChips(key);
  scanXeroReversal();
}

async function scanXeroReversal(){
  const body = document.getElementById('xi-reversal-body');
  document.getElementById('xi-reversal-err').textContent='';
  document.getElementById('xi-reversal-apply').style.display='none';
  body.innerHTML='<div class="xi-rev-loading">Scanning stock history…</div>';
  const fromDate = document.getElementById('xi-rev-from').value || '';
  const toDate   = document.getElementById('xi-rev-to').value || '';
  try{
    const r = await api({action:'previewXeroReversal', fromDate, toDate});
    if(r.status!=='ok'){ _xiRevError(r.msg||'Could not scan'); return; }
    _renderXeroReversal(r);
  }catch(e){ _xiRevError(e.message); }
}

function _xiRevError(msg){
  document.getElementById('xi-reversal-body').innerHTML='';
  document.getElementById('xi-reversal-err').textContent='Error: '+msg;
}

function _renderXeroReversal(r){
  const body = document.getElementById('xi-reversal-body');
  _xiRevItems = r.items||[];
  const span = (r.minDate && r.maxDate)
    ? `<div class="xi-rev-daterange-note">Reversible Xero deductions on file: ${r.minDate} → ${r.maxDate}. Leave dates blank for all.</div>` : '';
  if(!_xiRevItems.length){
    body.innerHTML = span + '<div class="xi-rev-empty">✓ Nothing to fix in this range — no un-reversed Xero over-deductions found.</div>';
    return;
  }
  let html = span
    + '<div class="xi-rev-summary" id="xi-rev-summary"></div>'
    + '<table class="xi-rev-table"><thead><tr>'
    + '<th class="chk"><input type="checkbox" id="xi-rev-all" checked onchange="_xiRevToggleAll(this.checked)"></th>'
    + '<th>SKU / Item</th><th class="num">Now</th><th class="num">Add back</th><th class="num">→ Corrected</th>'
    + '</tr></thead><tbody>';
  _xiRevItems.forEach((it,idx)=>{
    html += `<tr id="xi-rev-row-${idx}">
      <td class="chk"><input type="checkbox" data-idx="${idx}" checked onchange="_xiRevSync()"></td>
      <td><strong>${it.sku}</strong><br><span style="color:#888">${it.item||''}</span></td>
      <td class="num">${_xiRevBags(it.current)}</td>
      <td class="num xi-rev-add">+${_xiRevBags(it.deducted)}</td>
      <td class="num"><strong>${_xiRevBags(it.corrected)}</strong></td>
    </tr>`;
  });
  html += '</tbody></table>';
  body.innerHTML = html;
  document.getElementById('xi-reversal-apply').style.display='inline-block';
  _xiRevSync();
}

// Recompute the live summary + apply button from the ticked rows
function _xiRevSync(){
  const boxes = document.querySelectorAll('#xi-reversal-body tbody input[type=checkbox]');
  let count=0, bags=0;
  boxes.forEach(b=>{
    const row = b.closest('tr');
    if(b.checked){ count++; bags += (_xiRevItems[+b.dataset.idx]?.deducted||0); row.classList.remove('unchecked'); }
    else row.classList.add('unchecked');
  });
  const sum = document.getElementById('xi-rev-summary');
  if(sum) sum.textContent = `${count} of ${_xiRevItems.length} SKU${_xiRevItems.length!==1?'s':''} selected · adding back ${_xiRevBags(bags)} bag${bags!==1?'s':''}`;
  const allBox = document.getElementById('xi-rev-all');
  if(allBox) allBox.checked = count===boxes.length && count>0;
  const ab = document.getElementById('xi-reversal-apply');
  ab.disabled = count===0;
  ab.textContent = count ? `Apply ${count} correction${count!==1?'s':''}` : 'Select at least one';
}

function _xiRevToggleAll(on){
  document.querySelectorAll('#xi-reversal-body tbody input[type=checkbox]').forEach(b=>{ b.checked=on; });
  _xiRevSync();
}

async function applyXeroReversal(){
  const boxes = document.querySelectorAll('#xi-reversal-body tbody input[type=checkbox]');
  const skus = [];
  boxes.forEach(b=>{ if(b.checked){ const it=_xiRevItems[+b.dataset.idx]; if(it) skus.push(it.sku); } });
  if(!skus.length) return;
  const ab = document.getElementById('xi-reversal-apply');
  ab.disabled=true; ab.textContent='Applying…';
  document.getElementById('xi-reversal-err').textContent='';
  const fromDate = document.getElementById('xi-rev-from').value || '';
  const toDate   = document.getElementById('xi-rev-to').value || '';
  try{
    const r = await api({action:'applyXeroReversal', role:currentUser.role, by:currentUser.username,
      fromDate, toDate, skus});
    if(r.status!=='ok'){ ab.disabled=false; _xiRevSync(); _xiRevError(r.msg||'Could not apply'); return; }
    document.getElementById('xi-reversal-body').innerHTML =
      `<div class="xi-rev-empty">✓ Done — corrected ${r.skuCount} SKU${r.skuCount!==1?'s':''}, added back ${_xiRevBags(r.totalBags)} bags. Product List & Load List now reflect the fix.</div>`;
    ab.style.display='none';
    if(typeof showToast==='function') showToast('Xero over-deductions reversed ✓','success',4500);
    if(typeof loadPLData==='function') loadPLData();
  }catch(e){ ab.disabled=false; _xiRevSync(); _xiRevError(e.message); }
}

function closeXeroReversal(){
  const m = document.getElementById('xi-reversal-modal');
  if(m) m.style.display='none';
}

function setXiStatus(msg,type){
  const el=document.getElementById('xi-status'); if(!el) return;
  el.textContent=msg;
  el.className='si-status'+(type==='error'?' si-status-error':type==='ok'?' si-status-ok':'');
}


// ════════════════════════════════════════════════════════
// TAB 2 — LOYVERSE  (Retail Sales)
// ════════════════════════════════════════════════════════
let lyRows = [];

function resetLyTab(){
  lyRows = [];
  const fi = document.getElementById('ly-file-input'); if(fi) fi.value='';
  const pa = document.getElementById('ly-preview-area'); if(pa) pa.innerHTML='';
  const cb = document.getElementById('ly-confirm-btn'); if(cb) cb.style.display='none';
  const dz = document.getElementById('ly-drop-zone'); if(dz) dz.classList.remove('xi-drop-active');
  setLyStatus('','');
}

// ── Drag-drop ─────────────────────────────────────────
function onLyFileSelect(input){ if(input.files[0]) readLyFile(input.files[0]); }
function onLyDragOver(e){ e.preventDefault(); document.getElementById('ly-drop-zone').classList.add('xi-drop-active'); }
function onLyDragLeave(){ document.getElementById('ly-drop-zone').classList.remove('xi-drop-active'); }
function onLyDrop(e){
  e.preventDefault();
  document.getElementById('ly-drop-zone').classList.remove('xi-drop-active');
  if(e.dataTransfer.files[0]) readLyFile(e.dataTransfer.files[0]);
}

function readLyFile(file){
  if(!file.name.toLowerCase().endsWith('.csv')){ setLyStatus('Please select a CSV file exported from Loyverse.','error'); return; }
  setLyStatus('Reading file…','ok');
  const reader = new FileReader();
  reader.onload = e => parseLyCSV(e.target.result);
  reader.readAsText(file);
}

// ── Parser ────────────────────────────────────────────
function parseLyCSV(text){
  const lines = text.trim().split(/\r?\n/);
  if(lines.length < 2){ setLyStatus('File appears empty.','error'); return; }

  const headers = parseSiLine(lines[0]);
  // Loyverse "Receipts by Item" columns
  const col = {
    date:       headers.indexOf('Date'),
    receiptNum: headers.indexOf('Receipt number'),
    type:       headers.indexOf('Receipt type'),
    category:   headers.indexOf('Category'),
    sku:        headers.indexOf('SKU'),
    item:       headers.indexOf('Item'),
    variant:    headers.indexOf('Variant'),
    qty:        headers.indexOf('Quantity'),
    grossSales: headers.indexOf('Gross sales'),
    discounts:  headers.indexOf('Discounts'),
    netSales:   headers.indexOf('Net sales'),
    cogs:       headers.indexOf('Cost of goods'),
    profit:     headers.indexOf('Gross profit'),
    taxes:      headers.indexOf('Taxes'),
    cashier:    headers.indexOf('Cashier name'),
    customer:   headers.indexOf('Customer name'),
    contacts:   headers.indexOf('Customer contacts'),
    store:      headers.indexOf('Store'),
    status:     headers.indexOf('Status')
  };

  if(col.receiptNum<0||col.sku<0){
    setLyStatus('This doesn\'t look like a Loyverse "Receipts by Item" export. Export from Loyverse → Reports → Receipts by Item.','error');
    return;
  }

  lyRows = [];
  lines.slice(1).forEach(line=>{
    if(!line.trim()) return;
    const r = parseSiLine(line);
    const type   = String(r[col.type]  ||'').toLowerCase();
    const status = String(r[col.status]||'').toLowerCase();
    // Keep Sales and Refunds; skip voided
    if(!type.includes('sale')&&!type.includes('refund')) return;
    if(status==='voided') return;
    const sku = String(r[col.sku]||'').trim();
    if(!sku) return;

    // Parse date and time from combined field e.g. "5/3/26 7:12 PM"
    const rawDate = String(r[col.date]||'').trim();
    const dateParts = rawDate.split(' ');
    const dateOnly = dateParts[0]||rawDate;
    const timeOnly = dateParts.length>1 ? dateParts.slice(1).join(' ') : '';

    const qty = parseFloat(r[col.qty])||0;
    // Refunds come through as positive qty — sign by type
    const signedQty = type.includes('refund') ? -Math.abs(qty) : qty;

    lyRows.push({
      receiptNumber: String(r[col.receiptNum]||'').trim(),
      date:          dateOnly,
      time:          timeOnly,
      receiptType:   String(r[col.type]||'').trim(),
      category:      String(r[col.category]||'').trim(),
      sku,
      item:          String(r[col.item]   ||'').trim(),
      variant:       String(r[col.variant]||'').trim(),
      qty:           signedQty,
      grossSales:    parseFloat(r[col.grossSales])||0,
      discounts:     parseFloat(r[col.discounts]) ||0,
      netSales:      parseFloat(r[col.netSales])  ||0,
      cogs:          parseFloat(r[col.cogs])       ||0,
      grossProfit:   parseFloat(r[col.profit])     ||0,
      taxes:         parseFloat(r[col.taxes])      ||0,
      cashier:       String(r[col.cashier] ||'').trim(),
      customerName:  String(r[col.customer]||'').trim(),
      customerContact:String(r[col.contacts]||'').trim(),
      store:         String(r[col.store]   ||'').trim(),
      status:        String(r[col.status]  ||'').trim()
    });
  });

  if(!lyRows.length){ setLyStatus('No valid receipt line items found. Check you exported "Receipts by Item" (not the summary report).','error'); return; }
  renderLyPreview();
}

// ── Preview ───────────────────────────────────────────
function renderLyPreview(){
  const area = document.getElementById('ly-preview-area');
  const receipts  = [...new Set(lyRows.map(r=>r.receiptNumber))];
  const revenue   = lyRows.filter(r=>r.receiptType.toLowerCase().includes('sale')).reduce((s,r)=>s+r.netSales,0);
  const refunds   = lyRows.filter(r=>r.receiptType.toLowerCase().includes('refund')).reduce((s,r)=>s+r.netSales,0);
  const profit    = lyRows.reduce((s,r)=>s+r.grossProfit,0);
  const dates     = lyRows.map(r=>r.date).filter(Boolean).sort();
  const dr = dates.length ? (dates[0]===dates[dates.length-1] ? dates[0] : dates[0]+' – '+dates[dates.length-1]) : '—';
  const refundCount = lyRows.filter(r=>r.receiptType.toLowerCase().includes('refund')).length;

  // ── Cross-check Loyverse SKUs against Retail SKU Master ───────────
  const lySkuCodes   = [...new Set(lyRows.map(r=>r.sku))];
  const retailKnown  = new Set(
    (liveSKUs||[]).filter(s=>s.type==='RETAIL').map(s=>s.code.trim().toLowerCase())
  );
  const unknownSkus  = lySkuCodes.filter(s=>!retailKnown.has(s.trim().toLowerCase()));

  let html = `
    <div class="si-summary-grid">
      <div class="si-stat"><div class="si-stat-val">${receipts.length}</div><div class="si-stat-label">Receipts</div></div>
      <div class="si-stat"><div class="si-stat-val">${lyRows.length}</div><div class="si-stat-label">Lines</div></div>
      <div class="si-stat"><div class="si-stat-val si-green">₱${revenue.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Net Sales</div></div>
      <div class="si-stat"><div class="si-stat-val si-profit">₱${profit.toLocaleString('en-PH',{minimumFractionDigits:2})}</div><div class="si-stat-label">Gross Profit</div></div>
    </div>
    <div class="si-date-range">📅 &nbsp;${dr}${refundCount>0?' &nbsp;·&nbsp; <span style="color:#C62828">'+refundCount+' refund line'+(refundCount!==1?'s':'')+' included</span>':''}</div>`;

  // ── SKU mismatch warning banner ────────────────────────────────────
  if(unknownSkus.length){
    const skuItems = unknownSkus.map(s=>{
      const lines    = lyRows.filter(r=>r.sku===s);
      const itemName = lines[0]?.item || '—';
      const netQty   = lines.reduce((sum,r)=>sum+r.qty,0);
      return `<div class="ly-sku-warn-item"><strong>${s}</strong> — ${itemName} <span class="ly-sku-warn-qty">(net qty: ${netQty})</span></div>`;
    }).join('');
    html+=`<div class="ly-sku-warn-wrap">
      <div class="ly-sku-warn-title">⚠ ${unknownSkus.length} SKU${unknownSkus.length!==1?'s':''} not found in Retail SKU Master</div>
      <div class="ly-sku-warn-sub">These Loyverse SKU codes don't match any item in your app's Retail SKU Master. Sales will still be logged, but stock won't be deducted for these items. Update the SKU Master first if needed.</div>
      <div class="ly-sku-warn-list">${skuItems}</div>
    </div>`;
  }

  html+=`<div class="si-table-wrap">
      <table class="si-table">
        <thead><tr><th>Receipt</th><th>Date</th><th>Time</th><th>SKU</th><th>Item</th><th>Variant</th><th>Qty</th><th>Net Sales</th><th>Profit</th><th>Cashier</th></tr></thead>
        <tbody>`;

  lyRows.forEach(r=>{
    const isRefund = r.receiptType.toLowerCase().includes('refund');
    html+=`<tr${isRefund?' style="background:#FFF5F5"':''}>
      <td>${r.receiptNumber}</td>
      <td class="si-nowrap">${r.date}</td>
      <td class="si-nowrap">${r.time}</td>
      <td><strong>${r.sku}</strong></td>
      <td>${r.item}</td>
      <td>${r.variant||'—'}</td>
      <td>${r.qty}</td>
      <td class="si-num ${isRefund?'si-red':'si-green'}">₱${r.netSales.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td class="si-num si-profit">₱${r.grossProfit.toLocaleString('en-PH',{minimumFractionDigits:2})}</td>
      <td>${r.cashier}</td>
    </tr>`;
  });
  html+=`</tbody></table></div>`;
  area.innerHTML = html;
  document.getElementById('ly-confirm-btn').style.display='block';
  setLyStatus(`✓ ${lyRows.length} line items across ${receipts.length} receipts ready to import.`,'ok');
}

// ── Confirm ───────────────────────────────────────────
async function confirmLyImport(){
  if(!lyRows.length) return;
  const btn = document.getElementById('ly-confirm-btn');
  btn.disabled=true; btn.textContent='Importing…';
  setLyStatus('Sending to Google Sheets…','ok');
  try{
    const r = await api({action:'importLoyverseSales', rows:lyRows, importedBy:currentUser.username});
    if(r.status==='ok'){
      const stockNote = r.stockUpdated > 0 ? ` Stock updated for ${r.stockUpdated} SKU${r.stockUpdated!==1?'s':''}.` : '';
      setLyStatus(`✅ Done — ${r.imported} new rows added, ${r.skipped} duplicate${r.skipped!==1?'s':''} skipped.${stockNote}`,'ok');
      btn.style.display='none'; lyRows=[];
      document.getElementById('ly-file-input').value='';
      document.getElementById('ly-preview-area').innerHTML='';
      // Refresh product list data in background so low-stock badge updates
      if(typeof loadPLData === 'function') loadPLData();
    } else {
      setLyStatus('Import failed: '+(r.msg||'Unknown error'),'error');
      btn.disabled=false; btn.textContent='Confirm & Import';
    }
  }catch(e){
    setLyStatus('Import failed: '+e.message,'error');
    btn.disabled=false; btn.textContent='Confirm & Import';
  }
}

function setLyStatus(msg,type){
  const el=document.getElementById('ly-status'); if(!el) return;
  el.textContent=msg;
  el.className='si-status'+(type==='error'?' si-status-error':type==='ok'?' si-status-ok':'');
}


// ════════════════════════════════════════════════════════
// SHARED UTILITY
// ════════════════════════════════════════════════════════
function parseSiLine(line){
  const result=[]; let current=''; let inQuotes=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ inQuotes=!inQuotes; }
    else if(ch===','&&!inQuotes){ result.push(current.trim()); current=''; }
    else { current+=ch; }
  }
  result.push(current.trim());
  return result;
}

// ══════════════════════════════════════════════════════════════════
// SALES LOG CORRECTIONS — remove duplicated invoice lines, or set the
// pull location on rows imported before location tracking existed.
// Gated on admin OR the per-user "Can Edit Sales Log" permission; the
// server re-checks, so hiding the button is convenience, not security.
// ══════════════════════════════════════════════════════════════════
let _slLines = [];        // last search result
let _slPicked = {};       // rowIndex → true

function _slMayEdit(){
  return !!currentUser && (currentUser.role === 'admin' || currentUser.canEditSalesLog === true);
}

function openSalesLogEditor(){
  if(!_slMayEdit()){ alert('You do not have permission to edit the Sales Log.'); return; }
  _slLines = []; _slPicked = {};
  document.getElementById('sl-query').value = '';
  document.getElementById('sl-results').innerHTML =
    '<div class="sl-hint">Search by invoice number, dealer name, or SKU code.</div>';
  document.getElementById('sl-actions').style.display = 'none';
  document.getElementById('sl-err').textContent = '';
  document.getElementById('saleslog-modal').style.display = 'flex';
  setTimeout(function(){ const q=document.getElementById('sl-query'); if(q) q.focus(); }, 60);
}
function closeSalesLogEditor(){
  document.getElementById('saleslog-modal').style.display = 'none';
  _slLines = []; _slPicked = {};
}

async function searchSalesLog(){
  const q = document.getElementById('sl-query').value.trim();
  const box = document.getElementById('sl-results');
  const err = document.getElementById('sl-err');
  err.textContent = '';
  if(!q){ box.innerHTML = '<div class="sl-hint">Type something to search for.</div>'; return; }
  box.innerHTML = '<div class="sl-hint">Searching…</div>';
  document.getElementById('sl-actions').style.display = 'none';
  try{
    const r = await api({ action:'findSalesLogLines', query:q,
      role: currentUser.role, canEditSalesLog: currentUser.canEditSalesLog === true });
    if(r.status !== 'ok'){ box.innerHTML=''; err.textContent = r.msg || 'Search failed.'; return; }
    _slLines = r.lines || []; _slPicked = {};
    _slRender();
  }catch(e){ box.innerHTML=''; err.textContent = 'Network error: '+e.message; }
}

function _slRender(){
  const box = document.getElementById('sl-results');
  if(!_slLines.length){
    box.innerHTML = '<div class="sl-hint">No matching lines found.</div>';
    document.getElementById('sl-actions').style.display = 'none';
    return;
  }
  // Group by invoice so a duplicated invoice is obvious at a glance
  const byInv = {};
  _slLines.forEach(function(l){ (byInv[l.invoice] = byInv[l.invoice] || []).push(l); });
  box.innerHTML = Object.keys(byInv).sort().map(function(inv){
    const ls = byInv[inv];
    const bags = ls.reduce(function(s,l){ return s + l.qty; }, 0);
    const warn = ls.some(function(l){ return l.stockMode === 'warehouse'; });
    const invJs = inv.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    return '<div class="sl-inv">'
      + '<div class="sl-inv-head">'
        + '<label class="sl-inv-pick"><input type="checkbox" onchange="slPickInvoice(&quot;'
          + _xiEsc(invJs) + '&quot;, this.checked)"> <strong>' + _xiEsc(inv) + '</strong></label>'
        + '<span class="sl-inv-meta">' + ls.length + ' line' + (ls.length!==1?'s':'')
          + ' · ' + bags + ' bags</span>'
      + '</div>'
      + '<div class="sl-inv-sub">' + _xiEsc(ls[0].dealer || '—') + ' · ' + _xiEsc(ls[0].date || '')
        + (ls[0].sourceFile ? ' · from ' + _xiEsc(ls[0].sourceFile) : '')
        + '</div>'
      + (warn ? '<div class="sl-inv-warn">⚠ Imported in Warehouse mode — deleting will add the stock back.</div>' : '')
      + ls.map(function(l){
          return '<label class="sl-line">'
            + '<input type="checkbox" data-row="' + l.rowIndex + '" '
              + (_slPicked[l.rowIndex] ? 'checked ' : '')
              + 'onchange="slPickLine(' + l.rowIndex + ', this.checked)">'
            + '<span class="sl-line-main">' + _xiEsc(l.description || l.skuCode)
              + '<span class="sl-line-sku">' + _xiEsc(l.skuCode) + '</span></span>'
            + '<span class="sl-line-loc">' + (l.location ? _xiEsc(l.location) : '⚠ no location') + '</span>'
            + '<span class="sl-line-qty">' + l.qty + '</span>'
          + '</label>';
        }).join('')
    + '</div>';
  }).join('');
  _slUpdateCount();
}

function slPickLine(rowIndex, on){
  if(on) _slPicked[rowIndex] = true; else delete _slPicked[rowIndex];
  _slUpdateCount();
}
function slPickInvoice(inv, on){
  _slLines.filter(function(l){ return l.invoice === inv; })
    .forEach(function(l){ if(on) _slPicked[l.rowIndex] = true; else delete _slPicked[l.rowIndex]; });
  _slRender();
}
function _slUpdateCount(){
  const n = Object.keys(_slPicked).length;
  const act = document.getElementById('sl-actions');
  act.style.display = n ? 'block' : 'none';
  const picked = _slLines.filter(function(l){ return _slPicked[l.rowIndex]; });
  const bags = picked.reduce(function(s,l){ return s + l.qty; }, 0);
  document.getElementById('sl-sel-count').textContent =
    n + ' line' + (n!==1?'s':'') + ' selected · ' + bags + ' bags';
}

async function applySalesLogLocation(){
  const loc = document.getElementById('sl-set-loc').value;
  const err = document.getElementById('sl-err');
  err.textContent = '';
  if(!loc){ err.textContent = 'Pick a location first.'; return; }
  const rows = Object.keys(_slPicked).map(Number);
  if(!rows.length){ err.textContent = 'Select at least one line.'; return; }
  try{
    const r = await api({ action:'setSalesLogLocation', rowIndexes: rows, location: loc,
      role: currentUser.role, canEditSalesLog: currentUser.canEditSalesLog === true,
      by: currentUser.username });
    if(r.status==='ok'){
      showToast(r.updated + ' line' + (r.updated!==1?'s':'') + ' set to ' + loc, 'success', 4000);
      await searchSalesLog();
    } else err.textContent = r.msg || 'Could not update.';
  }catch(e){ err.textContent = 'Network error: '+e.message; }
}

async function deleteSalesLogSelection(){
  const err = document.getElementById('sl-err');
  err.textContent = '';
  const rows = Object.keys(_slPicked).map(Number);
  if(!rows.length){ err.textContent = 'Select at least one line.'; return; }
  const picked = _slLines.filter(function(l){ return _slPicked[l.rowIndex]; });
  const bags = picked.reduce(function(s,l){ return s + l.qty; }, 0);
  const whs  = picked.filter(function(l){ return l.stockMode === 'warehouse'; });
  const invs = Array.from(new Set(picked.map(function(l){ return l.invoice; })));
  const reason = prompt('DELETE ' + rows.length + ' line' + (rows.length!==1?'s':'')
    + ' (' + bags + ' bags) from ' + invs.join(', ') + '?\n\n'
    + (whs.length ? whs.length + ' of them deducted warehouse stock — that stock will be ADDED BACK.\n\n' : '')
    + 'This cannot be undone. Type a short reason for the record:');
  if(reason === null) return;                      // cancelled
  if(!String(reason).trim()){ err.textContent = 'A reason is required for the audit trail.'; return; }
  try{
    const r = await api({ action:'deleteSalesLogLines', rowIndexes: rows,
      role: currentUser.role, canEditSalesLog: currentUser.canEditSalesLog === true,
      by: currentUser.username, reason: String(reason).trim() });
    if(r.status==='ok'){
      showToast(r.deleted + ' line' + (r.deleted!==1?'s':'') + ' deleted'
        + (r.stockRestoredSkus ? ' · stock restored for ' + r.stockRestoredSkus + ' SKU'
            + (r.stockRestoredSkus!==1?'s':'') : ''), 'success', 5000);
      await searchSalesLog();
    } else err.textContent = r.msg || 'Could not delete.';
  }catch(e){ err.textContent = 'Network error: '+e.message; }
}
