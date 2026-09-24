# Alur Nara System V3.4.13

## 1. Proyek masuk

Head Unit Bisnis/Admin berwenang membuat proyek dan menetapkan Project Manager, Pelaksana Lapangan, QS, QC, serta PIC teknis lain. Project Manager dan Pelaksana dibatasi ke proyek yang ditugaskan.

## 2. Persiapan / Engineering

Head of Engineering mengawal baseline teknis: DED/gambar, RAB/HPP, schedule, dan kesiapan dokumen. QS menangani volume/opname/CCO teknis. Admin Teknik mengawal administrasi teknis.

## 3. Eksekusi / Progress

Pelaksana Lapangan menginput progress aktual, foto, kendala, dan tenaga kerja. Laporan berpindah ke Project Manager untuk review lalu Head of Operational untuk review akhir sesuai workflow.

## 4. PR Vendor

`Project Manager → Head of Operational / Head Unit Bisnis → Admin Teknik → Project Manager`

Project Manager mengisi kebutuhan pekerjaan/material/jasa, HPP detail, pembanding vendor, quotation, term, lead time, dan Conflict of Interest. Head memilih vendor. Admin Teknik membuat SPK/PO. Setelah SPK/PO terbentuk, tugas kembali ke PM untuk tindak lanjut/order dan konfirmasi penerimaan.

## 5. QC — Continuous Inspection

### Membuat inspeksi
QC atau Head of Supporting membuka satu catatan inspeksi berjalan untuk proyek. Pada setiap kelompok pekerjaan, inspector menambah sub-pekerjaan dan wajib memilih **Sesuai** atau **Tidak Sesuai**. Setiap item memiliki tanggal sendiri, keterangan, dan evidence foto bila diperlukan.

### Edit/Hapus
- Session inspeksi: Buka, Edit, Hapus.
- Sub-pekerjaan: Edit, Hapus, Ganti Foto.
- Temuan: Detail, Edit, Hapus.
- Laporan QC: Lihat, Edit, Hapus.

Head of Supporting mempunyai fungsi input dan kontrol QC yang sama dengan QC untuk kebutuhan supervisi.

### Menjadi temuan
Item `TIDAK SESUAI` dapat diterbitkan sebagai Temuan QC. PIC otomatis diarahkan ke Pelaksana Lapangan proyek. Tugas masuk ke `Tugas Saya` Pelaksana.

### Perbaikan
Pelaksana menekan **Mulai**:

`OPEN / REVISION REQUIRED → ON PROGRESS`

Setelah perbaikan selesai, Pelaksana mengirim uraian + bukti after:

`ON PROGRESS → WAITING QC CHECK`

### Verifikasi
QC/Head of Supporting memverifikasi:

- Sesuai → `CLOSED`.
- Tidak Sesuai → `REVISION REQUIRED`, dan tugas kembali ke Pelaksana.

Status workflow tidak dapat dipindahkan dengan Edit biasa. Ini menjaga task routing dan histori tetap konsisten.

### Penghapusan relasional
Jika record yang dihapus mempunyai data turunan yang memang melekat pada record tersebut, backend membersihkan relasi terkait (finding/task/history/evidence) dan tetap membuat audit trail penghapusan.

## 6. CCO / Addendum

Pelaksana/PM mengajukan → Admin Teknik memeriksa/routing → QS menghitung volume/RAB → tahap approval/escalation → client → addendum → closed. Setiap tahap menampilkan next action yang sesuai role.

## 7. QS / Volume

QS mengisi **Volume RAB** dan **Volume Realisasi** per item/area. Sistem menghitung persentase realisasi otomatis. Setelah data siap: `QS → Head of Engineering → Admin Teknik`. Jika Head of Engineering mengembalikan, status kembali ke QS untuk revisi.

## 8. As-Built / Drafter

Drafter memperbarui progress **Arsitektur / Struktur / MEP** dan meng-upload file tiap disiplin. Overall adalah rata-rata ketiga progress. Saat semua 100% dan file lengkap: `Drafter → Head of Engineering → APPROVED`. Jika revisi, tugas kembali ke Drafter melalui `Tugas Saya`.

## 9. Pengajuan Dana / Finance

Requester mengajukan → Head of Operational review/approve → Finance memproses pembayaran. Cash Out terbentuk ketika pembayaran benar-benar ditandai Paid, bukan saat pengajuan dibuat.

## 10. Laporan QC dan ATI

QC/Head of Supporting dapat membuat laporan mingguan/bulanan dari snapshot data inspeksi dan temuan periode. Laporan dikirim ke Head Unit Bisnis untuk review. Metadata laporan dapat diedit/hapus oleh role berwenang; snapshot data inspeksi periode tetap dipertahankan sebagai hasil historis.

## 11. Tugas Saya

Setiap handoff membuat task dengan status, PIC/role tujuan, deadline, modul sumber, dan `menunggu apa`. User membuka tugas lalu menyelesaikannya dari modul sumber. Penyelesaian aksi membuat task sekarang selesai dan menyalurkan task berikutnya sesuai alur.

## 12. Gate Proyek

Nara System mengevaluasi tahap proyek dari SETUP/PRECON/MOBILIZATION/EXECUTION sampai PHO/RETENTION/FHO/FINANCIAL CLOSE/CLOSED. Progress fisik 100% tidak otomatis berarti CLOSED; QC/defect, CCO, dokumen, serah terima, vendor, dan financial close tetap harus selesai.
