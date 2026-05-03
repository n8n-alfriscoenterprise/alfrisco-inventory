function openAdminModal(){
  document.getElementById('admin-modal').style.display='flex';
  document.getElementById('admin-pass-input').value='';
  document.getElementById('admin-pass-err').textContent='';
  setTimeout(()=>document.getElementById('admin-pass-input').focus(),100);
}
function closeAdminModal(){document.getElementById('admin-modal').style.display='none';}
function verifyAdmin(){
  const p=document.getElementById('admin-pass-input').value;
  if(currentUser.role==='admin'&&p===currentUser.password){closeAdminModal();showAdmin();}
  else document.getElementById('admin-pass-err').textContent='Incorrect password.';
}

// ── ADMIN SCREEN ──
function showAdmin(){showScreen('admin-screen');renderStaff();renderCs();renderLog();}
function closeAdmin(){
  if(currentUser.role==='driver')showDriver();
  else showApp();
}

// Show/hide unit field based on role selection
function toggleUnitField(){
  const role=document.getElementById('new-role').value;
  document.getElementById('new-unit').style.display=role==='driver'?'block':'none';
}

async function refreshStaff(){
  const btn=document.querySelector('.admin-refresh');
  btn.textContent='Loading...';btn.disabled=true;
  const ok=await loadStaff();
  btn.textContent=ok?'Refreshed ✓':'Failed ✗';
  setTimeout(()=>{btn.textContent='Refresh';btn.disabled=false;},2000);
  renderStaff();
}

function renderStaff(){
  const el=document.getElementById('staff-list');el.innerHTML='';
  if(!staff.length){el.innerHTML='<div class="empty-state">No staff accounts found</div>';return;}
  staff.forEach((s,i)=>{
    const row=document.createElement('div');row.className='staff-row';
    const unitTag=s.role==='driver'&&s.assignedUnit?` · ${s.assignedUnit}`:'';
    const distTag=s.canCountDist===false?'':`<span style="font-size:9px;background:#EDE0F5;color:#7B2D8B;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">DIST</span>`;
    const retailTag=s.canCountRetail===false?'':`<span style="font-size:9px;background:#FFF3DC;color:#C07000;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">RETAIL</span>`;
    const poDTag=s.canManagePODist  ?`<span style="font-size:9px;background:#E0EAF5;color:#1A3A5C;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">PO-D</span>`:'';
    const poRTag=s.canManagePORetail?`<span style="font-size:9px;background:#EAF0FB;color:#283593;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">PO-R</span>`:'';
    const poTag=poDTag+poRTag;
    const saTag=s.canStockAdjust?'<span style="font-size:9px;background:#E0F2F1;color:#004D40;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">📊SA</span>':'';
    const plTag=s.canViewProductList!==false?`<span style="font-size:9px;background:#E8F5E9;color:#1B5E20;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">📋PL</span>`:'';
    const trfTag=s.canTransfer?`<span style="font-size:9px;background:#E8EAF6;color:#283593;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">🔄Trf</span>`:'';
    const prodTag=s.canProduction?`<span style="font-size:9px;background:#E8F5E9;color:#1B5E20;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">🏭Prod</span>`:'';
    const boDistTag=s.canBackorderDist!==false?`<span style="font-size:9px;background:#FCEBEB;color:#A32D2D;padding:1px 6px;border-radius:10px;font-weight:600;margin-right:3px">⚠️BO-Dist</span>`:'';
    const boRetailTag=s.canBackorderRetail?`<span style="font-size:9px;background:#FFF3DC;color:#C07000;padding:1px 6px;border-radius:10px;font-weight:600">🛒BO-Retail</span>`:'';
    row.innerHTML=`
      <div class="staff-info" style="flex:1;min-width:0">
        <div class="staff-name">${s.username}</div>
        <div class="staff-meta" style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:3px">
          <span style="font-size:11px;color:#999">${s.role}${unitTag}</span>
          ${saTag}${plTag}${distTag}${retailTag}${poTag}${trfTag}${prodTag}${boDistTag}${boRetailTag}
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        <button class="staff-edit-btn" onclick="openEditStaff(${i})">Edit</button>
        ${s.username!==currentUser.username?`<button class="staff-del" onclick="removeStaff(${i})">Remove</button>`:''}
      </div>`;
    el.appendChild(row);
  });
}

