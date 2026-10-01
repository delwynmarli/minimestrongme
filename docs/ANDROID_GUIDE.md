# Panduan Android — MiniMe StrongMe

Panduan pemula untuk membangun, menguji, dan merilis aplikasi Android dari game web ini
(Vite + TypeScript + Canvas, dibungkus Capacitor).

---

## 0. Yang sudah dipasang di proyek

- Capacitor: `@capacitor/core`, `@capacitor/android`, `@capacitor/app`, `@capacitor/haptics`, `@capacitor/status-bar`.
- Alat dev: `@capacitor/cli`, `@capacitor/assets`.
- Konfigurasi: `capacitor.config.ts` → appId `com.minimestrongme.app`, appName `MiniMe StrongMe`, webDir `dist`.
- Android:
  - Orientasi terkunci **portrait** (`android/app/src/main/AndroidManifest.xml`).
  - **Hardware acceleration** aktif.
  - **Fullscreen immersive** (status bar + navigation bar disembunyikan) dan **layar tetap menyala** (`MainActivity.java`).
  - Tombol **Back** membuka/menutup **Pause** (di luar gameplay → aplikasi di-minimize, bukan ditutup).
  - **Getar** saat player kena damage & boss mati — hanya jika setting **VIBRATION** di game menyala.
  - Ikon & splash sudah dibuat (`android/app/src/main/res/...`).

Skrip npm:
- `npm run build:android` → build web (`dist/`) lalu `cap sync` (salin ke Android).
- `npm run open:android` → buka Android Studio.

> Setiap kali mengubah kode game, jalankan `npm run build:android` sebelum build/run Android,
> supaya file web terbaru ikut tersalin.

---

## 1. Alat yang perlu dipasang

1. **Android Studio** (gratis): https://developer.android.com/studio
   - Android Studio sudah membawa **JDK** sendiri (tidak perlu install JDK terpisah untuk mayoritas kasus).
2. Saat pertama buka, biarkan Android Studio mengunduh **Android SDK** + **Platform Tools** (untuk `adb`).
3. (Opsional) Pastikan Java dikenali:
   - Buka terminal baru, jalankan: `java -version`
   - Kalau "tidak dikenal", arahkan `JAVA_HOME` ke JDK bawaan Android Studio,
     mis. `C:\Program Files\Android\Android Studio\jbr`.

---

## 2. Menjalankan di HP asli (USB debugging)

1. Di HP: **Settings → About phone → ketuk "Build number" 7x** → Developer Options aktif.
2. **Settings → Developer options → aktifkan "USB debugging"**.
3. Sambungkan HP ke PC pakai kabel USB. Di HP muncul dialog **"Allow USB debugging?"** → **Allow**.
4. Cek koneksi (adb ada di Android Studio `platform-tools`):
   ```powershell
   adb devices
   ```
   Kalau HP muncul dengan status `device`, berarti siap.
5. Jalankan aplikasi:
   - Cara mudah: `npm run build:android` lalu `npm run open:android`, tunggu Android Studio selesai
     "Gradle sync", pilih perangkat HP di dropdown, klik tombol **Run** (▶).
   - Cara terminal:
     ```powershell
     cd android
     .\gradlew installDebug
     ```

---

## 3. Menjalankan di emulator (opsional)

- Android Studio → **Device Manager → Create Device** → pilih profil HP (mis. Pixel) → ikuti wizard.
- Jalankan dari Android Studio (tombol Run) seperti biasa.

---

## 4. Membuat keystore (kunci tanda tangan rilis)

Keystore = "kunci" untuk menandatangani aplikasi sebelum rilis. **Simpan baik-baik dan jangan hilang**
(kalau hilang, kamu tak bisa memperbarui aplikasi di Google Play).

`keytool` ada di JDK bawaan Android Studio, mis.:
`C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe`

Jalankan (ganti `namamu` sesuai keinginan):
```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkey -v `
  -keystore android/minimestrongme.keystore `
  -alias minimestrongme -keyalg RSA -keysize 2048 -validity 10000
```
- Kamu akan diminta membuat **password** dan mengisi data (nama, organisasi, negara). Catat password-nya.
---

## 5. Membangun APK/AAB release bertanda tangan

Cara pemula (paling aman): **Android Studio wizard**.
1. `npm run build:android`
2. `npm run open:android`
3. Menu **Build → Generate Signed Bundle / APK…**
4. Pilih **Android App Bundle** (untuk Google Play) atau **APK** (untuk instal manual).
5. Pilih keystore yang dibuat di langkah 4, isi password & alias → **Next** → pilih **release** → **Create/Finish**.
6. Hasilnya di `android/app/release/` (`.aab` atau `.apk`).

