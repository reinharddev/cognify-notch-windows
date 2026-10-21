# Peta fitur: Mac ke Windows

Sumber: versi Mac di `notch/`.

Arti status:
- **selesai di browser**: logika dan tampilan sudah dicoba di browser (`npm run dev`); tidak butuh Windows.
- **ditulis**: kodenya ada dan lolos pemeriksaan tipe (kode Windows diperiksa untuk target `x86_64-pc-windows-msvc`), tetapi belum pernah dijalankan di Windows. Dianggap belum terbukti sampai dicoba di Windows 11.
- **belum**: belum dikerjakan.

Catatan teknis: "Equalizer" mengikuti keras suara keluar (peak meter Windows), bukan spektrum per frekuensi seperti di Mac.
Sinkron Pengingat Apple dan Siri Shortcuts tidak ada di Windows: Daftar tugas hanya lokal, Pintasan dibuat sendiri.

| Fitur | Cara di Windows | Catatan | Status |
|---|---|---|---|
| Notch, hover, 11 halaman | Jendela Tauri transparan, kursor dibaca Rust | Windows tidak punya notch fisik, jadi bentuknya pil di tengah atas | ditulis |
| Musik dan sampul | Windows media session (SMTC), lewat crate `windows` | Spotify, browser, VLC, dan lainnya terbaca | ditulis |
| Lirik tersinkron | LRCLIB, sama dengan Mac | Hanya butuh internet | ditulis |
| Equalizer mengikuti suara | WASAPI loopback | Tanpa izin tambahan | ditulis |
| Agenda dan tombol Gabung | Sumber kalender perlu dipilih | Windows tidak punya Calendar API bersama; usulan: Outlook atau tautan ICS | belum |
| Catatan cepat, kalkulator, konversi | Portabel (TypeScript) | Port `Calc.swift` | selesai di browser |
| Rekam suara jadi catatan | Pengenalan ucapan Windows | Perlu uji bahasa Indonesia | belum |
| Pomodoro, Stopwatch, Timer | Portabel | Port `Timers.swift` | selesai di browser |
| Pengingat Minum | Portabel, notifikasi Windows |  | selesai di browser |
| Daftar tugas | Portabel | Sinkron ke Pengingat Apple tidak ada di Windows | selesai di browser |
| Clipboard | Pendengar clipboard Windows | Lewati isi pengelola kata sandi (format clipboard yang dikecualikan) | ditulis |
| Tray file | Seret dan lepas Tauri |  | ditulis |
| Cermin | `getUserMedia` di webview | Izin kamera Windows | ditulis |
| Pintasan | Tidak ada padanan Siri Shortcuts | Usulan: pintasan yang ditentukan pengguna (buka app, tautan) | ditulis |
| Kabar: charger dan baterai | Windows power status |  | ditulis |
| Kabar: AirPods dan headphone | Hanya nama perangkat Bluetooth | Baterai belum tentu terbaca | ditulis (nama perangkat suara) |
| Kabar: unduhan | Pantau folder Downloads |  | ditulis |
| Kabar: Caps Lock, bahasa keyboard | Hook keyboard Windows |  | ditulis |
| Kabar: internet putus | Status jaringan Windows |  | ditulis |
| Volume dan kecerahan | Pantau volume (WASAPI), kecerahan lewat WMI | Kecerahan hanya di laptop | volume ditulis; kecerahan belum |
| Sembunyi saat layar penuh | Deteksi jendela layar penuh |  | ditulis |
| Cuaca | Open-Meteo, sama dengan Mac | Mati bawaan | selesai di browser |
| Buka saat Windows dinyalakan | Registry Run (build GitHub) atau StartupTask (build Store) |  | ditulis |
| Update otomatis | Pengecek versi dari Releases (build GitHub); tidak ada di build Store |  | ditulis (cek versi, buka halaman unduh) |
| Output suara | Versi Store: tombol ke pengaturan suara Windows | API pengganti output tidak resmi (kebijakan Store 10.2.8) | belum |

Dua build dari kode yang sama: build GitHub (installer NSIS, ada updater, tanpa signing atau
SignPath) dan build Store (MSIX, tanpa updater, startup lewat StartupTask).
