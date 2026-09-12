/**
 * Patch bundle UI KENDALI (hasil Vite, sudah di-minify) untuk V2.7:
 * login username+password (server-side) menggantikan Cloudflare Access.
 *
 *   node scripts/patch-bundle.mjs <input bundle> <output bundle>
 *
 * Setiap patch harus cocok TEPAT SATU kali; jika tidak, skrip gagal (bundle tidak diubah).
 */
import { readFile, writeFile } from "node:fs/promises";

const [, , input, output] = process.argv;
if (!input || !output) throw new Error("Pemakaian: node scripts/patch-bundle.mjs <input> <output>");

let s = await readFile(input, "utf8");

const patches = [
  // 1. Layar sesi ($z): teks, redirect ke /login bila tidak ada sesi, login berdasar username, tunggu data karyawan.
  ['"Memverifikasi identitas Cloudflare Access…"', '"Memverifikasi sesi login…"'],
  [
    'if(!c.ok||!u.ok){i(u.message||"Akses KENDALI belum tersedia untuk email ini."),a(u.email?`Email: ${u.email}`:""),l(!0);return}a(`Masuk sebagai ${u.user?.name||u.email}`);const f=await e(u.email);if(!o)return;',
    'if(c.status===401){window.location.replace("/login");return}if(!c.ok||!u.ok){i(u.message||"Akses KENDALI belum tersedia untuk akun ini."),a(u.username?`Akun: ${u.username}`:""),l(!0);return}a(`Masuk sebagai ${u.user?.name||u.username}`);let f=await e(u.username||u.email);for(let q=0;q<60&&o&&!f.ok&&f.reason==="email";q++)a("Memuat data karyawan dari server…"),await new Promise(z=>setTimeout(z,500)),f=await e(u.username||u.email);if(!o)return;'
  ],
  ['"Email Cloudflare Access belum cocok dengan database karyawan."', '"Akun belum ditemukan di database karyawan. Muat ulang halaman."'],
  ['"Gagal memverifikasi sesi Cloudflare Access. Muat ulang halaman."', '"Gagal memverifikasi sesi login. Muat ulang halaman."'],
  ['n.jsx("a",{className:"k-btn ghost",href:"/cdn-cgi/access/logout",children:"Ganti Email"})', 'n.jsx("a",{className:"k-btn ghost",href:"/api/auth/logout",children:"Login Ulang"})'],
  ['"KENDALI menggunakan satu login: email Cloudflare Access. Username dan password KENDALI tidak lagi diperlukan."', '"Login memakai username dan password KENDALI. Sesi berakhir otomatis setelah 12 jam (30 hari bila \\"ingat saya\\")."'],
  ['children:s?"Akses belum tersedia":"Login otomatis"', 'children:s?"Akses belum tersedia":"Memuat sesi"'],

  // 2. accessLogin (Jv): cocokkan berdasar username ATAU email.
  [
    '_=r.find(C=>String(C.email||"").trim().toLowerCase()===O);if(!_)return{ok:!1,reason:"email"}',
    '_=r.find(C=>String(C.username||"").trim().toLowerCase()===O)||r.find(C=>String(C.email||"").trim().toLowerCase()===O);if(!_)return{ok:!1,reason:"email"}'
  ],

  // 3. Logout: hapus sesi di Worker (bukan Cloudflare Access).
  ['ee=j.useCallback(()=>{N(null);try{window.location.href="/cdn-cgi/access/logout"}catch{}},[])', 'ee=j.useCallback(()=>{N(null);try{sessionStorage.removeItem(gm)}catch{}try{window.location.href="/api/auth/logout"}catch{}},[])'],

  // 4. Form karyawan: field password kembali, email tidak wajib, password wajib untuk akun baru.
  ['c=i.name&&i.username&&i.email&&!o,', 'c=i.name&&i.username&&(r||String(i.password||"").length>=6)&&!o,'],
  ['children:"Akun & Login Cloudflare Access"', 'children:"Akun & Login KENDALI"'],
  [
    'n.jsx("div",{className:"k-note",style:{margin:0},children:"Login memakai email Cloudflare Access. Tidak ada password KENDALI."})',
    'n.jsxs("div",{className:"k-field",children:[n.jsx("label",{children:r?"Password baru (kosongkan bila tidak diubah)":"Password *"}),n.jsx("input",{type:"password",value:i.password||"",onChange:l("password"),placeholder:"min. 6 karakter",autoComplete:"new-password"})]})'
  ],
  [
    'children:"Username internal dapat diubah. Login tetap menggunakan email Cloudflare Access; perubahan username otomatis mengikuti penugasan proyek dan relasi atasan."',
    'children:"Username dipakai untuk login. Perubahan username otomatis mengikuti penugasan proyek dan relasi atasan. Password disimpan sebagai hash; isi hanya bila ingin mengatur ulang."'
  ],

  // 5. Update user (Se): password kosong = pertahankan yang lama.
  ['i(D=>D.map(z=>z.username===O?{...z,..._,username:C}:z.atasan===O?{...z,atasan:C}:z))', 'i(D=>D.map(z=>z.username===O?{...z,..._,password:_.password||z.password||"",username:C}:z.atasan===O?{...z,atasan:C}:z))']
];

for (const [from, to] of patches) {
  const count = s.split(from).length - 1;
  if (count !== 1) throw new Error(`Patch tidak cocok tepat satu kali (${count}x): ${from.slice(0, 80)}…`);
  s = s.replace(from, to);
}

if (s.includes("Cloudflare Access")) {
  const idx = s.indexOf("Cloudflare Access");
  throw new Error(`Masih ada teks "Cloudflare Access" di bundle: …${s.slice(idx - 60, idx + 40)}…`);
}

await writeFile(output, s, "utf8");
console.log(`Bundle dipatch: ${patches.length} perubahan -> ${output}`);
