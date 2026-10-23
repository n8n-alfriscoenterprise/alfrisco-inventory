// ════════════════════════════════════════════════════════
// LOAD LIST — consolidated "items to load" from Xero invoices,
// split per delivery vehicle. Each order is routed to a van via
// the dealer's Assigned Vehicle (Dealer Directory). The stockman
// can tick items off, override a van for the day, pre-fill the
// LOAD form for one van, and print a per-van checklist.
// ════════════════════════════════════════════════════════
let _llData     = null;   // last fetched payload {items, vehicles, ...}
let _llDate     = '';     // selected invoice date (YYYY-MM-DD)
let _llVehicle  = '';     // active tab: vehicle id | LL_UNASSIGNED | LL_ALL
let _llChecked  = {};     // { vehicle|sku: true } loaded ticks (per tab)
let _llExpanded = {};     // { vehicle|sku: true } breakdown expanded
let _llOverride = {};     // { sku|invoice|dealer: vehicleId } per-day reassignment

const LL_ALL        = '__ALL__';
const LL_UNASSIGNED = '__UNASSIGNED__';

function openLoadList(){
  _llChecked={}; _llExpanded={}; _llOverride={}; _llVehicle='';
  _llDate = (typeof phToday === 'function') ? phToday() : new Date().toISOString().slice(0,10);
  document.getElementById('loadlist-modal').style.display = 'flex';
  loadLoadList();
}
function closeLoadList(){ document.getElementById('loadlist-modal').style.display='none'; }

async function loadLoadList(){
  const body = document.getElementById('ll-body');
  body.innerHTML = '<div class="ll-loading">Loading load list…</div>';
  try{
    const r = await api({ action:'getLoadList', date:_llDate });
    if(r.status === 'ok'){
      _llData = r;
      _llDate = r.date || _llDate;
      _llVehicle = _llDefaultTab();
      renderLoadList();
    } else {
      body.innerHTML = '<div class="ll-empty">Could not load: '+(r.msg||'Unknown error')+'</div>';
    }
  }catch(e){
    body.innerHTML = '<div class="ll-empty">Network error: '+e.message+'</div>';
  }
}
function llChangeDate(v){ if(v){ _llDate=v; loadLoadList(); } }

// Effective vehicle of one order line, honoring any per-day override
function _llLineVehicle(sku, line){
  const k = sku+'|'+line.invoiceNumber+'|'+line.dealer;
  return _llOverride.hasOwnProperty(k) ? _llOverride[k] : (line.vehicle||'');
}

// Build { vehicleId|UNASSIGNED : { sku||location : {skuCode,itemName,location,…} } }
// Keyed on SKU **and** location: the same product sold from the warehouse on one
// invoice and off the retail shelf on another is two different things to pick,
// so it must not collapse into a single line.
function _llAggregate(){
  const agg = {};
  (_llData && _llData.items ? _llData.items : []).forEach(function(it){
    it.lines.forEach(function(l){
      const veh = _llLineVehicle(it.skuCode, l) || LL_UNASSIGNED;
      const loc = l.location || '';
      const key = it.skuCode + '||' + loc;
      if(!agg[veh]) agg[veh] = {};
      if(!agg[veh][key]) agg[veh][key] = {skuCode:it.skuCode, itemName:it.itemName,
        category:it.category||'', location:loc, known:it.known, qty:0, lines:[]};
      agg[veh][key].qty += l.qty;
      agg[veh][key].lines.push(l);
    });
  });
  return agg;
}

// Group items into categories: category names A–Z, and inside each one the
// biggest quantity first so the heaviest stacks get loaded first. Items with
// no category (unknown or deactivated SKUs) collect in one group at the end.
// Shared by the screen and the printout so the two can never drift apart.
const LL_NOCAT = '⚠ Uncategorised';