async function addStaff(){
  const u=document.getElementById('new-username').value.trim();
  const p=document.getElementById('new-password').value;
  const r=document.getElementById('new-role').value;
  const unit=r==='driver'?document.getElementById('new-unit').value:'All';
  const canDist=document.getElementById('new-can-dist').checked;
  const canRetail=document.getElementById('new-can-retail').checked;
  const canPO=document.getElementById('new-can-po').checked;
  const canPL=document.getElementById('new-can-pl')?document.getElementById('new-can-pl').checked:true;
  const canTrf=document.getElementById('new-can-transfer')?document.getElementById('new-can-transfer').checked:false;
  const canPODist=document.getElementById('new-can-po-dist')?document.getElementById('new-can-po-dist').checked:false;
  const canPORetail=document.getElementById('new-can-po-retail')?document.getElementById('new-can-po-retail').checked:false;
  const canProd=document.getElementById('new-can-production')?document.getElementById('new-can-production').checked:false;
  const canBoDist=document.getElementById('new-can-bo-dist')?document.getElementById('new-can-bo-dist').checked:true;
  const canBoRetail=document.getElementById('new-can-bo-retail')?document.getElementById('new-can-bo-retail').checked:false;
  if(!u||!p){alert('Username and password are required.');return;}
  if(staff.find(s=>s.username.toLowerCase()===u.toLowerCase())){alert('Username already exists.');return;}
  try{
    const result=await api({action:'addStaff',username:u,password:p,role:r,assignedUnit:unit,canCountDist:canDist,canCountRetail:canRetail,canManagePODist:canPODist,canManagePORetail:canPORetail,canViewProductList:canPL,canTransfer:canTrf,canProduction:canProd,canBackorderDist:canBoDist,canBackorderRetail:canBoRetail});
    if(result.status==='ok'){
      staff.push({username:u,password:p,role:r,assignedUnit:unit,canCountDist:canDist,canCountRetail:canRetail,canManagePODist:canPODist,canManagePORetail:canPORetail,canViewProductList:canPL,canTransfer:canTrf,canProduction:canProd,canBackorderDist:canBoDist,canBackorderRetail:canBoRetail});
      LS.set('alf_staff_cache',staff);
      document.getElementById('new-username').value='';
      document.getElementById('new-password').value='';
      renderStaff();
      alert(`${u} added (${r}${r==='driver'?' — '+unit:''}). They can log in immediately.`);
    }else{alert('Error: '+(result.msg||'Could not add'));}
  }catch(e){alert('Network error.');}
}

async function removeStaff(i){
  if(!confirm(`Remove ${staff[i].username}?`))return;
  try{
    const r=await api({action:'removeStaff',username:staff[i].username});
    if(r.status==='ok'){staff.splice(i,1);LS.set('alf_staff_cache',staff);renderStaff();}
    else alert('Error: '+(r.msg||'Could not remove'));
  }catch(e){alert('Network error.');}
}

function renderCs(){
  const el=document.getElementById('cs-list');el.innerHTML='';
  Object.keys(csskus).forEach(cat=>{
    const hdr=document.createElement('div');hdr.className='cs-cat-hdr';hdr.textContent=cat;el.appendChild(hdr);
    (csskus[cat]||[]).forEach((s,i)=>{
      const row=document.createElement('div');row.className='cs-row';
      row.innerHTML=`
        <div style="flex:1"><div class="cs-name">${s.name}</div><div class="cs-code">${s.code}</div></div>
        <button class="cs-del" onclick="removeCsSku('${cat}',${i})">Remove</button>`;
      el.appendChild(row);
    });
  });
}

function addCsSku(){
  const code=document.getElementById('cs-code').value.trim();
  const name=document.getElementById('cs-name').value.trim();
  const cat=document.getElementById('cs-cat').value;
  if(!code||!name){alert('Code and name required.');return;}
  if(!csskus[cat])csskus[cat]=[];
  csskus[cat].push({code,name});saveLocal();
  document.getElementById('cs-code').value='';document.getElementById('cs-name').value='';
  renderCs();
}

function removeCsSku(cat,i){
  if(!confirm(`Remove ${csskus[cat][i].name}?`))return;
  csskus[cat].splice(i,1);saveLocal();renderCs();
}

function renderLog(){
  const el=document.getElementById('access-log');el.innerHTML='';
  if(!accessLog.length){el.innerHTML='<div class="empty-state">No submissions yet</div>';return;}
  accessLog.slice(0,20).forEach(e=>{
    const row=document.createElement('div');row.className='log-row';
    row.innerHTML=`<div class="log-who">${e.who}</div><div class="log-what">${e.what}</div><div class="log-when">${e.when}</div>`;
    el.appendChild(row);
  });
}



// ── LIVE SKU MASTER (from Google Sheets) ──
let liveSKUs = [];  // Populated from SKU Master sheet on every load

