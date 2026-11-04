/**
 * Dashboard Direktur RS Brawijaya Tangerang — Pusat Data Manajemen (Google Apps Script)
 *
 * Cara kerja (konsep sama dengan Pusat Data Manajemen RS Humana Prima):
 * 1) Setiap unit menaruh laporannya (Excel / CSV / Google Spreadsheet) di subfolder masing-masing
 *    di dalam folder utama, misalnya "Farmasi", "Keuangan", "Rawat Inap".
 *    Folder yang namanya diawali "_" dilewati.
 * 2) Setiap 10 menit, konversiOtomatis() membuat salinan ringkas terkompresi (.json.gz) dari setiap
 *    file data ke folder "_cache_dashboard (jangan dihapus)". File asli TIDAK diubah.
 *    File Excel/CSV di atas 1 MB juga dibuatkan versi Google Spreadsheet di folder yang sama.
 * 3) Halaman dashboard (Index.html) hanya membaca salinan ringkas itu, jadi cepat dibuka.
 *
 * Akses:
 * - Web app dijalankan sebagai "Pengguna yang mengakses aplikasi web". Setiap orang membaca data
 *   dengan akun Google-nya sendiri: hanya email yang diberi akses (Pelihat) ke folder utama yang
 *   bisa melihat data.
 * - Bila EMAIL_DIIZINKAN diisi, hanya email di daftar itu yang boleh membuka dashboard.
 * - Tombol "Perbarui data sekarang" hanya untuk PEMILIK.
 *
 * Langkah pertama: pilih fungsi "aktifkan" lalu klik Run (SATU KALI, dan setiap kali kode ini diperbarui).
 */

const CONFIG = {
  FOLDER_UTAMA: '1Oi2V3r5Dd5btUQ8eqs-hVzelu42NP2Lc',   // folder "Dashboard RS Brawijaya Tangerang"
  // Email yang boleh memakai tombol "Perbarui data sekarang"
  PEMILIK: ['ongkopriyanto22@gmail.com', 'muhammadchaidir500@gmail.com'],
  NAMA_RS: 'RS Brawijaya Tangerang',
  JUDUL: 'Dashboard Direktur RS Brawijaya Tangerang',

  // Kosong [] = semua email yang diberi akses ke folder utama boleh membuka dashboard.
  // Contoh: ['ongkopriyanto22@gmail.com', 'manajer.keuangan@contoh.com']
  EMAIL_DIIZINKAN: [],

  BATAS_MB: 1,
  CACHE_NAMA: '_cache_dashboard (jangan dihapus)'
};

const VERSI = 'BWT-DASH-v1';
const SHEETS = 'application/vnd.google-apps.spreadsheet';
const SUMBER = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
  'application/vnd.oasis.opendocument.spreadsheet',
  'text/csv'
];
const TANDA = 'Konversi otomatis dari ';
const BATAS_WAKTU_MS = 4.5 * 60 * 1000;

/* ===================== Pemasangan ===================== */

function aktifkan() {
  ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'konversiOtomatis') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('konversiOtomatis').timeBased().everyMinutes(10).create();
  konversiOtomatis();
  cekSistem();
}

/* ===================== Web app ===================== */

function doGet() {
  const email = emailPengguna_();
  if (!diizinkan_(email)) {
    return halamanPesan_('Akses belum diberikan',
      'Email <b>' + aman_(email || 'tidak terbaca') + '</b> belum terdaftar untuk membuka ' + aman_(CONFIG.JUDUL) +
      '. Hubungi Direktur agar email Anda ditambahkan.');
  }
  try { DriveApp.getFolderById(CONFIG.FOLDER_UTAMA).getName(); }
  catch (e) {
    return halamanPesan_('Folder data belum dibagikan',
      'Akun <b>' + aman_(email || 'Anda') + '</b> belum diberi akses ke folder <b>Dashboard RS Brawijaya Tangerang</b> di Google Drive. ' +
      'Minta pemilik membagikan folder itu ke email ini sebagai <b>Pelihat</b>, lalu muat ulang halaman.');
  }
  return HtmlService.createHtmlOutput(ambilTampilan_().html)
    .setTitle(CONFIG.JUDUL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DEFAULT);
}