function _llGroupByCategory(items){
  // Keyed case-insensitively: the master sheet is maintained by hand, so
  // "Dog Food" and "dog food" are the same category and must not split into
  // two headings. The first spelling seen becomes the label.
  const byCat = {};
  (items||[]).forEach(function(it){
    const raw = (it.category && it.category.trim()) ? it.category.trim() : LL_NOCAT;
    const key = raw.toLowerCase();
    if(!byCat[key]) byCat[key] = { label: raw, items: [] };
    byCat[key].items.push(it);
  });
  const keys = Object.keys(byCat).sort(function(a,b){
    const an = byCat[a].label === LL_NOCAT, bn = byCat[b].label === LL_NOCAT;
    if(an) return 1;                      // uncategorised always last
    if(bn) return -1;
    return byCat[a].label.localeCompare(byCat[b].label, undefined, {sensitivity:'base'});
  });
  return keys.map(function(k){
    const list = byCat[k].items.slice().sort(function(x,y){
      if(y.qty !== x.qty) return y.qty - x.qty;              // most to load first
      return x.itemName.localeCompare(y.itemName);           // tie → A–Z, stable
    });
    return { category: byCat[k].label, items: list,
             qty: list.reduce(function(s,i){ return s + i.qty; }, 0) };
  });
}

// Where the stock is pulled from. Warehouse first — it is the main source and
// the bulk of every load, so that pull gets done before anyone walks to the
// shop floor. Untagged lines land in their own group at the end so a missing
// Xero tag is visible rather than silently assumed.
const LL_NOLOC = '⚠ Location not tagged';
const LL_LOC_ORDER = ['Distribution WH', 'Retail Store'];

function _llLocLabel(loc){
  if(loc === 'Distribution WH') return '🏭 From Warehouse';
  if(loc === 'Retail Store')    return '🏪 From Retail Store';
  if(loc === LL_NOLOC)          return LL_NOLOC;
  return '📍 From ' + loc;        // a location we don't know yet
}

// A blank Location almost always means the invoice was imported BEFORE location
// tracking existed — not that it is untagged in Xero. The old wording told the
// user to go and tag it in Xero, which is wrong advice when the tag is already
// there. Name the invoices instead, so it is obvious what to re-export.
function _llNoLocNote(locGrp){
  const invs = {};
  (locGrp.groups||[]).forEach(function(g){
    (g.items||[]).forEach(function(it){
      (it.lines||[]).forEach(function(l){ if(l.invoiceNumber) invs[l.invoiceNumber]=true; });
    });
  });
  const list = Object.keys(invs).sort();
  const shown = list.slice(0,10).join(', ') + (list.length>10 ? ' +'+(list.length-10)+' more' : '');
  return '<div class="ll-loc-note">'
    + 'No pull location recorded for '
    + (list.length ? '<strong>'+_llEscH(shown)+'</strong>' : 'these lines')
    + '. Usually this means the invoice was imported before location tracking was '
    + 'added — the Location may already be set in Xero. Re-export '
    + (list.length===1 ? 'that invoice' : 'those invoices') + ' from Xero and import again '
    + 'to pick up the tag. If it really is blank in Xero, set it there first.'
    + '</div>';
}

