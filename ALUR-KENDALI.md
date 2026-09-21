# Alur KENDALI Natara V3.1

## Laporan Harian dan Upah

`Pelaksana Login → pilih proyek yang ditangani → input progress → pilih tukang → kehadiran/upah/lembur → simpan → Dashboard Progress + Rekap Gaji + ATI`

PIC laporan tidak dipilih bebas. Sistem mengambil Pelaksana Lapangan yang terdaftar pada master proyek.

## Purchase Request

`Pelaksana/Procurement dapat menyiapkan draft → Project Manager proyek menjadi pemilik/pengaju PR → isi multi-item HPP + COI → PM Submit → Procurement/Admin lengkapi beberapa penawaran vendor → Head Operational/Head Unit Bisnis pilih vendor → APPROVED → PO/SPK → ORDERED → RECEIVED`

Setiap item menyimpan spesifikasi, volume, satuan, HPP/unit, dan total HPP. Vendor menyimpan VML, penawaran, term dan lead time. Vendor terpilih disalin ke PO/SPK.

## QC

`QC buat Temuan + Foto Before → Pelaksana mulai → Pelaksana upload Foto After → WAITING QC CHECK → QC Verifikasi`

Jika sesuai: `CLOSED`.
Jika tidak sesuai: `REVISION REQUIRED → ON PROGRESS → kirim ulang → verifikasi ulang`.

## ATI

Dashboard ATI mempertahankan alur kerja: `Pengajuan Pekerjaan → Database Tukang → Penempatan/Laporan Harian → Attendance & Productivity/Upah → Masalah Lapangan → Evaluasi Masalah → Assessment/Grading → Pelatihan → Log ATI`.

`Master Tukang → Penugasan di Laporan Harian → Kehadiran & Upah → Portofolio Jam Kerja → Asesmen Kompetensi → Pelatihan/Remedial → Leveling L0–L6`.

## Project Scope

Project Manager dan Pelaksana hanya menerima data proyek yang akun mereka ditetapkan sebagai PM/Pelaksana. Filter ini diterapkan pada frontend, API record, dashboard, dokumen dan storage proyek.
