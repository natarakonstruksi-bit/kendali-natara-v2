# Hotfix Login & Routing KENDALI — 10 Agustus 2026

Perilaku login setelah hotfix:

- Setiap sesi browser baru dimulai dari halaman Login.
- Pelaksana Lapangan setelah login otomatis diarahkan ke Mode Lapangan (`#/lapangan`).
- Semua role lain setelah login otomatis diarahkan ke Dashboard KENDALI lengkap (`#/`).
- Administrator tetap memiliki full access dan tetap dapat membuka Mode Lapangan secara manual.
- Session login disimpan pada `sessionStorage`, bukan `localStorage`, sehingga session lama tidak otomatis membuka aplikasi pada sesi browser baru. Refresh pada tab yang sama tetap mempertahankan login.
- Route default/fallback hanya mengarahkan otomatis ke Mode Lapangan bila role tepat `Pelaksana Lapangan`; capability `full` milik Administrator tidak lagi memicu redirect otomatis.
