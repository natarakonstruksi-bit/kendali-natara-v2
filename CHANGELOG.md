# V2.8.1 — Build & Deployment Fix

- Menambahkan script `npm run build` yang diwajibkan Cloudflare build pipeline.
- Mengembalikan binding D1 produksi `kendali-natara-db-v2` beserta database ID lama.
- Mengembalikan R2 produksi `kendali-natara-files-v2`.
- Menambahkan routing Worker untuk `/rest/*`, `/storage/*`, dan `/auth/*` agar kompatibilitas fitur lama tetap berjalan.
- Menambahkan kompatibilitas `/api/access/session` dan storage R2 lama.
- Memperketat autentikasi REST/storage, diagnostics khusus Administrator/Direktur, dan rate-limit login.
- Menghapus audit LOGIN ganda.

# Changelog

## 2.8.0
- Portfolio dashboard seluruh proyek dengan cash-in/cash-out dan budget control.
- End-to-end project lifecycle sampai CLOSED.
- Finance: budget, cash-in, cash-out, AR/AP, payment request, approval.
- Progress: schedule/Kurva-S, milestone, daily, weekly, issue/corrective action.
- QS/opname, QC/defect, CCO/addendum, procurement/PO.
- Document management R2: upload/open/edit/replace/delete/versioning.
- PHO, retention, FHO, financial close-out, standard close-out checklist.
- Audit log.
- Preserves existing app_records collections and adds Master Data UI for legacy collections.
