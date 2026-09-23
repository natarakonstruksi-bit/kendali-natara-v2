# Deploy Checklist — Nara System V3.4.10

1. Pastikan deploy memakai package **V3.4.10 QC Control + Button/Flow QA**.
2. Jangan membuat D1 atau R2 baru. Tetap gunakan binding produksi existing.
3. Jalankan QA/build lokal:

```bash
npm run build
python scripts/db-smoke.py
```

4. Jika migration `0019_workflow_inbox.sql` **sudah** pernah diterapkan, tidak perlu migration lagi.
5. Deploy:

```bash
npx wrangler deploy
```

6. Setelah deploy lakukan hard refresh / logout-login agar asset/session terbaru terbaca.
7. Smoke test browser minimal dengan akun:
   - Head of Supporting: buat inspeksi, tambah item, edit/hapus item, publish finding, edit/hapus finding, verifikasi, laporan QC.
   - QC: alur yang sama sesuai project scope.
   - Pelaksana Lapangan: menerima finding → Mulai → Kirim Perbaikan.
   - Project Manager: QC read-only pada proyek ditugaskan.
8. Uji upload R2 produksi nyata untuk foto inspeksi dan bukti perbaikan.
9. Uji `Tugas Saya` berpindah Pelaksana ↔ QC/Head of Supporting.
10. Verifikasi audit log setelah penghapusan data QC.

Catatan: build/static/runtime smoke menguji source dan wiring. Integrasi Cloudflare produksi seperti cookie/session, D1 remote, dan R2 remote tetap harus divalidasi sesudah deployment nyata.
