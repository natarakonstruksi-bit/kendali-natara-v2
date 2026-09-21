# Role Matrix — V3.2 Sistem Informasi Publik

Portal `/info` dapat dibaca semua orang tanpa login.

Pengelolaan publikasi hanya untuk:
- Administrator
- Direktur
- Head Unit Bisnis
- Manager Operasional / Head Operational
- Admin Teknik

PM, Pelaksana, QS, QC, Finance, Procurement, ATI, dan Viewer tidak mendapat menu **Informasi Publik** kecuali role diubah oleh manajemen.

Portal publik tidak memberikan akses ke API KENDALI internal. Endpoint internal `/api/*`, `/rest/*`, dan `/storage/*` tetap membutuhkan sesi login kecuali endpoint khusus `/api/public/*` yang hanya mengeluarkan data publikasi aman.


## Profil & Portofolio Publik
Administrator, Direktur, Head Unit Bisnis memiliki akses penuh. Manager Operasional dan Admin Teknik dapat mengelola profil/portofolio publik. Role proyek lapangan, QS, QC, Finance, Procurement, ATI, dan Viewer tidak mendapat menu ini.
