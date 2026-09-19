# Alur Operasional KENDALI V2.8

## 1. Project Setup
Input master proyek, nilai kontrak, HPP/budget, tanggal, PM/pengawas. Upload CONTRACT, RAB_BASELINE, DED_FINAL, dan TIME_SCHEDULE. Status tetap `SETUP` selama salah satu dokumen wajib belum lengkap.

## 2. Pre-Construction
Upload PCM dan MC0. Lengkapi schedule/Kurva-S, milestone, cost code/budget, procurement plan, dan PIC. Setelah gate lengkap, proyek masuk ke mobilisasi/pelaksanaan berdasarkan progress.

## 3. Mobilisasi dan Pelaksanaan
Input progress harian dan mingguan, tenaga kerja, pekerjaan, kendala, rencana berikutnya, schedule, milestone, dan issue. Skema issue mengikuti: Masalah → Dampak → Penyebab → Pilihan → Keputusan → PIC → Deadline.

## 4. Procurement & Finance
PR/procurement → approval → PO/SPK → penerimaan → cash-out. Cash-in dicatat dari DP/termin/cicilan/pelunasan. Piutang, hutang, payment request, dan approval dipantau per proyek.

## 5. QC
QC Inspection → PASS/NG → bila ada temuan buat Defect → corrective action → re-inspection → CLOSED. QC/defect/issue terbuka menghambat PHO.

## 6. QS / Opname
QS melakukan opname volume → nilai opname → verifikasi → approval → BA opname. Dokumen BA dapat di-upload langsung pada form opname dan otomatis masuk Dokumen Proyek.

## 7. CCO / Addendum
Catat perubahan → nilai/% RAB → submit/review → approved/closed → upload CCO/Addendum. CCO yang belum selesai menghambat financial close-out.

## 8. PHO
Syarat minimal: progress 100%, QC/defect/issue tertutup, PHO_BAST tersedia, AS_BUILT tersedia. Bila belum, status gate tetap `PHO`.

## 9. Retensi / FHO
Bila proyek memakai retensi, catat tanggal mulai/akhir, nilai, dan status sampai RELEASED/CLOSED. Jika FHO diwajibkan, upload FHO_BAST.

## 10. Financial Close-Out
Piutang = 0, hutang = 0, CCO selesai, approval/payment request selesai, checklist close-out selesai, dan FINAL_RECONCILIATION tersedia.

## 11. CLOSED
Klik **Evaluasi & Sync**. Backend menghitung ulang semua gate. Status hanya menjadi `CLOSED` bila tidak ada blocker.

## Kontrol dokumen
Setiap kebutuhan bukti dapat memakai lampiran di form. Lampiran otomatis masuk ke menu Dokumen dengan Project ID dan relasi record. Dokumen juga dapat di-upload manual, dibuka, diedit metadata, diganti file, dan dihapus.
