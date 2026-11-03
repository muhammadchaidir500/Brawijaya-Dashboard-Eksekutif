# Dashboard Direktur RS Brawijaya Tangerang (Google Apps Script)

Folder ini **tidak** ikut tayang di Cloudflare (build hanya menyalin `index.html` di akar).

- `Index.html` – tampilan dashboard. Script Apps Script mengambil berkas ini dari
  `https://raw.githubusercontent.com/muhammadchaidir500/Brawijaya-Dashboard-Eksekutif/main/rs-tangerang/Index.html`
  setiap halaman dibuka, jadi perubahan tampilan cukup di-push ke `main` lalu refresh dashboard (±1–5 menit).
  Berkas ini hanya kode tampilan; data dibaca lewat `google.script.run` dari Google Drive dengan akun pembuka.
  Wajib mengandung penanda `BWT-DASH-v1` (dicek oleh `ambilTampilan_()`).
- `Code.gs` – salinan kode server di proyek Apps Script (folder data Drive `1Oi2V3r5Dd5btUQ8eqs-hVzelu42NP2Lc`).
  Perubahan pada `Code.gs` tetap harus ditempel manual di editor Apps Script lalu deploy versi baru.
