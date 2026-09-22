# Changelog V3.4.1

- Menambahkan menu **Tugas Saya** untuk seluruh role operasional.
- Menambahkan badge jumlah tugas aktif pada sidebar.
- Menambahkan **Semua Tugas Aktif** untuk Head/management sebagai pusat monitoring bottleneck.
- Menambahkan task routing otomatis: task lama selesai ketika source workflow berpindah tahap, lalu task baru dibuat untuk PIC/role berikutnya.
- Menambahkan `Ambil`, `Mulai`, dan `Buka & Proses`; penyelesaian wajib dilakukan pada modul sumber agar status tidak dapat dipalsukan.
- Menambahkan workflow handoff penuh untuk Progress, Opname, QC Defect, CCO, Pengajuan Dana, Procurement, Issue, Retention, Close-Out, ATI Work Request, ATI Field Issue, dan Laporan QC/ATI.
- Procurement mendapat tahap baru `READY_FOR_APPROVAL` setelah Procurement selesai memasukkan pembanding vendor.
- Generic Edit mengunci status modul workflow agar user tidak dapat melompati tahap.
- Menu **Alur Proyek** sekarang menampilkan `Tugas Aktif Proyek` lengkap dengan posisi saat ini, apa yang ditunggu, deadline dan status.
- Project lifecycle PHO/QC gate diselaraskan dengan **Continuous QC Inspection** yang digunakan dashboard QC terbaru.
- Menambahkan migration `0019_workflow_inbox.sql` dan index workflow task.

## QA Final 3.4.1
- Menghapus `Head Operational` dari dropdown jabatan baru; legacy tetap kompatibel di backend.
- Menormalkan tampilan akun lama ke `Head of Operational`, `Head of Engineering`, dan `Head of Supporting`.
- Menambah runtime assertions untuk generator tombol workflow utama.
- Menambah static button/action wiring audit pada build.
- Menambah `QA-MATRIX.md` sebagai daftar cakupan regression test.
