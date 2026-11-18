// V3.4.40 — Smoke: login dari Sipatuo (portal grup).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
const worker = fs.readFileSync(path.join(root, 'src/worker.js'), 'utf8');
const cfg = fs.readFileSync(path.join(root, 'wrangler.jsonc'), 'utf8');
const mig = fs.readFileSync(path.join(root, 'migrations/0024_sipatuo_sso.sql'), 'utf8');
const must = (c, m) => { if (!c) throw new Error(`Sipatuo SSO: ${m}`); };
const a = worker.indexOf('// ---- SIPATUO-SSO-VERIFY:START'), z = worker.indexOf('// ---- SIPATUO-SSO-VERIFY:END');
must(a > 0 && z > a, 'blok verifikasi tiket tidak ditemukan');
const { verifikasiTiketSipatuo } = await import('data:text/javascript,' + encodeURIComponent(worker.slice(a, z) + '\nexport { verifikasiTiketSipatuo };'));

must(worker.includes('if (path === "/sso" && request.method === "GET") return sipatuoSsoHandler(request,env);'), 'rute /sso belum ada');
must(worker.indexOf('return sipatuoSsoHandler') < worker.indexOf('const auth = await authenticate(request,env);'), 'rute /sso harus sebelum autentikasi sesi');
must(worker.includes('INSERT INTO sso_tiket_terpakai'), 'tiket belum dicatat sekali pakai');
must(worker.includes('"LOGIN_SSO"'), 'audit LOGIN_SSO belum ada');
must(!/sipatuoSsoHandler[\s\S]{0,4000}INSERT INTO app_records/.test(worker.slice(worker.indexOf('async function sipatuoSsoHandler'), worker.indexOf('async function logoutHandler'))), 'SSO tidak boleh membuat akun baru');
must(worker.includes('DELETE FROM sso_tiket_terpakai WHERE exp'), 'pembersihan tiket di Cron belum ada');
must(cfg.includes('"/sso"'), 'wrangler.jsonc: /sso belum masuk run_worker_first');
must(mig.includes('CREATE TABLE IF NOT EXISTS sso_tiket_terpakai'), 'migration 0024 tidak membuat tabel');

const b64 = (b) => Buffer.from(b).toString('base64url');
const KUNCI = 'kunci-uji-0123456789abcdef0123456789abcdef';
const buat = (o, kunci = KUNCI) => {
  const now = Math.floor(Date.now() / 1000);
  const p = b64(JSON.stringify({ v: 1, iss: 'sipatuo', aud: 'NK', sub: 'budi', name: 'Budi', iat: now, exp: now + 60, jti: crypto.randomBytes(16).toString('hex'), ...o }));
  return `${p}.${b64(crypto.createHmac('sha256', kunci).update(p).digest())}`;
};
let v = await verifikasiTiketSipatuo(buat({}), KUNCI, 'NK');
must(v.ok && v.username === 'budi', 'tiket sah ditolak');
must(!(await verifikasiTiketSipatuo(buat({}), '', 'NK')).ok, 'tanpa SSO_SECRET harus ditolak');
must(!(await verifikasiTiketSipatuo(buat({}, 'kunci-lain'), KUNCI, 'NK')).ok, 'kunci salah harus ditolak');
must(!(await verifikasiTiketSipatuo(buat({ aud: 'BN' }), KUNCI, 'NK')).ok, 'tiket unit lain harus ditolak');
const lama = Math.floor(Date.now() / 1000) - 600;
must(!(await verifikasiTiketSipatuo(buat({ iat: lama, exp: lama + 60 }), KUNCI, 'NK')).ok, 'tiket kedaluwarsa harus ditolak');
const t = buat({});
const [p, s] = t.split('.');
const ubah = b64(JSON.stringify({ ...JSON.parse(Buffer.from(p, 'base64url')), sub: 'direktur' })) + '.' + s;
must(!(await verifikasiTiketSipatuo(ubah, KUNCI, 'NK')).ok, 'tiket yang diubah harus ditolak');
must(!(await verifikasiTiketSipatuo('bukan-tiket', KUNCI, 'NK')).ok, 'format salah harus ditolak');

console.log('Sipatuo SSO smoke OK — /sso sebelum sesi, tiket HMAC 60 detik sekali pakai, cocok username, tanpa buat akun, cron bersih.');
