// ── KEYBOARD ──
document.getElementById('login-pass').addEventListener('keydown',e=>{if(e.key==='Enter')doLogin();});
document.getElementById('admin-pass-input').addEventListener('keydown',e=>{if(e.key==='Enter')verifyAdmin();});
document.getElementById('deliver-qty').addEventListener('keydown',e=>{if(e.key==='Enter')confirmDelivery();});

// ── START ──
init();