Cara terminal (opsional, lebih lanjut):
```powershell
cd android
.\gradlew bundleRelease     # menghasilkan AAB di android/app/build/outputs/bundle/release/
.\gradlew assembleRelease   # menghasilkan APK di android/app/build/outputs/apk/release/
```
Untuk build release via terminal, isi `signingConfigs` di `android/app/build.gradle`
(atau set lewat variabel), lalu update `buildTypes.release`. Wizard di atas membuat ini otomatis.

---

## 6. Yang perlu disiapkan untuk Google Play

1. **Akun Google Play Developer** (bayar sekali, ~$25).
2. **App ID unik**: `com.minimestrongme.app` dipakai untuk uji coba. Untuk rilis, sebaiknya pakai
   domain yang kamu miliki (mis. `com.namamu.minimestrongme`). App ID **tidak bisa diganti** setelah dipublikasikan.
3. **Kebijakan Privasi (Privacy Policy)** — wajib punya URL.
   - Game ini menyimpan skor terbaik secara **lokal di perangkat** (localStorage) dan **tidak** mengirim data ke server.
   - Buat halaman kebijakan privasi sederhana (mis. di GitHub Pages) yang menyatakan hal itu.
4. **Data Safety** & **Content Rating** — kuesioner di Play Console (IARC). Isi sesuai kenyataan.
5. **Grafis wajib**:
   - Ikon 512×512 (PNG).
   - **Feature graphic** 1024×500.
   - **Minimal 2 screenshot** HP (potret). Ambil dari HP asli/emulator.
6. **Deskripsi** singkat & panjang, kategori, tag.
7. **Play App Signing**: aktifkan (Google menyimpan kunci rilis) — dianjurkan.
8. **Target API level**: Play mewajibkan target API versi terbaru/tertentu; Capacitor versi baru sudah
   menargetkan API yang sesuai. Update bila Play Console memperingatkan.
9. **Uji tertutup (closed test)**: akun developer perorangan baru biasanya wajib uji tertutup
   dengan sejumlah tester selama beberapa hari sebelum bisa rilis ke publik. Ikuti instruksi Play Console.

---

## 7. Panduan uji performa di HP asli (target 60 FPS, tidak stutter saat boss)

1. Aktifkan overlay FPS di game: buka `src/game/config.ts`, set `debug: { showFps: true, ... }`,
   lalu `npm run build:android`.
2. Jalankan di HP asli (bukan emulator). Perhatikan angka **FPS** dan **Q** (level kualitas) kanan-atas:
   - `Q0` = kualitas penuh. Kalau FPS drop < 45 (2 detik), game otomatis menurunkan ke `Q1..Q3`
     (mengurangi partikel, mematikan glow additive, mematikan motion-blur bilah, mengganti kepingan pecah).
   - Kalau FPS pulih > 58, level naik lagi.
3. Uji skenario berat:
   - Tunggu **wave boss** (wave 5 & 10) — banyak efek ledakan/petir.
   - Atau set `debug.enemyStress: 100` untuk memaksa 100 musuh di layar.
4. Jika HP masih berat di `Q3`:
   - Matikan efek mahal lewat `config.fx`: `shadows: false`, `lighting: false`, `ambient: false`,
     `hopAnim: false`, `decor: false`, `slash: false`, `bladeBlur: false`, `shards: false`.
   - Turunkan `fx.ambientCount` dan `fx.particles.max`.
5. Tips: tutup aplikasi lain, matikan mode hemat baterai, uji dengan layar 60 Hz (beberapa HP 120 Hz
   bisa menampilkan angka tak stabil). Untuk hasil paling akurat, pakai **Chrome Remote Debugging**
   (`chrome://inspect`) atau **Android Studio Profiler** sambil memainkan boss.

---

## 8. Perintah harian (ringkas)

```powershell
npm run dev              # main di browser (mode HP)
npm run build:android    # build web + salin ke Android
npm run open:android     # buka Android Studio
```

---

## 9. Catatan penting

- **Jangan commit** file keystore (`.keystore`/`.jks`), password, atau folder build ke repositori publik.
- Kalau `@capacitor/assets` gagal karena npm memblokir *install script* native, jalankan
  `npm approve-scripts --allow-scripts-pending` (atau `npm rebuild sharp`) lalu ulangi generate.
- Setiap mengubah web (`src/`), wajib `npm run build:android` sebelum build Android.