function _llEscH(s){
  return String(s==null?'':s).replace(/[&<>"']/g,function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function _llGroupByLocation(items){
  const byLoc = {};
  (items||[]).forEach(function(it){
    const loc = (it.location && it.location.trim()) ? it.location.trim() : LL_NOLOC;
    if(!byLoc[loc]) byLoc[loc] = [];
    byLoc[loc].push(it);
  });
  const names = Object.keys(byLoc).sort(function(a,b){
    if(a === LL_NOLOC) return 1;                       // untagged always last
    if(b === LL_NOLOC) return -1;
    const ai = LL_LOC_ORDER.indexOf(a), bi = LL_LOC_ORDER.indexOf(b);
    if(ai >= 0 && bi >= 0) return ai - bi;             // Warehouse before Retail
    if(ai >= 0) return -1;                             // known before unknown
    if(bi >= 0) return 1;
    return a.localeCompare(b, undefined, {sensitivity:'base'});
  });
  return names.map(function(loc){
    const list = byLoc[loc];
    return { location: loc, label: _llLocLabel(loc),
             groups: _llGroupByCategory(list),
             qty: list.reduce(function(s,i){ return s + i.qty; }, 0),
             count: list.length };
  });
}

function _llVehLabel(id){
  if(id===LL_ALL) return 'All';
  if(id===LL_UNASSIGNED) return 'Unassigned';
  const v = ((_llData&&_llData.vehicles)||[]).find(function(x){return x.id===id;});
  return v ? v.label : id;
}

function _llDefaultTab(){
  const agg = _llAggregate();
  const vehs = (_llData&&_llData.vehicles)||[];
  for(let i=0;i<vehs.length;i++){ if(agg[vehs[i].id] && Object.keys(agg[vehs[i].id]).length) return vehs[i].id; }
  if(agg[LL_UNASSIGNED]) return LL_UNASSIGNED;
  return vehs.length ? vehs[0].id : LL_ALL;
}

function llSetTab(v){ _llVehicle=v; renderLoadList(); }

function renderLoadList(){
  const d=_llData; const body=document.getElementById('ll-body');
  if(!d){ body.innerHTML=''; return; }

  const chips=(d.availableDates||[]).slice(0,8).map(function(dt){
    return '<div class="ll-date-chip'+(dt===_llDate?' active':'')+'" onclick="llChangeDate(\''+dt+'\')">'+_llFmtDate(dt)+'</div>';
  }).join('');
  let html='<div class="ll-controls"><label class="ll-date-label">Invoice date</label>'
    +'<input type="date" class="ll-date-input" value="'+_llDate+'" onchange="llChangeDate(this.value)"></div>'
    +(chips?'<div class="ll-date-chips">'+chips+'</div>':'');

  if(!d.items.length){
    html+='<div class="ll-empty">No invoices found for '+_llFmtDate(_llDate)+'.<br>Import the day’s Xero sales first (Sales Import → Xero), then open this again.</div>';
    body.innerHTML=html; _llUpdateFooter(null); return;
  }

  const agg=_llAggregate();

  // Tabs: every configured vehicle + Unassigned (if any) + All
  const tabs=[];
  (d.vehicles||[]).forEach(function(v){ tabs.push({id:v.id, label:v.label}); });
  if(agg[LL_UNASSIGNED]) tabs.push({id:LL_UNASSIGNED, label:'Unassigned'});
  tabs.push({id:LL_ALL, label:'All'});
  if(!tabs.find(function(t){return t.id===_llVehicle;})) _llVehicle=tabs[0].id;

  html+='<div class="ll-veh-tabs">'+tabs.map(function(t){
    const count = t.id===LL_ALL ? d.items.length : (agg[t.id]?Object.keys(agg[t.id]).length:0);
    const cls = (t.id===_llVehicle?' active':'') + (t.id===LL_UNASSIGNED?' ll-veh-tab-unassigned':'');
    return '<div class="ll-veh-tab'+cls+'" onclick="llSetTab(\''+t.id+'\')">'+t.label
      +'<span class="ll-veh-tab-count">'+count+'</span></div>';
  }).join('')+'</div>';

  const active=_llVehicle;
  let viewItems=[];
  if(active===LL_ALL){
    // Merge across vehicles on the SKU+location key, so an item picked from two
    // different places stays as two lines here too
    const merged={};
    Object.keys(agg).forEach(function(veh){
      Object.keys(agg[veh]).forEach(function(key){
        const e=agg[veh][key];
        if(!merged[key]) merged[key]={skuCode:e.skuCode,itemName:e.itemName,
          category:e.category||'',location:e.location||'',known:e.known,qty:0,lines:[]};
        merged[key].qty+=e.qty;
        e.lines.forEach(function(l){ merged[key].lines.push(l); });
      });
    });
    viewItems=Object.keys(merged).map(function(k){return merged[k];});
  } else {
    viewItems = agg[active] ? Object.keys(agg[active]).map(function(k){return agg[active][k];}) : [];
  }
  viewItems.sort(function(a,b){return a.itemName.localeCompare(b.itemName);});

  const tabBags=viewItems.reduce(function(s,i){return s+i.qty;},0);
  const tabDealers={}, tabInv={};
  viewItems.forEach(function(i){i.lines.forEach(function(l){ if(l.dealer)tabDealers[l.dealer]=true; tabInv[l.invoiceNumber]=true; });});

  html+='<div class="ll-stats">'
    +'<div class="ll-stat"><div class="ll-stat-val">'+tabBags+'</div><div class="ll-stat-lbl">To load</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+viewItems.length+'</div><div class="ll-stat-lbl">Products</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+Object.keys(tabInv).length+'</div><div class="ll-stat-lbl">Invoices</div></div>'
    +'<div class="ll-stat"><div class="ll-stat-val">'+Object.keys(tabDealers).length+'</div><div class="ll-stat-lbl">Dealers</div></div>'
    +'</div>';

  if(active===LL_UNASSIGNED){
    html+='<div class="ll-unassigned-note">These orders have no van assigned. Tag the dealer with a vehicle in the Dealer Directory, or use the ▾ on a line below to assign it for today.</div>';
  }

  if(!viewItems.length){
    html+='<div class="ll-empty">Nothing to load on '+_llVehLabel(active)+' for this date.</div>';
    body.innerHTML=html; _llUpdateFooter(active, agg); return;
  }

  html+='<div class="ll-list">';
  _llGroupByLocation(viewItems).forEach(function(locGrp){
  html+='<div class="ll-loc-head'+(locGrp.location===LL_NOLOC?' ll-loc-nolo':'')+'">'
    +'<span class="ll-loc-name">'+locGrp.label+'</span>'
    +'<span class="ll-loc-qty">'+locGrp.qty+' bag'+(locGrp.qty!==1?'s':'')
      +' · '+locGrp.count+' item'+(locGrp.count!==1?'s':'')+'</span>'
    +'</div>'
    +(locGrp.location===LL_NOLOC ? _llNoLocNote(locGrp) : '');
  locGrp.groups.forEach(function(grp){
  html+='<div class="ll-cat-head'+(grp.category===LL_NOCAT?' ll-cat-nocat':'')+'">'
    +'<span class="ll-cat-name">'+grp.category+'</span>'
    +'<span class="ll-cat-qty">'+grp.qty+' bag'+(grp.qty!==1?'s':'')
      +' · '+grp.items.length+' item'+(grp.items.length!==1?'s':'')+'</span>'
    +'</div>';
  grp.items.forEach(function(it){
    const ck=active+'|'+it.skuCode+'|'+(it.location||'');
    const checked=!!_llChecked[ck];
    const expanded=!!_llExpanded[ck];
    const warn=it.known?'':'<span class="ll-warn-tag">⚠ unknown SKU</span>';
    html+='<div class="ll-item'+(checked?' ll-checked':'')+'">'
      +'<div class="ll-item-main">'
        +'<button class="ll-check" onclick="llToggleCheck(\''+_llEsc(ck)+'\')">'+(checked?'✓':'')+'</button>'
        +'<div class="ll-item-info" onclick="llToggleExpand(\''+_llEsc(ck)+'\')">'
          +'<div class="ll-item-name">'+it.itemName+warn+'</div>'
          +'<div class="ll-item-code">'+it.skuCode+' · '+it.lines.length+' order'+(it.lines.length!==1?'s':'')+' '+(expanded?'▾':'▸')+'</div>'
        +'</div>'
        +'<div class="ll-item-qty">'+it.qty+'<span class="ll-item-qty-unit">bags</span></div>'
      +'</div>';
    if(expanded){
      html+='<div class="ll-breakdown">'+it.lines.map(function(l){
        const lineKey=it.skuCode+'|'+l.invoiceNumber+'|'+l.dealer;
        const eff=_llLineVehicle(it.skuCode,l);
        const opts=['<option value="">Unassigned</option>'].concat((d.vehicles||[]).map(function(v){
          return '<option value="'+v.id+'"'+(eff===v.id?' selected':'')+'>'+v.label+'</option>';
        })).join('');
        return '<div class="ll-bd-row">'
          +'<span class="ll-bd-dealer">'+(l.dealer||'—')+'</span>'
          +'<span class="ll-bd-inv">'+l.invoiceNumber+'</span>'
          +'<span class="ll-bd-qty">'+l.qty+'</span>'
          +'<select class="ll-bd-veh" onchange="llOverrideLine(\''+_llEsc(lineKey)+'\',this.value)">'+opts+'</select>'
          +'</div>';
      }).join('')+'</div>';
    }
    html+='</div>';
  });
  });
  });
  html+='</div>';

  body.innerHTML=html;
  _llUpdateFooter(active, agg);
}

function llToggleCheck(k){ _llChecked[k]=!_llChecked[k]; renderLoadList(); }
function llToggleExpand(k){ _llExpanded[k]=!_llExpanded[k]; renderLoadList(); }
function llOverrideLine(lineKey, veh){ _llOverride[lineKey]=veh; renderLoadList(); }

function _llUpdateFooter(active, agg){
  let total=0, checked=0;
  if(active && active!==LL_ALL){
    // Reuse the aggregate renderLoadList just built — recomputing it here doubled
    // the work on every tick/expand tap
    const t=(agg||_llAggregate())[active]||{};
    total=Object.keys(t).length;
    Object.keys(t).forEach(function(sku){ if(_llChecked[active+'|'+sku]) checked++; });
  }
  const el=document.getElementById('ll-progress');
  if(el) el.textContent = (active && active!==LL_ALL && total) ? (checked+' / '+total+' on '+_llVehLabel(active)) : '';
  const isRealVeh = active && active!==LL_ALL && active!==LL_UNASSIGNED;
  const pf=document.getElementById('ll-prefill-btn');
  if(pf){ pf.disabled=!isRealVeh; pf.textContent = isRealVeh ? '⬇ Pre-fill '+_llVehLabel(active) : '⬇ Pre-fill LOAD'; }
  const pr=document.getElementById('ll-print-btn');
  if(pr) pr.disabled = !(active && _llData && _llData.items.length);
}

// Pre-fill the LOAD movement form for the ACTIVE vehicle tab.
// DELTA-AWARE: LOAD submissions are additive (each one deducts warehouse stock and
// adds to the manifest), so this checks what's ALREADY been loaded on the van today
// and fills only the remaining balance — safe to tap any number of times per day.
async function llPrefillLoad(){
  const d=_llData; if(!d) return;
  const active=_llVehicle;
  if(active===LL_ALL || active===LL_UNASSIGNED){
    alert('Pick a specific vehicle tab first — "All" and "Unassigned" can’t be loaded onto one van.');
    return;
  }
  const tab=_llAggregate()[active]||{};
  const skus=Object.keys(tab);
  if(!skus.length){ alert('Nothing to load on '+_llVehLabel(active)+' for this date.'); return; }

  // What's already on this van today (summed LOAD movements)
  const pf=document.getElementById('ll-prefill-btn');
  const pfOrig=pf?pf.textContent:'';
  if(pf){ pf.disabled=true; pf.textContent='⏳ Checking van…'; }
  let loadedToday={}, otsOnBoard=0, checkOk=false;
  try{
    const lr=await api({action:'getTodayLoads', unit: active});
    if(lr.status==='ok'){
      (lr.rows||[]).forEach(function(r){
        // Count only INVOICE loads against invoice requirements — bags loaded as
        // OTS EXTRA are free stock for on-the-spot selling, not delivery cover.
        // (Older backend without the split falls back to total loaded.)
        loadedToday[r.code]=Number(r.invoicedLoaded!=null?r.invoicedLoaded:r.loaded)||0;
        otsOnBoard += Number(r.otsExtra)||0;
      });
      checkOk=true;
    }
  }catch(e){ /* offline — fall through, warn below */ }
  if(pf){ pf.disabled=false; pf.textContent=pfOrig; }

  const distCodes={};
  (typeof liveSKUs!=='undefined'?liveSKUs:[]).filter(function(s){return s.type==='DIST';})
    .forEach(function(s){ distCodes[s.code]=s; });

  // Split: fill only the still-missing balance per SKU
  const matched=[], skipped=[], alreadyFull=[];
  let alreadyBags=0;
  skus.forEach(function(sku){
    const it=tab[sku];
    if(!distCodes[sku]){ skipped.push(it); return; }
    const already=loadedToday[sku]||0;
    alreadyBags+=Math.min(already, it.qty);
    const delta=Math.max(0, it.qty-already);
    if(delta<=0){ alreadyFull.push(it); return; }
    matched.push({skuCode:sku, qty:delta});
  });

  if(!matched.length && !alreadyFull.length){
    alert('None of these SKUs match your Distribution SKU Master, so the LOAD form can’t be filled.');
    return;
  }
  if(!matched.length){
    alert('Everything on this list is already loaded on '+_llVehLabel(active)+' today — nothing left to fill.\n\nOnly enter additional bags manually if the van is taking extra stock.');
    return;
  }

  const bags=matched.reduce(function(s,i){return s+i.qty;},0);
  let msg='Fill the LOAD form for '+_llVehLabel(active)+' with '+matched.length+' item(s) totalling '+bags+' bags?';
  if(!checkOk){
    msg+='\n\n⚠ Could not check what’s already loaded today — these are the FULL invoice amounts. If you already loaded this van today, cancel and enter only the additional bags manually.';
  } else if(alreadyBags>0){
    msg+='\n\nAlready loaded on '+_llVehLabel(active)+' today: '+alreadyBags+' bag(s)'
      +(alreadyFull.length?' ('+alreadyFull.length+' item(s) fully loaded — skipped)':'')
      +'.\nFilling only what’s still missing.';
  }
  if(checkOk && otsOnBoard>0){
    msg+='\n\n🟢 Also on board: '+otsOnBoard+' bag(s) loaded as OTS extras — free for on-the-spot selling, not counted against invoices.';
  }
  if(skipped.length) msg+='\n\n'+skipped.length+' skipped (not in SKU Master): '+skipped.map(function(i){return i.skuCode;}).join(', ');
  msg+='\n\nThis sets the unit to '+_llVehLabel(active)+', clears the form, and fills Loaded quantities — review against the van before submitting.';
  if(!confirm(msg)) return;

  // Point the unit selector at this vehicle (add the option if a new van isn't listed yet)
  const unitSel=document.getElementById('unit-select');
  if(unitSel){
    if(!Array.prototype.some.call(unitSel.options,function(o){return o.value===active;})){
      const opt=document.createElement('option'); opt.value=active; opt.textContent=_llVehLabel(active); unitSel.appendChild(opt);
    }
    unitSel.value=active;
    unitSel.dataset.lastUnit=active; // prevent onUnitChange's "switch unit" confirm later
  }

  // Force DIST + LOAD mode
  if(typeof isReturnMode!=='undefined' && isReturnMode){
    isReturnMode=false;
    const mb=document.getElementById('mode-btn'); if(mb){mb.textContent='LOAD';mb.className='mode-btn';}
    const sb=document.getElementById('submit-btn'); if(sb){sb.className='submit-btn';sb.textContent='Submit to Google Sheets';}
  }
  if(typeof currentTab!=='undefined') currentTab='dist';
  if(typeof currentCat!=='undefined') currentCat='All';
  const movTabs=document.querySelectorAll('#movement-area .tab');
  if(movTabs.length){ movTabs.forEach(function(t){t.classList.remove('active');}); movTabs[0].classList.add('active'); }

  // One van at a time — clear then set this van's INV quantities. The stockman
  // types any OTS extras into the separate OTS field on the load form; those get
  // logged as tagged rows at submit, so a re-pre-fill never counts extras against
  // invoice requirements.
  Object.keys(quantities).forEach(function(k){ delete quantities[k]; });
  matched.forEach(function(it){
    const cat=(distCodes[it.skuCode]||{}).category||'';
    quantities[it.skuCode]={inv:it.qty, ots:0, returned:0, cat:cat};
  });

  if(typeof buildTab==='function') buildTab();
  else { if(typeof buildSkuList==='function') buildSkuList(); if(typeof updateTotals==='function') updateTotals(); }

  closeLoadList();
  if(typeof showToast==='function')
    showToast(_llVehLabel(active)+': '+matched.length+' item(s) filled'
      +(alreadyBags>0?' (remaining balance only)':'')+' — review & submit','success',4500);
}

// Print the ACTIVE vehicle tab's checklist on the 58mm receipt printer
function llPrintLoadList(){
  const d=_llData; if(!d || !d.items.length) return;
  const active=_llVehicle;
  const agg=_llAggregate();
  let items;
  if(active===LL_ALL){
    const merged={};
    Object.keys(agg).forEach(function(veh){ Object.keys(agg[veh]).forEach(function(key){
      const e=agg[veh][key];
      if(!merged[key]) merged[key]={skuCode:e.skuCode,itemName:e.itemName,
        category:e.category||'',location:e.location||'',qty:0};
      merged[key].qty+=e.qty;
    }); });
    items=Object.keys(merged).map(function(k){return merged[k];});
  } else {
    const t=agg[active]||{};
    items=Object.keys(t).map(function(k){return {skuCode:t[k].skuCode,itemName:t[k].itemName,
      category:t[k].category||'',location:t[k].location||'',qty:t[k].qty};});
  }
  if(!items.length){ alert('Nothing to load on '+_llVehLabel(active)+' for this date.'); return; }

  const pv=document.getElementById('inv-print-view');
  if(!pv){ alert('Printer view not available on this screen.'); return; }
  // Same grouping as the screen, so the paper matches what was ticked off:
  // pull location first (warehouse before retail), then category inside it
  const rows=_llGroupByLocation(items).map(function(locGrp){
    return '<div class="rcp-loc-head">'+locGrp.label.replace(/^[^A-Za-z⚠]+/,'').toUpperCase()
      +' — '+locGrp.qty+'</div>'
      + locGrp.groups.map(function(grp){
        return '<div class="rcp-cat-head">'+grp.category.toUpperCase()
          +' — '+grp.qty+'</div>'
          + grp.items.map(function(it){
            return '<div class="rcp-row" style="align-items:flex-start;gap:8px">'
              +'<span style="flex:1">☐ '+it.itemName+'<br><span class="rcp-sku">'+it.skuCode+'</span></span>'
              +'<span style="font-weight:700;font-size:14px;white-space:nowrap">'+it.qty+'</span></div>';
          }).join('');
      }).join('');
  }).join('');
  const logo=(typeof LOGO_SMALL!=='undefined'&&LOGO_SMALL)
    ?'<img src="'+LOGO_SMALL+'" style="display:block;margin:0 auto 4px;height:48px;width:48px;object-fit:contain;border-radius:6px">':'';
  const totalBags=items.reduce(function(s,i){return s+i.qty;},0);
  pv.innerHTML='<div class="rcp-wrap">'+logo
    +'<div class="rcp-biz-name">ALFRISCO ENTERPRISE</div>'
    +'<div class="rcp-biz-sub">Load List — '+_llVehLabel(active)+'</div>'
    +'<div class="rcp-div"></div>'
    +'<div class="rcp-row"><span>Inv. Date</span><span>'+_llFmtDate(d.date)+'</span></div>'
    +'<div class="rcp-row"><span>Vehicle</span><span>'+_llVehLabel(active)+'</span></div>'
    +'<div class="rcp-row"><span>Products</span><span>'+items.length+'</span></div>'
    +'<div class="rcp-row"><span>Total Bags</span><span>'+totalBags+'</span></div>'
    +'<div class="rcp-div"></div><div class="rcp-section-label">Items to Load</div>'+rows
    +'<div class="rcp-div"></div>'
    +'<div style="font-size:10px;margin-top:8px">Loaded by: ____________________</div>'
    +'<div style="font-size:10px;margin-top:10px">Checked by: ___________________</div>'
    +'<div class="rcp-footer">— Alfrisco Enterprise —</div></div>';
  window.print();
}

function _llFmtDate(s){
  if(!s) return '—';
  if(typeof phDate === 'function'){ const x=phDate(s); if(x && x!=='—') return x; }
  return s;
}
function _llEsc(s){ return String(s).replace(/'/g, "\\'"); }
