# Brawijaya Dashboard Eksekutif

Pusat kendali biaya pelayanan seluruh rumah sakit grup Brawijaya Hospital. Aplikasi membandingkan billing tiap pasien dengan pagu Clinical Pathway / Evidence Based Practice, lalu menelusuri penyebab selisih (LOS, utilisasi, item di luar CP, selisih harga) sampai ke item tarif.

- **Website (produksi):** https://brawijaya-dashboard.hospitalicp.workers.dev/ – Cloudflare Workers, otomatis deploy dari `main`
- **Kode:** `index.html` (satu berkas, tanpa build)
- **Backend:** Supabase, proyek `pantau-biaya-korporat` (ref `acwausnccjmlyfdmmgfo`, region Singapura)

## Struktur repo

| Path | Isi |
|---|---|
| `index.html` | Seluruh aplikasi: login, dashboard, pasien, master data, laporan, integrasi SIMRS, tutorial |
| `supabase/migrations/` | Skema database + Row Level Security (sudah diterapkan ke Supabase) |
| `supabase/functions/admin-users/` | Edge Function pengelolaan akun (buat, ubah, reset password, hapus) |
| `CLAUDE.md` | Catatan teknis untuk pengembangan lanjutan |
| `.nojekyll` | Agar GitHub Pages menyajikan berkas apa adanya |

## Menayangkan website (GitHub Pages)

1. Repo → **Settings** → **Pages**
2. **Source:** Deploy from a branch → **Branch:** `main`, folder `/ (root)` → **Save**
3. Tunggu 1–2 menit. Alamat: `https://muhammadchaidir500.github.io/brawijaya-dashboard-eksekutif/`

Setiap perubahan yang di-push ke `main` otomatis tayang dalam ±1 menit.

## Pengaturan Supabase (sekali saja)

1. Dashboard Supabase → proyek **pantau-biaya-korporat**
2. **Authentication → Sign In / Providers** → matikan *Allow new users to sign up* → Save
3. **Authentication → URL Configuration** → **Site URL** = alamat GitHub Pages di atas → Save

## Penyiapan pertama

1. Buka alamat website → muncul halaman **Penyiapan awal** (hanya sekali, sebelum Superadmin pertama ada).
2. Isi nama, username, password Superadmin. Centang *data contoh* bila ingin mencoba dengan 5 RS dan 180 pasien.
3. Buat akun direktur RS di **Master Data → Pengaturan Akun**.

## Peran akun

| Peran | Akses |
|---|---|
| Superadmin Korporat | Semua RS, akun, master bersama, integrasi SIMRS, log, reset data |
| Admin RS | Pasien, dokter, tarif, pagu milik RS-nya |
| Pemantau RS | Lihat saja (dashboard, pasien, laporan RS-nya) |

Pembatasan akses ditegakkan di database (RLS), bukan hanya di tampilan.

## Keamanan

- Kunci yang ada di `index.html` adalah *publishable key* Supabase: memang dirancang untuk berada di sisi browser. Data tetap terlindungi oleh login dan RLS.
- Jangan pernah menaruh *service role key* atau password di repo ini.
- Username dipetakan ke email internal `username@users.pantaubiaya.id`; tidak ada email yang dikirim.

## Integrasi SIMRS

Format kiriman JSON baku tersedia di menu **Integrasi SIMRS** (Superadmin). Middleware SIMRS dapat menulis ke tabel `patients` (kunci: kode RS + No. Registrasi) memakai kredensial server, bukan dari browser.

## Cloudflare (alternatif hosting tanpa nama akun GitHub)

Workers & Pages → Create → Import a repository → pilih repo ini, lalu:

| Kolom | Isi |
|---|---|
| Project name | `brawijaya-dashboard` (harus sama dengan `name` di `wrangler.jsonc`) |
| Build command | `mkdir -p dist && cp index.html dist/` |
| Deploy command | `npx wrangler deploy` |
| Non-production branch deploy (preview) command | `npx wrangler versions upload` |

Setelah tayang, perbarui Site URL di Supabase (Authentication → URL Configuration).
