// ── NAVIGATION ──
function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Persist last screen so refresh restores it
  if(currentUser && id !== 'login-screen'){
    const session = LS.get('alf_session') || {};
    session.lastScreen = id;
    LS.set('alf_session', session);
  }
}

// ── STAFF / ADMIN APP ──
// ── PRIMARY ENTRY AFTER LOGIN ──
function showApp(){
  if(currentUser.role==='driver') showDriver();
  else showHome();
}

function showHome(){
  showScreen('home-screen');
  updateFabVisibility();
  document.getElementById('home-topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  const canPO=(currentUser.role==='admin'
    || currentUser.canManagePODist===true
    || currentUser.canManagePORetail===true)
    && currentUser.role!=='driver';
  const isAdmin=currentUser.role==='admin';
  const hpo=document.getElementById('home-po-nav');
  const hadm=document.getElementById('home-admin-nav');
  if(hpo)hpo.style.display=canPO?'block':'none';
  if(hadm)hadm.style.display=isAdmin?'block':'none';
  const h=new Date().getHours();
  const greet=h<12?'Good morning':h<17?'Good afternoon':'Good evening';
  document.getElementById('home-greeting').textContent=greet+', '+currentUser.username;
  buildHomeTiles();
}

function buildHomeTiles(){
  const grid=document.getElementById('home-tiles');
  if(!grid)return;
  grid.innerHTML='';
  const tiles=[];
  // 0. Product List — always visible if canViewProductList
  const canPL = currentUser.role==='admin' || currentUser.canViewProductList===true;
  if(canPL) tiles.push({icon:'📋',name:'Product List',desc:'Item prices & current stock levels',cls:'t-product',fn:'openPL()'});
  // 1. Stock Movement — always visible
  tiles.push({icon:'📦',name:'Stock Movement',desc:'Load & return stocks for Bajaj routes',cls:'t-movement',fn:'showMovement()'});
  // 2. Transfer
  const canTrfTile=currentUser.role==='admin'||currentUser.canTransfer===true;
  if(canTrfTile) tiles.push({icon:'🔄',name:'Transfer',desc:'Move stock between warehouse, store & Bajaj',cls:'t-transfer',fn:'openTransfer()'});
  // 3. Purchase Orders
  const canPODist   = currentUser.role==='admin' || currentUser.canManagePODist===true;
  const canPORetail = currentUser.role==='admin' || currentUser.canManagePORetail===true;
  const canAnyPO    = canPODist || canPORetail;
  if(canAnyPO) tiles.push({icon:'📋',name:'Purchase Orders',desc:'Create, approve & receive supplier orders',cls:'t-po',fn:'openPO()',badge:'po-pending-badge'});
  // 4. General Inventory
  const canCount=currentUser.canCountDist!==false||currentUser.canCountRetail!==false;
  if(canCount) tiles.push({icon:'🔢',name:'General Inventory',desc:'Physical count for Distribution or Retail',cls:'t-inventory',fn:'openCount()'});
  const canSATile = currentUser.role==='admin' || currentUser.canStockAdjust===true;
  if(canSATile) tiles.push({icon:'📊',name:'Stock Adjustment',desc:'Receive, count, remove or record damage',cls:'t-sa',fn:'openSA()'});
  // 5. Dealer Backorder
  tiles.push({icon:'⚠️',name:'Dealer Backorder',desc:'Record out-of-stock distribution dealer requests',cls:'t-backorder',fn:'openBoModal()'});
  // 6. Retail Backorder
  if(currentUser.canBackorderRetail===true||currentUser.role==='admin')
    tiles.push({icon:'🛒',name:'Retail Backorder',desc:'Record retail customer out-of-stock requests',cls:'t-retail-bo',fn:'openRboModal()'});
  // 7. Production
  const canProdTile=currentUser.role==='admin'||currentUser.canProduction===true||currentUser.role==='staff-retail';
  if(canProdTile) tiles.push({icon:'🏭',name:'Production',desc:'Convert bags to smaller retail units',cls:'t-prod',fn:'openProduction()'});
  // 8. Admin
  if(currentUser.role==='admin') tiles.push({icon:'⚙️',name:'Admin',desc:'Staff accounts & app settings',cls:'t-admin',fn:'openAdminFromHome()'});
  if(tiles.length%2!==0) tiles[tiles.length-1].full=true;
  tiles.forEach(t=>{
    const div=document.createElement('div');
    div.className='tile '+t.cls+(t.full?' full-width':'');
    div.onclick=new Function(t.fn);
    div.innerHTML=`<span class="tile-icon">${t.icon}</span><div class="tile-name">${t.name}</div><div class="tile-desc">${t.desc}</div><span class="tile-arrow">→</span>${t.badge?'<span class="tile-badge" id="'+t.badge+'" style="display:none">!</span>':''}`;
    grid.appendChild(div);
  });
  if(currentUser.role==='admin') loadPendingBadge();
}

function showMovement(){
  showScreen('app-screen');
  updateFabVisibility();
  document.getElementById('topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  const canPO=currentUser.role==='admin'
    || currentUser.canManagePODist===true
    || currentUser.canManagePORetail===true;
  const isAdmin=currentUser.role==='admin';
  if(document.getElementById('tnav-po')) document.getElementById('tnav-po').style.display=canPO?'block':'none';
  if(document.getElementById('tnav-admin')) document.getElementById('tnav-admin').style.display=isAdmin?'block':'none';
  document.getElementById('movement-area').style.display='block';
  document.getElementById('mode-btn').style.display='flex';
  isReturnMode=false;
  document.getElementById('mode-btn').textContent='LOAD';
  document.getElementById('mode-btn').className='mode-btn';
  document.getElementById('submit-btn').className='submit-btn';
  document.getElementById('submit-btn').textContent='Submit to Google Sheets';
  setTNav('tnav-movement');
  quantities={};currentTab='dist';currentCat='All';
  document.querySelectorAll('#movement-area .tab').forEach(t=>t.classList.remove('active'));
  const ft=document.querySelector('#movement-area .tab');
  if(ft)ft.classList.add('active');
  buildTab();
  // Initialize unit tracking
  const sel = document.getElementById('unit-select');
  if(sel) sel.dataset.lastUnit = sel.value;
}

function setTNav(activeId){
  document.querySelectorAll('#app-screen .tnav').forEach(b=>b.classList.remove('active'));
  const el=document.getElementById(activeId);
  if(el)el.classList.add('active');
}

function openAdminFromHome(){
  showScreen('app-screen');
  document.querySelector('.fab').style.display='flex';
  document.getElementById('topbar-user').textContent=`${currentUser.username} · ${currentUser.role}`;
  document.getElementById('movement-area').style.display='none';
  document.getElementById('mode-btn').style.display='none';
  if(document.getElementById('tnav-po')) document.getElementById('tnav-po').style.display=(_canAnyPO)?'block':'none';
  if(document.getElementById('tnav-admin')) document.getElementById('tnav-admin').style.display='block';
  setTNav('tnav-admin');
  openAdminModal();
}

function setTab(tab,el){
  currentTab=tab;currentCat='All';
  document.querySelectorAll('#app-screen .tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');buildTab();
}
