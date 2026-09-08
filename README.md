# KENDALI Natara App V2.4 — Project Assignment Otomatis

Versi ini melanjutkan baseline V2.3 dan menghubungkan akun karyawan ke proyek yang sudah diimport.

## Yang dikerjakan
- Project Manager / Superintendent yang sudah dikenal otomatis diberi `pmUsername`.
- Pelaksana/Pengawas yang sudah dikenal otomatis diberi `pengawasUsername`.
- Setelah itu login user non-full-access dapat melihat proyek yang memang ditugaskan kepadanya.
- Data yang belum mempunyai pasangan karyawan pasti tetap kosong, tidak ditebak.

## Mapping yang dipastikan

### Project Manager / Superintendent
- Sayyid / Sayyid Triwardhana → `sayyidtriwardhana`
- Hilal / Muhammad Hilal → `muhammadhilalp765`
- Zul / Zulkarnaen → `dzuljob`

### Pelaksana / Pengawas
- Aan → `aanmks0326`
- Anas → `anasmunandar18`
- Fadhly → `muhammadfadhly300`
- Fadli → `nurulfadli00`
- Fikry → `muhammdnurfikry`
- Gazali → `raikah536`
- Hilal → `muhammadhilalp765`
- Sayyid → `sayyidtriwardhana`
- Syawal → `muhammadsyawal26001`
- Zulfikar → `muhzulfikarf14`

Nama yang belum ada pasangan pasti seperti Ade, Arman, Raslin, Hilmi, Uais, Ansari, dan Fikar sengaja dibiarkan kosong.

## Migration baru
`migrations/0008_link_project_assignment_usernames.sql`

## Deploy
Tetap satu kali:
- Build: `npm run build`
- Deploy: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

## Verifikasi
Buka `/api/health`.

Versi harus `APP-V2.4`.

Health juga menampilkan:
- `linked_project_pm`
- `linked_project_pelaksana`

Buka dengan akun Project Manager/Pelaksana yang sudah punya username. User tersebut seharusnya hanya melihat proyek yang terkait dengannya, kecuali role memang mempunyai akses melihat semua proyek.
