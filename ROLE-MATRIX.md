# Role Matrix Nara System V3.4.5

## Hierarki utama

1. Head Unit Bisnis
2. Head of Operational
3. Head of Engineering
4. Head of Supporting

Administrator/Direktur adalah akses sistem/manajemen dan tidak dianggap urutan jabatan operasional.

## Tugas Saya dan fokus role

| Posisi | Tugas Saya | Semua Tugas Aktif | Fokus utama |
|---|---|---|---|
| Head Unit Bisnis | Ya | Ya | Oversight BU, keputusan, laporan QC/ATI, vendor |
| Head of Operational | Ya | Ya | Progress final review, fund request, procurement approval, eksekusi |
| Head of Engineering | Ya | Ya | Opname verification, engineering/CCO technical control |
| Head of Supporting | Ya | Ya | QC/defect/quality oversight |
| Project Manager | Ya | Tidak | Review progress, issue, PR, kontrol proyek |
| Pelaksana Lapangan | Ya | Tidak | Progress lapangan, bantu draft PR kebutuhan proyek, perbaikan temuan QC, CCO lapangan |
| QS / Quantity Surveyor | Ya | Tidak | Opname dan RAB CCO |
| QC | Ya | Tidak | Inspeksi, temuan, verifikasi defect, laporan QC |
| Admin Teknik | Ya | Tidak | Routing CCO, dokumen, closeout administratif |
| Finance | Ya | Tidak | Pembayaran fund request dan kontrol finance |
| Procurement / Logistik | Ya | Tidak | Pembanding vendor, order, penerimaan |
| Kepala ATI | Ya | Tidak | Pengajuan tenaga, masalah/evaluasi ATI |
| Instruktur ATI | Ya | Tidak | Aktivitas ATI sesuai kewenangan |

## Penyatuan role lapangan

- **Site Manager / Superintendent / SM** dinormalisasi menjadi **Project Manager**.
- **Pengawas Lapangan / Site Supervisor** dinormalisasi menjadi **Pelaksana Lapangan**.
- Label lama tidak muncul sebagai pilihan jabatan baru, tetapi akun/data lama tetap dapat dipakai.

## Project scope

Project Manager dan Pelaksana Lapangan hanya menerima data/tugas proyek yang memang ditugaskan kepada mereka. Untuk data lama, assignment `siteManagerUserId` dibaca sebagai fallback Project Manager dan `pengawasUserId` dibaca sebagai fallback Pelaksana Lapangan.

## Purchase Request oleh Pelaksana

Pelaksana Lapangan pada proyek yang ditugaskan dapat membantu menyiapkan draft PR. Pengaju formal dan pihak yang submit adalah Project Manager. Setelah submit, tugas berpindah ke Procurement; setelah pembanding siap, Head of Operational/Head Unit Bisnis memilih vendor; sesudah itu Admin Teknik membuat SPK/PO dan Procurement menindaklanjuti order/penerimaan.

## Temuan QC untuk Pelaksana

Temuan QC yang diterbitkan dari inspeksi diarahkan ke Pelaksana Lapangan. Temuan aktif muncul pada QC Dashboard dan Tugas Saya untuk PIC perbaikan; setelah bukti perbaikan dikirim, tugas berpindah kembali ke QC untuk verifikasi.