/**
 * Tampilan dashboard (HTML) diambil otomatis, berurutan:
 * 1) GitHub: repo muhammadchaidir500/Brawijaya-Dashboard-Eksekutif, berkas rs-tangerang/Index.html.
 *    Pembaruan tampilan cukup di-push ke sana; dashboard ikut berubah setelah di-refresh (±1–5 menit).
 *    Berkas itu hanya berisi kode tampilan, tanpa data rumah sakit.
 * 2) Google Drive: file "Dashboard-Brawijaya-Tangerang-Web….html" terbaru di folder "_cache_dashboard (jangan dihapus)".
 * 3) File Index.html di dalam proyek script ini (cadangan bila dua sumber di atas gagal).
 */
const TAMPILAN_URL = 'https://raw.githubusercontent.com/muhammadchaidir500/Brawijaya-Dashboard-Eksekutif/main/rs-tangerang/Index.html';
const TAMPILAN_NAMA = 'Dashboard-Brawijaya-Tangerang-Web';
function ambilTampilan_() {
  try {
    const res = UrlFetchApp.fetch(TAMPILAN_URL + '?t=' + Math.floor(Date.now() / 60000), { muteHttpExceptions: true, followRedirects: true });
    const html = res.getResponseCode() === 200 ? res.getContentText('UTF-8') : '';
    if (html.indexOf(VERSI) >= 0) return { html: html, sumber: 'GitHub: rs-tangerang/Index.html' };
  } catch (e) { console.warn('Tampilan dari GitHub gagal dibaca: ' + e); }
  try {
    const root = DriveApp.getFolderById(CONFIG.FOLDER_UTAMA);
    const it = root.getFoldersByName(CONFIG.CACHE_NAMA);
    if (it.hasNext()) {
      const fs = it.next().searchFiles("title contains '" + TAMPILAN_NAMA + "' and trashed = false");
      let f = null;
      while (fs.hasNext()) { const x = fs.next(); if (/\.html?$/i.test(x.getName()) && (!f || x.getLastUpdated() > f.getLastUpdated())) f = x; }
      if (f) return { html: f.getBlob().getDataAsString('UTF-8'), sumber: 'Google Drive: ' + f.getName() };
    }
  } catch (e) { console.warn('Tampilan dari Drive gagal dibaca: ' + e); }
  return { html: HtmlService.createHtmlOutputFromFile('Index').getContent(), sumber: 'Index.html di proyek script' };
}

/**
 * Daftar semua file data beserta status salinan ringkasnya. Mengembalikan teks JSON:
 * {rs, judul, email, pemilik, dibaca, file:[{id, nama, unit, diubah, siap, ukuran}]}
 */
function getKatalog() {
  const email = wajibIzin_();
  const root = DriveApp.getFolderById(CONFIG.FOLDER_UTAMA);
  const cacheIt = root.getFoldersByName(CONFIG.CACHE_NAMA);
  const idx = {};
  if (cacheIt.hasNext()) {
    const it = cacheIt.next().getFiles();
    while (it.hasNext()) {
      const f = it.next();
      if (f.isTrashed()) continue;
      const m = /^(.+)\.json\.gz$/.exec(f.getName());
      if (m) idx[m[1]] = f.getDescription() || '';
    }
  }
  const out = [];
  daftarFolder_(root).forEach(function (fd) {
    daftarFile_(fd.folder).forEach(function (f) {
      if (!fileData_(f)) return;
      const stamp = f.getLastUpdated().toISOString();
      const desc = idx[f.getId()];
      out.push({
        id: f.getId(), nama: f.getName(), unit: fd.unit, diubah: stamp,
        siap: desc != null, terbaru: desc != null && desc.indexOf('diubah=' + stamp) >= 0,
        ukuran: f.getSize()
      });
    });
  });
  out.sort(function (a, b) { return a.unit.localeCompare(b.unit) || (b.diubah > a.diubah ? 1 : -1); });
  return JSON.stringify({
    versi: VERSI, rs: CONFIG.NAMA_RS, judul: CONFIG.JUDUL, email: email,
    pemilik: pemilik_(email), dibaca: new Date().toISOString(), file: out
  });
}

