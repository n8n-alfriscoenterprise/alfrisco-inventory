function updateFabVisibility(){
  const fabDist = document.getElementById('fab-dist');
  const fabRetail = document.getElementById('fab-retail');
  if(!fabDist) return;
  const isAdmin = currentUser && currentUser.role === 'admin';
  const canDist = isAdmin || (currentUser && currentUser.canBackorderDist !== false);
  const canRetail = isAdmin || (currentUser && currentUser.canBackorderRetail === true);
  if(canDist){
    fabDist.style.display = 'flex';
    fabDist.style.bottom = canRetail ? '90px' : '90px';
  } else {
    fabDist.style.display = 'none';
  }
  if(canRetail){
    fabRetail.style.display = 'flex';
    fabRetail.style.bottom = canDist ? '152px' : '90px';
  } else {
    fabRetail.style.display = 'none';
  }
}

// ── FAB TOUCH — full opacity on touch for mobile ──
document.addEventListener('DOMContentLoaded', () => {
  ['fab-dist','fab-retail'].forEach(id => {
    const fab = document.getElementById(id);
    if(!fab) return;
    fab.addEventListener('touchstart', () => {
      fab.style.opacity = '1';
    }, {passive:true});
    fab.addEventListener('touchend', () => {
      setTimeout(() => { if(fab.style.display !== 'none') fab.style.opacity = '0.25'; }, 2000);
    }, {passive:true});
  });
});


// ════════════════════════════════════════════════════════
// STAFF PERMISSION EDITOR
// ════════════════════════════════════════════════════════
let editingStaffIndex = -1;

function openEditStaff(idx){
  const s = staff[idx];
  if(!s) return;
  editingStaffIndex = idx;

  // Populate fields
  document.getElementById('edit-staff-username-label').textContent = '@' + s.username;
  document.getElementById('edit-role').value = s.role || 'staff';
  document.getElementById('edit-unit').value = s.assignedUnit || 'Bajaj1';
  onEditRoleChange();

  // Permissions — admin gets all locked ON, others use stored values
  const isAdmin = s.role === 'admin';
  const perms = [
    ['edit-can-pl',          isAdmin || s.canViewProductList === true],
    ['edit-can-sa',          isAdmin || s.canStockAdjust === true],
    ['edit-can-count-dist',  isAdmin || s.canCountDist !== false],
    ['edit-can-count-retail',isAdmin || s.canCountRetail !== false],
    ['edit-can-po-dist',     isAdmin || s.canManagePODist===true],
    ['edit-can-po-retail',   isAdmin || s.canManagePORetail===true],
    ['edit-can-transfer',    isAdmin || s.canTransfer === true],
    ['edit-can-production',  isAdmin || s.canProduction === true ||
                             s.role === 'staff-retail'],
    ['edit-can-bo-dist',     isAdmin || s.canBackorderDist !== false],
    ['edit-can-bo-retail',   isAdmin || s.canBackorderRetail === true],
  ];
  perms.forEach(([id, val]) => {
    const el = document.getElementById(id);
    if(el){ el.checked = val; el.disabled = isAdmin; }
  });

  document.getElementById('edit-staff-err').textContent = '';
  document.getElementById('edit-save-btn').disabled = false;
  document.getElementById('edit-save-btn').textContent = 'Save Changes';
  document.getElementById('staff-edit-modal').style.display = 'flex';
}

function closeEditStaff(){
  document.getElementById('staff-edit-modal').style.display = 'none';
  editingStaffIndex = -1;
}

function onEditRoleChange(){
  const role = document.getElementById('edit-role').value;
  const unitField = document.getElementById('edit-unit-field');
  unitField.style.display = role === 'driver' ? 'block' : 'none';

  // If admin selected — auto-check all permissions and disable toggles
  const isAdmin = role === 'admin';
  ['edit-can-pl','edit-can-sa','edit-can-count-dist','edit-can-count-retail',
   'edit-can-po-dist','edit-can-po-retail',
   'edit-can-transfer','edit-can-production',
   'edit-can-bo-dist','edit-can-bo-retail'].forEach(id => {
    const el = document.getElementById(id);
    if(el){ if(isAdmin) el.checked = true; el.disabled = isAdmin; }
  });
}

async function saveStaffEdit(){
  if(editingStaffIndex < 0) return;
  const s   = staff[editingStaffIndex];
  const errEl = document.getElementById('edit-staff-err');
  const btn   = document.getElementById('edit-save-btn');

  const role = document.getElementById('edit-role').value;
  const unit = role === 'driver'
    ? document.getElementById('edit-unit').value
    : 'All';

  // Self-demotion guard
  if(s.username === currentUser.username && role !== 'admin'){
    errEl.textContent = 'You cannot change your own role.'; return;
  }

  // ── PERMISSION MAP — add new permissions here only ──
  // Format: { apiKey: 'edit-checkbox-id' }
  // apiKey  = what gets sent to updateStaff in Apps Script
  // checkbox = the id of the toggle in the edit modal
  const PERM_MAP = [
    { key:'canCountDist',      id:'edit-can-count-dist'  },
    { key:'canCountRetail',    id:'edit-can-count-retail' },
    { key:'canManagePODist',   id:'edit-can-po-dist'      },
    { key:'canManagePORetail', id:'edit-can-po-retail'    },
    { key:'canTransfer',       id:'edit-can-transfer'     },
    { key:'canProduction',     id:'edit-can-production'   },
    { key:'canBackorderDist',  id:'edit-can-bo-dist'      },
    { key:'canBackorderRetail',id:'edit-can-bo-retail'    },
    { key:'canViewProductList',id:'edit-can-pl'           },
    { key:'canStockAdjust',    id:'edit-can-sa'           },
  ];

  // Collect all permission values from checkboxes
  const perms = {};
  PERM_MAP.forEach(function(p){
    const el = document.getElementById(p.id);
    perms[p.key] = el ? el.checked : false;
  });

  btn.disabled = true; btn.textContent = 'Saving...';
  errEl.textContent = '';

  try{
    const r = await api(Object.assign(
      { action:'updateStaff', username:s.username, role, assignedUnit:unit },
      perms
    ));

    if(r.status === 'ok'){
      // Update local cache — merge new values over existing account
      staff[editingStaffIndex] = Object.assign({}, s,
        { role, assignedUnit:unit }, perms
      );
      LS.set('alf_staff_cache', staff);
      closeEditStaff();
      renderStaff();
      // Flash success banner in admin body
      const adminBody = document.querySelector('.admin-body');
      if(adminBody){
        const flash = document.createElement('div');
        flash.style.cssText = 'background:#0A5C46;color:white;padding:9px 14px;'
          + 'font-size:12px;font-weight:600;text-align:center;border-radius:8px;margin-bottom:8px';
        flash.textContent = s.username + ' permissions updated ✓';
        adminBody.insertBefore(flash, adminBody.firstChild);
        setTimeout(function(){ flash.remove(); }, 4000);
      }
    } else {
      errEl.textContent = 'Error: ' + (r.msg || 'Could not save');
      btn.disabled = false; btn.textContent = 'Save Changes';
    }
  } catch(e){
    errEl.textContent = 'Network error: ' + e.message;
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

