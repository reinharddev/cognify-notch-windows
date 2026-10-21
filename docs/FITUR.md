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
| Musik dan sampul | Windows media session (SMTC), lewat crate `windows` | Spotify, browser, VLC, dan lainnya terbaca | teruji di Windows 11 (Spotify) |
| Lirik tersinkron | LRCLIB, sama dengan Mac | Hanya butuh internet | ditulis |
| Equalizer mengikuti suara | WASAPI loopback | Tanpa izin tambahan | ditulis |
| Agenda dan tombol Gabung | Kalender ICS (tautan rahasia Google Calendar atau Outlook, atau file .ics); tombol Gabung 10 menit sebelum acara; pengingat 5 menit sebelumnya | Windows tidak punya Calendar API bersama. Permintaan internet hanya ke tautan yang kamu ketik, tiap 15 menit. Pengulangan sederhana saja (harian, mingguan, bulanan, tahunan) | ditulis |
| Catatan cepat, kalkulator, konversi | Portabel (TypeScript) | Port `Calc.swift` | selesai di browser |
| Rekam suara jadi catatan | Tidak dikerjakan | Pengenalan ucapan bawaan Windows mengirim suara ke server Microsoft. Versi Mac sengaja hanya di perangkat; tanpa model offline yang bisa dibundel, fitur ini ditunda daripada melanggar prinsip itu | ditunda |
| Pomodoro, Stopwatch, Timer | Portabel | Port `Timers.swift` | selesai di browser |
| Pengingat Minum | Portabel, notifikasi Windows |  | selesai di browser |
| Daftar tugas | Portabel | Sinkron ke Pengingat Apple tidak ada di Windows | selesai di browser |
| Clipboard | Pendengar clipboard Windows | Lewati isi pengelola kata sandi (format clipboard yang dikecualikan) | ditulis |
| Tray file | Tempel file dari File Explorer (Ctrl+C lalu Ctrl+V) dan pemilih file; seret file belum jalan | Windows menolak drop di jendela notch (kursor tanda larangan); sebab belum ditemukan | tempel dan pilih file teruji di Windows 11; seret belum jalan |
| Cermin | `getUserMedia` di webview | Izin kamera Windows | ditulis |
| Pintasan keyboard membuka notch | Ctrl+Alt+N bawaan (bisa diganti di Pengaturan); tekan lagi atau Esc untuk menutup, panah untuk ganti halaman | Pintasan global lewat plugin Tauri | ditulis |
| Pintasan | Tidak ada padanan Siri Shortcuts | Usulan: pintasan yang ditentukan pengguna (buka app, tautan) | ditulis |
| Kabar: charger dan baterai | Windows power status |  | ditulis |
| Kabar: AirPods dan headphone | Hanya nama perangkat Bluetooth | Baterai belum tentu terbaca | ditulis (nama perangkat suara) |
| Kabar: unduhan | Pantau folder Downloads |  | ditulis |
| Kabar: Caps Lock, bahasa keyboard | Hook keyboard Windows |  | ditulis |
| Kabar: internet putus | Status jaringan Windows |  | ditulis |
| Volume dan kecerahan | Volume lewat WASAPI, kecerahan lewat WMI (laptop); perubahan tampil sebagai kabar di pil | Di PC desktop tidak ada kabar kecerahan | ditulis |
| Sembunyi saat layar penuh | Deteksi jendela layar penuh |  | ditulis |
| Cuaca | Open-Meteo, sama dengan Mac | Mati bawaan | selesai di browser |
| Buka saat Windows dinyalakan | Registry Run (build GitHub) atau StartupTask (build Store) |  | ditulis |
| Update otomatis | Pengecek versi dari Releases (build GitHub); tidak ada di build Store |  | ditulis (cek versi, buka halaman unduh) |
| Output suara | Tombol Output di halaman Musik membuka pengaturan suara Windows | API pengganti output tidak resmi (kebijakan Store 10.2.8) | selesai |
| Pengaturan | Jendela sendiri (bukan di dalam notch): tampilan, umum, fitur, kota dan kalender, pembaruan; terbuka dari tombol gigi atau menu tray | Notch sempit dan menutup saat kursor menjauh. Perubahan dibagikan ke jendela notch lewat penyimpanan bersama dan peristiwa `prefs-changed` | diuji di browser (`?w=settings`); jendela Tauri belum diuji di Windows |
| Lebar notch saat tertutup | Slider 70 sampai 200 px (bawaan 130); sayap musik selalu 80 px lebih lebar; panel terbuka tidak berubah | Windows tidak punya poni, jadi pil lebar menutupi tab browser | diuji di browser |
| Ikon tray | Klik kiri menyembunyikan atau menampilkan notch; menu klik kanan: sembunyikan/tampilkan, Pengaturan, Keluar | Status sembunyi tidak disimpan; setelah app dibuka ulang notch tampil lagi. Bersama "sembunyi saat layar penuh": tampil hanya bila keduanya tidak menyembunyikan | cek kompilasi lolos; belum diuji di Windows |

Dua build dari kode yang sama: build GitHub (installer NSIS, ada updater, tanpa signing atau
SignPath) dan build Store (MSIX, tanpa updater, startup lewat StartupTask).