/** Isi salinan ringkas satu file (teks JSON {v, sumber, dibuat, sheets:[{nama, baris}]}). */
function getIsiFile(id) {
  wajibIzin_();
  const root = DriveApp.getFolderById(CONFIG.FOLDER_UTAMA);
  const cacheIt = root.getFoldersByName(CONFIG.CACHE_NAMA);
  if (!cacheIt.hasNext()) throw new Error('Salinan ringkas belum dibuat. Tunggu ±10 menit atau minta pemilik menekan "Perbarui data sekarang".');
  const fs = cacheIt.next().getFilesByName(String(id) + '.json.gz');
  while (fs.hasNext()) {
    const f = fs.next();
    if (f.isTrashed()) continue;
    return Utilities.ungzip(f.getBlob().setContentType('application/x-gzip')).getDataAsString('UTF-8');
  }
  throw new Error('Salinan ringkas file ini belum ada. Tunggu ±10 menit setelah file diunggah.');
}

/** Sama dengan getIsiFile tetapi tetap terkompresi (base64 dari .json.gz) agar file besar cepat sampai ke browser. */
function getIsiFileGz(id) {
  wajibIzin_();
  const root = DriveApp.getFolderById(CONFIG.FOLDER_UTAMA);
  const cacheIt = root.getFoldersByName(CONFIG.CACHE_NAMA);
  if (!cacheIt.hasNext()) throw new Error('Salinan ringkas belum dibuat. Tunggu ±10 menit.');
  const fs = cacheIt.next().getFilesByName(String(id) + '.json.gz');
  while (fs.hasNext()) {
    const f = fs.next();
    if (!f.isTrashed()) return Utilities.base64Encode(f.getBlob().getBytes());
  }
  throw new Error('Salinan ringkas file ini belum ada. Tunggu ±10 menit setelah file diunggah.');
}

/** Tombol "Perbarui data sekarang" (hanya pemilik). */
function perbaruiSekarang() {
  hanyaPemilik_();
  konversiOtomatis();
  return getKatalog();
}

/* ===================== Akses ===================== */

