/**
 * Halaman HTML yang dirender Worker (di luar bundle React):
 *   /login           — form username + password
 *   /ganti-password  — ubah password sendiri (butuh sesi)
 * Memakai CSS bundle KENDALI (kelas k-login, k-field, k-btn, dst).
 */

const CSS_HREF = "/assets/index-C05QfQjW.css";

function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function shell({ title, heading, body, hint, script }) {
  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} — KENDALI</title>
<link rel="stylesheet" href="${CSS_HREF}">
<style>
  body{margin:0}
  .k-root{min-height:100vh}
  .k-loginBody form{display:flex;flex-direction:column;gap:12px}
  .k-loginBody .k-btn{width:100%;padding:11px}
  .k-loginBody .row{display:flex;align-items:center;gap:8px;font-size:12.5px;color:var(--muted)}
  .k-loginBody .row input{width:auto}
  .k-loginBody a{color:var(--muted);font-size:12px}
  .k-ok{background:var(--aman-bg,#e6f4ea);color:var(--aman,#1e7b3a);font-size:12.5px;padding:8px 11px;border-radius:8px}
</style>
</head>
<body>
<div class="k-root"><div class="k-login">
  <div class="k-loginCard">
    <div class="k-loginBrand">
      <div class="logo"><span class="mark"></span>KENDALI</div>
      <div class="sub">Project Control · Natara Konstruksi</div>
    </div>
    <div class="k-loginBody">
      <div style="font-size:15px;font-weight:700">${esc(heading)}</div>
      ${body}
    </div>
  </div>
  <div class="k-loginHint">${hint}</div>
</div></div>
<script>${script}</script>
</body>
</html>`;
}

export function loginPage({ error = "", username = "" } = {}) {
  const body = `
      ${error ? `<div class="k-loginErr" id="err">${esc(error)}</div>` : `<div class="k-loginErr" id="err" hidden></div>`}
      <form method="post" action="/api/auth/login" id="f" autocomplete="on">
        <input type="hidden" name="redirect" value="1">
        <div class="k-field">
          <label for="u">Username</label>
          <input id="u" name="username" value="${esc(username)}" autocomplete="username" autocapitalize="none" spellcheck="false" required autofocus>
        </div>
        <div class="k-field">
          <label for="p">Password</label>
          <input id="p" name="password" type="password" autocomplete="current-password" required>
        </div>
        <label class="row"><input type="checkbox" name="remember" value="1"> Ingat saya di perangkat ini (30 hari)</label>
        <button class="k-btn" type="submit" id="btn">Masuk</button>
      </form>`;
  const script = `
(function(){
  try{sessionStorage.removeItem('kendali_session_v1')}catch(e){}
  var f=document.getElementById('f'),err=document.getElementById('err'),btn=document.getElementById('btn');
  f.addEventListener('submit',async function(ev){
    ev.preventDefault(); btn.disabled=true; btn.textContent='Memverifikasi…'; err.hidden=true;
    try{
      var r=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({username:f.username.value,password:f.password.value,remember:f.remember.checked})});
      var d=await r.json().catch(function(){return {}});
      if(r.ok&&d.ok){window.location.replace(d.landing_url||'/');return;}
      err.textContent=d.message||'Login gagal.'; err.hidden=false;
    }catch(e){err.textContent='Tidak dapat menghubungi server.'; err.hidden=false;}
    btn.disabled=false; btn.textContent='Masuk';
  });
})();`;
  return shell({
    title: "Login",
    heading: "Masuk ke KENDALI",
    body,
    hint: "Gunakan username dan password KENDALI Anda. Lupa password? Hubungi Administrator.",
    script
  });
}

export function changePasswordPage({ user, message = "", ok = false } = {}) {
  const body = `
      <div class="k-note" style="margin:0">Akun: <b>${esc(user?.name || user?.username || "")}</b> (${esc(user?.username || "")})</div>
      ${message ? `<div class="${ok ? "k-ok" : "k-loginErr"}" id="err">${esc(message)}</div>` : `<div class="k-loginErr" id="err" hidden></div>`}
      <form id="f" autocomplete="on">
        <div class="k-field">
          <label for="o">Password saat ini</label>
          <input id="o" name="oldPassword" type="password" autocomplete="current-password" required>
        </div>
        <div class="k-field">
          <label for="n">Password baru (min. 6 karakter)</label>
          <input id="n" name="newPassword" type="password" autocomplete="new-password" minlength="6" required>
        </div>
        <div class="k-field">
          <label for="c">Ulangi password baru</label>
          <input id="c" name="confirm" type="password" autocomplete="new-password" minlength="6" required>
        </div>
        <button class="k-btn" type="submit" id="btn">Simpan Password</button>
        <a href="/">← Kembali ke KENDALI</a>
      </form>`;
  const script = `
(function(){
  var f=document.getElementById('f'),err=document.getElementById('err'),btn=document.getElementById('btn');
  f.addEventListener('submit',async function(ev){
    ev.preventDefault(); err.hidden=true; err.className='k-loginErr';
    if(f.newPassword.value!==f.confirm.value){err.textContent='Password baru tidak sama.';err.hidden=false;return;}
    btn.disabled=true;
    try{
      var r=await fetch('/api/auth/change-password',{method:'POST',headers:{'content-type':'application/json'},credentials:'same-origin',
        body:JSON.stringify({oldPassword:f.oldPassword.value,newPassword:f.newPassword.value})});
      var d=await r.json().catch(function(){return {}});
      err.textContent=d.message||(r.ok?'Password diperbarui.':'Gagal.'); err.className=(r.ok&&d.ok)?'k-ok':'k-loginErr'; err.hidden=false;
      if(r.ok&&d.ok){f.reset();}
    }catch(e){err.textContent='Tidak dapat menghubungi server.';err.hidden=false;}
    btn.disabled=false;
  });
})();`;
  return shell({
    title: "Ganti Password",
    heading: "Ganti Password",
    body,
    hint: "Password disimpan dalam bentuk hash. Administrator dapat mengatur ulang password dari menu Karyawan & Org.",
    script
  });
}
