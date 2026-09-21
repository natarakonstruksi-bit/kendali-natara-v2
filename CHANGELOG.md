# CHANGELOG

## 3.0.1 — Role + Project Scope

- PM hanya dapat melihat dan mengakses proyek yang ditugaskan kepadanya.
- Pelaksana hanya dapat melihat dan mengakses proyek yang ditugaskan kepadanya.
- Scope berlaku pada dashboard, project list, record CRUD, progress, CCO, PR, payment request, dokumen, flow, dan storage legacy.
- Direct API access ke proyek di luar assignment ditolak backend.
- Dashboard menyembunyikan payload detail finance dari role tanpa akses Finance.
- UI memberi label “Proyek ditugaskan saja” dan filter “Semua proyek yang saya tangani” untuk PM/Pelaksana.
- Kompatibilitas field assignment lama dipertahankan.


## 3.0.0 — Full Workflow

- Dashboard grafik Rencana vs Aktual per proyek.
- Dropdown karyawan pada proyek dan seluruh PIC utama.
- Finance flow + Payment Request automation.
- Opname/QS diperjelas.
- QC work-item dashboard, sync RAB, evidence-required inspection, defect/re-inspection.
- CCO staged workflow Pelaksana → Admin → QS → Admin → Client → Addendum.
- CCO escalation gate >8% dan >10%.
- Procurement PR vs PO/SPK diperjelas; PO/SPK sync payable.
- Menu Karyawan & Akses.
- Role-based navigation dan backend API authorization.
- Migration 0012 dan preflight check V3.0.
