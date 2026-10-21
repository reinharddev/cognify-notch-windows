# Cognify Notch untuk Windows (Beta)

Notch di tengah atas layar Windows: pil kecil yang membesar menjadi panel saat kursor mendekat.
Ini versi Windows dari Cognify Notch (macOS). Semua fitur yang bisa dipindah sudah ditulis, tetapi
belum pernah dijalankan di Windows; status tiap fitur ada di [docs/FITUR.md](docs/FITUR.md).

## Teknologi

Tauri 2 (Rust) dan Svelte 5. Jendela transparan selebar panel terbuka, selalu di atas, dan tembus
klik saat notch diam. Rust membaca posisi kursor dan memberi tahu antarmuka saat kursor masuk atau
keluar dari bentuk notch.

## Menjalankan

Di Windows (butuh Node 22 dan Rust):

```bash
npm install
npm run tauri -- dev
```

Hanya tampilan, di browser biasa (hover memakai pointer, tanpa Rust):

```bash
npm run dev
```

## Membangun installer

Installer dibangun oleh GitHub Actions di server Windows (`.github/workflows/build.yml`), lalu
diunduh dari halaman Actions. Di Windows sendiri: `npm run tauri -- build`, hasilnya
`src-tauri/target/release/bundle/nsis/`.

Installer belum ditandatangani, jadi Windows menampilkan peringatan SmartScreen: klik More info,
lalu Run anyway.

## Lisensi

[AGPL-3.0](LICENSE).
