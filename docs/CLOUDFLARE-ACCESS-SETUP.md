# Cloudflare Access — langkah konfigurasi KENDALI

1. Deploy Worker dulu (`npm run deploy`). Catat URL `https://kendali-natara-v2.<subdomain>.workers.dev`.
2. Dashboard Cloudflare → Workers & Pages → `kendali-natara-v2` → Settings → Domains & Routes.
3. Pada baris `workers.dev` klik **Enable Access** (Cloudflare akan membuat Access Application otomatis).
4. Zero Trust → Access → Applications → buka aplikasi tersebut → Policies:
   - Policy name: `Staf Natara`
   - Action: Allow
   - Include → Selector **Emails** → tempel daftar dari `CLOUDFLARE-ACCESS-EMAILS.txt`
5. Zero Trust → Settings → Authentication → pastikan **One-time PIN** aktif.
6. (Opsional, lebih ketat) Overview aplikasi → salin **Application Audience (AUD) Tag**, lalu di Worker:
   Settings → Variables and Secrets:
   - `ACCESS_TEAM_DOMAIN` = `<team>.cloudflareaccess.com`
   - `ACCESS_AUD` = AUD tag
7. Uji: buka URL Worker di jendela private → halaman login Access → masukkan email admin → OTP → KENDALI terbuka.

Catatan:
- Email di Access policy **dan** di master karyawan KENDALI harus sama (perbandingan tidak peka huruf besar/kecil).
- Email yang lolos Access tetapi belum ada di KENDALI akan melihat pesan "Email Cloudflare Access belum terdaftar".
- Karyawan berstatus `Nonaktif` ditolak walaupun lolos Access.