function emailPengguna_() {
  try { return String(Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail() || '').toLowerCase(); }
  catch (e) { return ''; }
}
function pemilik_(email) {
  const list = [].concat(CONFIG.PEMILIK || []).map(function (x) { return String(x).trim().toLowerCase(); });
  return !!email && list.indexOf(email) >= 0;
}
function diizinkan_(email) {
  const list = (CONFIG.EMAIL_DIIZINKAN || []).map(function (x) { return String(x).trim().toLowerCase(); }).filter(String);
  if (!list.length) return true;
  return !!email && (list.indexOf(email) >= 0 || pemilik_(email));
}
function wajibIzin_() {
  const email = emailPengguna_();
  if (!diizinkan_(email)) throw new Error('AKSES_DITOLAK: ' + (email || 'email tidak terbaca'));
  return email;
}
function hanyaPemilik_() {
  if (!pemilik_(emailPengguna_())) throw new Error('Fitur ini hanya untuk pemilik dashboard (' + [].concat(CONFIG.PEMILIK).join(', ') + ').');
}
function aman_(s) { return String(s).replace(/[<>&"]/g, ''); }
function halamanPesan_(judul, isi) {
  return HtmlService.createHtmlOutput(
    '<div style="font-family:system-ui,sans-serif;max-width:560px;margin:12vh auto;padding:24px;border:1px solid #e4d6da;border-radius:12px;color:#2a1419">' +
    '<h2 style="margin:0 0 8px;color:#7a1630">' + judul + '</h2><p style="line-height:1.55;color:#5c4a4f">' + isi + '</p></div>')
    .setTitle(CONFIG.JUDUL).addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ===================== Penelusuran folder ===================== */

function daftarFolder_(root) {
  const hasil = [{ folder: root, unit: '(Folder utama)' }];
  const it1 = root.getFolders();
  while (it1.hasNext()) {
    const f = it1.next();
    if (f.getName().charAt(0) === '_') continue;
    hasil.push({ folder: f, unit: f.getName() });
    const it2 = f.getFolders();
    while (it2.hasNext()) {
      const g = it2.next();
      if (g.getName().charAt(0) !== '_') hasil.push({ folder: g, unit: f.getName() + ' / ' + g.getName() });
    }
  }
  return hasil;
}
function daftarFile_(folder) {
  const files = [], it = folder.getFiles();
  while (it.hasNext()) { const f = it.next(); if (!f.isTrashed()) files.push(f); }
  return files;
}
function fileData_(f) {
  const mime = f.getMimeType();
  if (f.getName().charAt(0) === '_') return false;
  if (mime === SHEETS) return (f.getDescription() || '').indexOf(TANDA) !== 0; // versi konversi otomatis tidak dihitung dua kali
  return SUMBER.indexOf(mime) >= 0 || adalahTxt_(f);
}

/* ===================== Konversi & salinan ringkas (berjalan tiap 10 menit) ===================== */

function konversiOtomatis() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  const mulai = Date.now();
  try {
    const root = DriveApp.getFolderById(CONFIG.FOLDER_UTAMA);
    const cache = folderCache_(root);
    const folders = daftarFolder_(root);
    folders.forEach(function (fd) { konversiBesar_(fd.folder); });
    const idx = indeksCache_(cache);
    for (let i = 0; i < folders.length; i++) {
      if (Date.now() - mulai > BATAS_WAKTU_MS) break;
      buatCacheFolder_(folders[i], cache, idx, mulai);
    }
    bersihkanCache_(idx);
  } finally {
    lock.releaseLock();
  }
}

function namaDasar_(n) { return String(n).replace(/\.(xlsx|xlsm|xls|ods|csv)$/i, '').trim(); }

function konversiBesar_(folder) {
  const files = daftarFile_(folder);
  const sheets = files.filter(function (f) { return f.getMimeType() === SHEETS; });
  files.forEach(function (f) {
    if (SUMBER.indexOf(f.getMimeType()) < 0) return;
    if (f.getSize() <= CONFIG.BATAS_MB * 1024 * 1024) return;
    const nama = namaDasar_(f.getName());
    const tanda = TANDA + f.getId();
    const kembar = sheets.filter(function (s) { return s.getName().trim().toLowerCase() === nama.toLowerCase(); });
    const otomatis = kembar.filter(function (s) { return (s.getDescription() || '').indexOf(tanda) === 0; });
    if (kembar.length && !otomatis.length) return;
    if (otomatis.length && otomatis[0].getLastUpdated() >= f.getLastUpdated()) return;
    try {
      konversi_(f, folder.getId(), nama, tanda + ' | ' + new Date().toISOString());
      otomatis.forEach(function (s) { s.setTrashed(true); });
    } catch (e) {
      console.error('Gagal konversi ' + f.getName() + ': ' + e);
    }
  });
}

function konversi_(file, folderId, nama, deskripsi) {
  const meta = { name: nama, mimeType: SHEETS, parents: [folderId], description: deskripsi };
  const boundary = 'brawijaya' + Date.now();
  const head = Utilities.newBlob('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(meta) + '\r\n--' + boundary + '\r\nContent-Type: ' + file.getMimeType() + '\r\n\r\n').getBytes();
  const tail = Utilities.newBlob('\r\n--' + boundary + '--').getBytes();
  const payload = head.concat(file.getBlob().getBytes()).concat(tail);
  const res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true', {
    method: 'post', contentType: 'multipart/related; boundary=' + boundary, payload: payload,
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) throw new Error(res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  return JSON.parse(res.getContentText()).id;
}

function folderCache_(root) {
  const it = root.getFoldersByName(CONFIG.CACHE_NAMA);
  return it.hasNext() ? it.next() : root.createFolder(CONFIG.CACHE_NAMA);
}

function indeksCache_(cache) {
  const idx = {}, it = cache.getFiles();
  while (it.hasNext()) {
    const f = it.next();
    if (f.isTrashed()) continue;
    const m = /^(.+)\.json\.gz$/.exec(f.getName());
    if (m) idx[m[1]] = { file: f, desc: f.getDescription() || '', dipakai: false };
    else if (/^_sementara_/.test(f.getName())) f.setTrashed(true); // sisa konversi sementara yang gagal dihapus
  }
  return idx;
}

function buatCacheFolder_(fd, cache, idx, mulai) {
  const files = daftarFile_(fd.folder);
  files.forEach(function (f) {
    if (!fileData_(f)) return;
    const id = f.getId(), stamp = f.getLastUpdated().toISOString(), ada = idx[id];
    if (ada) ada.dipakai = true;
    if (ada && ada.desc.indexOf('diubah=' + stamp) >= 0) return;
    if (Date.now() - mulai > BATAS_WAKTU_MS) return;
    try {
      const sheets = bacaNilai_(f, files, cache);
      const json = JSON.stringify({ v: 1, sumber: { id: id, nama: f.getName(), unit: fd.unit, mime: f.getMimeType(), diubah: stamp }, dibuat: new Date().toISOString(), sheets: sheets });
      const gz = Utilities.gzip(Utilities.newBlob(json, 'application/json', id + '.json'), id + '.json.gz');
      if (ada) ada.file.setTrashed(true);
      const baru = cache.createFile(gz);
      baru.setDescription('sumber=' + id + '|diubah=' + stamp + '|unit=' + fd.unit + '|nama=' + f.getName());
      idx[id] = { file: baru, desc: baru.getDescription(), dipakai: true };
      console.log('Salinan ringkas: ' + fd.unit + ' / ' + f.getName());
    } catch (e) {
      console.error('Gagal membuat salinan ringkas ' + f.getName() + ': ' + e);
    }
  });
}

function bacaNilai_(f, filesSefolder, cache) {
  const mime = f.getMimeType();
  if (adalahTxt_(f)) return bacaTxt_(f);
  if (mime === 'text/csv') {
    const teks = f.getBlob().getDataAsString('UTF-8').replace(/^﻿/, '');
    const baris1 = teks.split(/\r?\n/)[0] || '';
    const pemisah = [',', ';', '\t', '|'].reduce(function (a, b) { return baris1.split(b).length > baris1.split(a).length ? b : a; }, ',');
    return [{ nama: 'Data', baris: Utilities.parseCsv(teks, pemisah) }];
  }
  if (mime === SHEETS) return bacaSpreadsheet_(f.getId());
  const kembar = filesSefolder.filter(function (s) { return s.getMimeType() === SHEETS && (s.getDescription() || '').indexOf(TANDA + f.getId()) === 0; });
  if (kembar.length && kembar[0].getLastUpdated() >= f.getLastUpdated()) return bacaSpreadsheet_(kembar[0].getId());
  const tmpId = konversi_(f, cache.getId(), '_sementara_' + f.getId(), 'sementara');
  try { return bacaSpreadsheet_(tmpId); }
  finally { DriveApp.getFileById(tmpId).setTrashed(true); }
}

/* ---------- File teks (.TXT), termasuk export E-Klaim INA-CBG/iDRG ---------- */
function adalahTxt_(f) { return /\.txt$/i.test(f.getName()) && /^text\//.test(f.getMimeType()); }

// Kolom E-Klaim yang disimpan. Identitas pasien (NAMA_PASIEN, NOKARTU, BIRTH_DATE, MRN, SEP, C1–C4)
// TIDAK disimpan. MRN diganti PASIEN_KODE: kode acak satu arah (berkunci rahasia di Properti skrip)
// yang hanya dipakai untuk menghitung rawat ulang, tidak bisa dikembalikan ke nomor RM.
const EKLAIM_SIMPAN = ['KELAS_RS', 'KELAS_RAWAT', 'KODE_TARIF', 'PTD', 'ADMISSION_DATE', 'DISCHARGE_DATE', 'BIRTH_WEIGHT', 'SEX',
  'DISCHARGE_STATUS', 'DIAGLIST', 'PROCLIST', 'ADL1', 'ADL2', 'INACBG', 'SUBACUTE', 'CHRONIC', 'SP', 'SR', 'SI', 'SD', 'DESKRIPSI_INACBG',
  'TARIF_INACBG', 'TARIF_SUBACUTE', 'TARIF_CHRONIC', 'TARIF_SP', 'TARIF_SR', 'TARIF_SI', 'TARIF_SD', 'TOTAL_TARIF', 'TARIF_RS',
  'TARIF_POLI_EKS', 'LOS', 'ICU_INDIKATOR', 'ICU_LOS', 'VENT_HOUR', 'UMUR_TAHUN', 'DPJP', 'PAYOR_ID', 'CODER_ID',
  'PROSEDUR_NON_BEDAH', 'PROSEDUR_BEDAH', 'KONSULTASI', 'TENAGA_AHLI', 'KEPERAWATAN', 'PENUNJANG', 'RADIOLOGI', 'LABORATORIUM',
  'PELAYANAN_DARAH', 'REHABILITASI', 'KAMAR_AKOMODASI', 'RAWAT_INTENSIF', 'OBAT', 'ALKES', 'BMHP', 'SEWA_ALAT', 'OBAT_KRONIS', 'OBAT_KEMO',
  'IDRG_DIAG_LISTS', 'IDRG_PROC_LISTS', 'IDRG_MDC_NUMBER', 'IDRG_MDC_DESCRIPTION', 'IDRG_DRG_CODE', 'IDRG_DRG_DESCRIPTION',
  'IDRG_COST_WEIGHT', 'IDRG_TOTAL_COST_WEIGHT', 'IDRG_TOTAL_TARIF'];
const EKLAIM_ANGKA = /^(TARIF_|TOTAL_TARIF|LOS|ICU_|VENT_|UMUR_|BIRTH_WEIGHT|PROSEDUR_|KONSULTASI|TENAGA_AHLI|KEPERAWATAN|PENUNJANG|RADIOLOGI|LABORATORIUM|PELAYANAN_DARAH|REHABILITASI|KAMAR_|RAWAT_INTENSIF|OBAT|ALKES|BMHP|SEWA_ALAT|IDRG_.*(WEIGHT|TARIF))/;

function kunciRahasia_() {
  const p = PropertiesService.getScriptProperties();
  let k = p.getProperty('KUNCI_KODE_PASIEN');
  if (!k) { k = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('KUNCI_KODE_PASIEN', k); }
  return k;
}
function kodePasien_(mrn, kunci) {
  if (!mrn) return '';
  const b = Utilities.computeHmacSha256Signature(String(mrn).trim(), kunci);
  return b.slice(0, 6).map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function tglIso_(v) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v || '').trim());
  return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : String(v || '');
}
function bacaTxt_(f) {
  const teks = f.getBlob().getDataAsString('UTF-8').replace(/^\uFEFF/, '');
  const baris = teks.split(/\r?\n/).filter(function (l) { return l.replace(/\s/g, '') !== ''; });
  if (!baris.length) return [{ nama: 'Data', baris: [] }];
  const H = baris[0].split('\t').map(function (x) { return String(x).trim().toUpperCase(); });
  if (H.indexOf('INACBG') < 0 || H.indexOf('TARIF_RS') < 0) {
    // Bukan E-Klaim: simpan apa adanya (dipisah TAB bila ada, selain itu koma)
    const pem = baris[0].indexOf('\t') >= 0 ? '\t' : ',';
    return [{ nama: 'Data', baris: baris.map(function (l) { return l.split(pem); }) }];
  }
  const kunci = kunciRahasia_(), iMrn = H.indexOf('MRN');
  const pakai = EKLAIM_SIMPAN.map(function (k) { return H.indexOf(k); });
  const out = [EKLAIM_SIMPAN.concat(['PASIEN_KODE'])];
  for (let r = 1; r < baris.length; r++) {
    const row = baris[r].split('\t');
    out.push(pakai.map(function (i, j) {
      const k = EKLAIM_SIMPAN[j];
      let v = i < 0 || row[i] == null ? '' : String(row[i]).trim();
      if (k === 'CODER_ID') return v.split(';')[0];
      if (k === 'ADMISSION_DATE' || k === 'DISCHARGE_DATE') return tglIso_(v);
      if (EKLAIM_ANGKA.test(k)) { const n = Number(v.replace(',', '.')); return isFinite(n) && v !== '' ? n : (v === '' ? 0 : v); }
      return v === 'None' || v === '-' ? '' : v;
    }).concat([kodePasien_(iMrn >= 0 ? row[iMrn] : '', kunci)]));
  }
  return [{ nama: 'E-Klaim', baris: out }];
}

function bacaSpreadsheet_(id) {
  const ss = SpreadsheetApp.openById(id);
  const tz = ss.getSpreadsheetTimeZone();
  return ss.getSheets().map(function (sh) {
    const rg = sh.getDataRange();
    const nilai = rg.getValues(), tampil = rg.getDisplayValues();
    const baris = nilai.map(function (row, r) {
      return row.map(function (v, c) {
        const t = tampil[r][c];
        if (v instanceof Date) return Utilities.formatDate(v, tz, (v.getHours() || v.getMinutes()) ? 'yyyy-MM-dd HH:mm' : 'yyyy-MM-dd');
        if (typeof v === 'number') return /%\s*$/.test(t) ? t : v;
        if (v === '' || v === null) return '';
        return String(v);
      });
    });
    while (baris.length && baris[baris.length - 1].every(function (x) { return x === ''; })) baris.pop();
    return { nama: sh.getName(), baris: baris };
  });
}

function bersihkanCache_(idx) {
  Object.keys(idx).forEach(function (k) {
    if (idx[k].dipakai) return;
    try { if (DriveApp.getFileById(k).isTrashed()) idx[k].file.setTrashed(true); }
    catch (e) { idx[k].file.setTrashed(true); }
  });
}

/* ===================== Uji dari editor ===================== */

/** Pilih "cekSistem" lalu Run. Hasilnya di Execution log. Tidak ada yang diubah. */
function cekSistem() {
  try {
    const t = ambilTampilan_();
    Logger.log('Tampilan dashboard: ' + t.sumber + ' (' + t.html.length + ' karakter) — ' + (t.html.indexOf(VERSI) >= 0 ? 'LENGKAP' : 'TIDAK LENGKAP'));
  } catch (e) {
    Logger.log('Tampilan dashboard tidak ditemukan: ' + e);
  }
  const k = JSON.parse(getKatalog());
  Logger.log('Dibuka oleh: ' + (k.email || '(email tidak terbaca)') + (k.pemilik ? ' — PEMILIK' : ''));
  Logger.log('File data: ' + k.file.length);
  k.file.forEach(function (f) { Logger.log('  [' + f.unit + '] ' + f.nama + ' — ' + (f.terbaru ? 'siap' : f.siap ? 'salinan lama, menunggu diperbarui' : 'menunggu diproses')); });
  const trig = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'konversiOtomatis'; }).length;
  Logger.log('Pemicu otomatis 10 menit: ' + (trig ? 'AKTIF' : 'BELUM AKTIF — jalankan fungsi aktifkan'));
}
