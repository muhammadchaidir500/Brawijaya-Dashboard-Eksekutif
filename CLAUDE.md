# Catatan pengembangan – Brawijaya Dashboard Eksekutif

Pemilik: dr. (Superadmin Korporat), komunikasi dalam Bahasa Indonesia. Perubahan di `main` langsung tayang via GitHub Pages.

## Arsitektur `index.html`
Satu berkas HTML (CSS + JS inline, tanpa build). Pustaka dari CDN: supabase-js 2.45.4 (jsDelivr), Chart.js 4.4.1; dimuat saat perlu: SheetJS 0.18.5, mammoth 1.6.0, pdf.js 3.11.174, jsPDF 2.5.1 + autotable 3.8.2.

Lapisan di dalam `<script>` (urut):
1. **utils / icons / constants** – `KATEGORI`, `KELAS`, `MASTER_BUILTIN` (definisi kolom master), logo `LOGO_FULL`/`LOGO_MARK` (data URI).
2. **STORE (Supabase)** – `SB_URL`, `SB_KEY` (publishable), `Store.loadAll/saveDoc/saveMaster/savePatients/...`, `adminFn()` memanggil Edge Function, `verifyPwd()` untuk konfirmasi password.
3. **ENGINE** – `analyze(p)`: billing vs pagu, dekomposisi selisih (`dec.ref + qtyLos + qty + offcp + price = billing`), `causes`. Pagu dipilih oleh `findPagu` (RS spesifik > ALL, kelas sama > Semua).
4. **Views** – `viewDashboard`, `viewHospitals` (+ `resetDialog`), `viewPatients`, `patientForm`, `viewPatientDetail` (tab baru), `viewMaster`, `uploadDialog`, `viewAccounts`, `viewReports` (`REPORTS`), `viewSimrs`, `viewTutorial`.
5. Event delegation lewat atribut `data-act` → objek `ACT`.

Pola keamanan UI: setiap simpan/ubah/hapus memanggil `confirmPwd()`.

## Database (Supabase, ref acwausnccjmlyfdmmgfo)
Tabel: `profiles`, `hospitals`, `master_types`, `master_rows(type, hospital_id, data jsonb)`, `patients(hospital_id, data jsonb)`, `settings` ('branding' publik, 'simrs'), `audit_log`.
RLS memakai `private.pb_role()`, `private.pb_hosp()`, `private.pb_is_sa()`. `public.pb_is_initialized()` terbuka untuk anon.
Skema lengkap: `supabase/migrations/`. Perubahan skema baru → file migrasi baru, terapkan lewat Supabase MCP, lalu commit file-nya.

## Edge Function `admin-users` (verify_jwt=false)
Aksi: `bootstrap` (hanya bila belum ada superadmin), `create`, `update`, `reset_password`, `delete`, `delete_non_superadmin`. Hanya superadmin aktif kecuali bootstrap.

## Desain
Warna merek dari logo: ungu `#906DB1`, abu `#A8A9AD`, teks abu `#6D6E73`. Sidebar ungu tua `#3B2A55`; area kerja abu cerah `#F3F2F6`. Font: Plus Jakarta Sans (UI), IBM Plex Mono (angka). Token warna di `:root` (+ mode gelap).

## Alur perubahan
1. Edit `index.html` (dan migrasi/fungsi bila perlu).
2. Uji sintaks: ekstrak `<script>` terakhir → `node --check`.
3. Commit & push ke `main` → GitHub Pages tayang ±1 menit.
