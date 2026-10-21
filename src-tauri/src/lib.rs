//! Cognify Notch untuk Windows. Satu jendela transparan selebar panel terbuka, menempel di
//! tengah atas layar utama. Saat diam jendela ini tembus klik (set_ignore_cursor_events), jadi
//! tidak menghalangi app lain; Rust membaca posisi kursor dan memberi tahu antarmuka (Svelte)
//! saat kursor masuk atau keluar dari bentuk notch yang sedang tampil.
//!
//! Semua yang bicara langsung dengan Windows ada di `winsys`; file ini hanya menyambungkannya
//! ke antarmuka lewat perintah dan peristiwa.

mod updater;
mod winsys;

use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, PhysicalPosition, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Bentuk notch yang sedang tampil, dalam piksel CSS relatif terhadap sudut kiri atas jendela.
#[derive(Clone, Copy, Default, Deserialize, Serialize)]
struct HitRect {
    x: f64,
    y: f64,
    w: f64,
    h: f64,
}

#[derive(Default)]
struct Shared {
    rect: Mutex<HitRect>,
    clipboard_on: AtomicBool,
    hide_fullscreen: AtomicBool,
    /// Dibuka lewat pintasan keyboard: tetap terbuka walau kursor di luar.
    pinned: AtomicBool,
    /// Disembunyikan lewat ikon tray. Hanya berlaku selama app berjalan.
    user_hidden: AtomicBool,
    /// App layar penuh sedang tampil dan "sembunyi saat layar penuh" menyala.
    covered: AtomicBool,
    /// Ada lagu yang sedang diputar (dari pemantau media). Pemantau lain bekerja lebih jarang saat tidak ada musik.
    playing: AtomicBool,
}

/// Jendela notch tampil bila tidak disembunyikan pengguna dan tidak tertutup app layar penuh.
fn sync_visibility(app: &AppHandle, window: &WebviewWindow) {
    let s = app.state::<Shared>();
    let visible = !s.user_hidden.load(Ordering::Relaxed) && !s.covered.load(Ordering::Relaxed);
    let _ = if visible { window.show() } else { window.hide() };
}

/// Buka jendela Pengaturan (atau bawa ke depan bila sudah terbuka). Pengaturan ada di jendela sendiri,
/// bukan di dalam notch, karena notch sempit dan hilang saat kursor menjauh.
#[tauri::command]
fn open_settings(app: AppHandle) {
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(&app, "settings", WebviewUrl::App("index.html".into()))
        .title("Pengaturan Cognify Notch")
        .inner_size(640.0, 740.0)
        .min_inner_size(520.0, 480.0)
        .center()
        .initialization_script("window.__CN_WINDOW__ = 'settings';")
        .build();
}

/// Antarmuka melaporkan ukuran notch tiap kali bentuknya berubah.
#[tauri::command]
fn set_hit_rect(state: State<Shared>, rect: HitRect) {
    *state.rect.lock().unwrap() = rect;
}

#[tauri::command]
fn set_pinned(state: State<Shared>, window: WebviewWindow, on: bool) {
    state.pinned.store(on, Ordering::Relaxed);
    let _ = window.set_ignore_cursor_events(!on);
    if on {
        let _ = window.set_focus();
    }
}

/// Pintasan keyboard global untuk membuka notch. `choice` kosong atau tidak dikenal = mati.
#[tauri::command]
fn set_hotkey(app: AppHandle, choice: String) {
    let gs = app.global_shortcut();
    let _ = gs.unregister_all();
    let (mods, code) = match choice.as_str() {
        "ctrl_alt_n" => (Modifiers::CONTROL | Modifiers::ALT, Code::KeyN),
        "ctrl_alt_space" => (Modifiers::CONTROL | Modifiers::ALT, Code::Space),
        "alt_space" => (Modifiers::ALT, Code::Space),
        "ctrl_shift_n" => (Modifiers::CONTROL | Modifiers::SHIFT, Code::KeyN),
        _ => return,
    };
    let result = gs.on_shortcut(Shortcut::new(Some(mods), code), |app, _, event| {
        if event.state() == ShortcutState::Pressed {
            let _ = app.emit("hotkey", ());
        }
    });
    let _ = result;
}

/// Isi kalender dari tautan ICS (Google Calendar, Outlook, dan lainnya). Hanya https, dan hanya
/// tautan yang diketik pengguna; tidak ada yang dikirim selain permintaan itu sendiri.
#[tauri::command]
async fn fetch_text(url: String) -> Result<String, String> {
    let url = url.trim().replacen("webcal://", "https://", 1);
    if !url.starts_with("https://") {
        return Err("Tautan harus diawali https://".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let agent: ureq::Agent = ureq::Agent::config_builder().timeout_global(Some(Duration::from_secs(20))).build().into();
        agent
            .get(&url)
            .call()
            .map_err(|e| e.to_string())?
            .body_mut()
            .with_config()
            .limit(3_000_000)
            .read_to_string()
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Membaca file kalender .ics yang dipilih pengguna.
#[tauri::command]
fn read_ics_file(path: String) -> Result<String, String> {
    if !path.to_lowercase().ends_with(".ics") {
        return Err("Pilih file berekstensi .ics".into());
    }
    let meta = std::fs::metadata(&path).map_err(|e| e.to_string())?;
    if meta.len() > 3_000_000 {
        return Err("File terlalu besar".into());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_target(target: String) {
    winsys::open_target(&target);
}

#[tauri::command]
fn reveal(path: String) {
    winsys::reveal(&path);
}

/// Dari daftar letak file, yang masih ada.
#[tauri::command]
fn existing_paths(paths: Vec<String>) -> Vec<String> {
    paths.into_iter().filter(|p| Path::new(p).exists()).collect()
}

#[tauri::command]
fn set_clipboard_watch(state: State<Shared>, on: bool) {
    state.clipboard_on.store(on, Ordering::Relaxed);
}

#[tauri::command]
fn set_hide_fullscreen(state: State<Shared>, on: bool) {
    state.hide_fullscreen.store(on, Ordering::Relaxed);
}

#[tauri::command]
fn clip_files() -> Vec<String> {
    winsys::clipboard_files()
}

#[tauri::command]
fn clip_set_text(text: String) {
    winsys::clipboard_set_text(&text);
}

#[tauri::command]
fn clip_set_image(data: String) {
    winsys::clipboard_set_image(&data);
}

#[tauri::command]
fn media_cmd(action: String) {
    std::thread::spawn(move || {
        winsys::init_thread();
        winsys::media_command(&action);
    });
}

#[tauri::command]
fn media_seek(seconds: f64) {
    std::thread::spawn(move || {
        winsys::init_thread();
        winsys::media_seek(seconds);
    });
}

#[tauri::command]
fn set_volume(value: f32) {
    std::thread::spawn(move || {
        winsys::init_thread();
        winsys::set_volume(value);
    });
}

#[tauri::command]
fn update_supported() -> bool {
    updater::supported()
}

#[tauri::command]
async fn update_check(state: State<'_, updater::Pending>) -> Result<Option<String>, String> {
    let pending = state.inner().clone_handle();
    tauri::async_runtime::spawn_blocking(move || updater::check(&pending)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn update_download(state: State<'_, updater::Pending>) -> Result<(), String> {
    let pending = state.inner().clone_handle();
    tauri::async_runtime::spawn_blocking(move || updater::download(&pending)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
async fn update_apply(state: State<'_, updater::Pending>) -> Result<(), String> {
    let pending = state.inner().clone_handle();
    tauri::async_runtime::spawn_blocking(move || updater::apply(&pending)).await.map_err(|e| e.to_string())?
}

#[tauri::command]
fn autostart_get(app: AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn autostart_set(app: AppHandle, on: bool) {
    let launcher = app.autolaunch();
    let _ = if on { launcher.enable() } else { launcher.disable() };
}

/// Letakkan jendela di tengah atas layar utama.
fn dock(window: &WebviewWindow) -> tauri::Result<()> {
    if let Some(monitor) = window.primary_monitor()? {
        let size = window.outer_size()?;
        let origin = monitor.position();
        let x = origin.x + (monitor.size().width as i32 - size.width as i32) / 2;
        window.set_position(PhysicalPosition::new(x, origin.y))?;
    }
    Ok(())
}

/// Memeriksa posisi kursor. Seberapa sering bergantung pada jaraknya ke notch: jauh = 20 kali per detik,
/// dekat (±120 px di sekitar notch) atau di dalamnya = 125 kali per detik supaya notch bereaksi hampir
/// seketika, dan saat notch disembunyikan = 4 kali per detik. Hanya saat status masuk/keluar berubah,
/// jendela diubah antara tembus klik dan menerima klik, dan antarmuka diberi tahu.
fn watch_cursor(app: AppHandle, window: WebviewWindow) {
    std::thread::spawn(move || {
        let mut inside = false;
        let mut wait = 50u64;
        loop {
            std::thread::sleep(Duration::from_millis(wait));
            let shared = app.state::<Shared>();
            if shared.user_hidden.load(Ordering::Relaxed) || shared.covered.load(Ordering::Relaxed) {
                wait = 250;
                continue;
            }
            let (Ok(cursor), Ok(origin), Ok(scale)) =
                (window.cursor_position(), window.outer_position(), window.scale_factor())
            else {
                continue;
            };
            let rect = *shared.rect.lock().unwrap();
            let x = (cursor.x - origin.x as f64) / scale;
            let y = (cursor.y - origin.y as f64) / scale;
            let pinned = shared.pinned.load(Ordering::Relaxed);
            let now = pinned || rect.w > 0.0 && x >= rect.x && x <= rect.x + rect.w && y >= 0.0 && y <= rect.y + rect.h;
            let near = now || (rect.w > 0.0 && x >= rect.x - 120.0 && x <= rect.x + rect.w + 120.0 && y <= rect.y + rect.h + 100.0);
            wait = if near { 8 } else { 50 };
            if now != inside {
                inside = now;
                let _ = window.set_ignore_cursor_events(!now);
                let _ = app.emit("notch-hover", now);
            }
        }
    });
}

/// Keadaan perangkat: suara, baterai, keyboard, internet, layar penuh. Hanya mengirim saat berubah.
/// Tiap jenis dibaca menurut jadwalnya sendiri, dan putaran dasarnya melambat saat tidak ada musik
/// (pengukur keras suara hanya berguna untuk equalizer).
fn watch_system(app: AppHandle, window: WebviewWindow) {
    std::thread::spawn(move || {
        winsys::init_thread();
        let (mut level, mut volume, mut power, mut caps, mut layout, mut output) = (0.0f32, None, None, false, None, None);
        let (mut online, mut covered) = (true, false);
        let mut brightness = (winsys::BrightnessReader::new(), None::<u8>);
        let start = Instant::now();
        let (mut next_keys, mut next_bright, mut next_slow) = (start, start, start);
        let mut bright_fast_until = start;
        let mut bright_misses = 0u32;
        loop {
            let playing = app.state::<Shared>().playing.load(Ordering::Relaxed);
            std::thread::sleep(Duration::from_millis(if playing { 100 } else { 250 }));
            let now_t = Instant::now();

            if playing {
                let now = winsys::peak();
                if (now - level).abs() > 0.03 || (now == 0.0 && level != 0.0) {
                    level = now;
                    let _ = app.emit("level", now);
                }
            } else if level != 0.0 {
                level = 0.0;
                let _ = app.emit("level", 0.0f32);
            }

            if now_t >= next_keys {
                next_keys = now_t + Duration::from_millis(500);
                let v = winsys::volume();
                if v != volume {
                    if let Some(v) = &v {
                        let _ = app.emit("volume", v);
                    }
                    volume = v;
                }
                let c = winsys::caps_lock();
                if c != caps {
                    caps = c;
                    let _ = app.emit("caps", c);
                }
                let l = winsys::keyboard_lang();
                if l != layout {
                    if let Some(l) = &l {
                        let _ = app.emit("layout", l);
                    }
                    layout = l;
                }
            }

            // Kecerahan lewat WMI itu mahal. Diam: tiap 1,5 detik; 3 detik setelah berubah: tiap 0,3 detik
            // supaya bar mengikuti tombol; PC tanpa layar yang bisa diatur (desktop): tiap 20 detik.
            if now_t >= next_bright {
                let b = brightness.0.read();
                let mut fast = now_t < bright_fast_until;
                if b != brightness.1 {
                    if brightness.1.is_some() {
                        bright_fast_until = now_t + Duration::from_secs(3);
                        fast = true;
                    }
                    if let Some(b) = b {
                        let _ = app.emit("brightness", b);
                    }
                    brightness.1 = b;
                }
                bright_misses = if b.is_none() { (bright_misses + 1).min(5) } else { 0 };
                next_bright = now_t + Duration::from_millis(if bright_misses >= 5 { 20_000 } else if fast { 300 } else { 1500 });
            }

            if now_t >= next_slow {
                next_slow = now_t + Duration::from_secs(2);
                let p = winsys::power();
                if p != power {
                    if let Some(p) = &p {
                        let _ = app.emit("power", p);
                    }
                    power = p;
                }
                let o = winsys::output_name();
                if o != output {
                    if let Some(o) = &o {
                        let _ = app.emit("output", o);
                    }
                    output = o;
                }
                let n = winsys::online();
                if n != online {
                    online = n;
                    let _ = app.emit("online", n);
                }
                let busy = winsys::fullscreen_busy() && app.state::<Shared>().hide_fullscreen.load(Ordering::Relaxed);
                if busy != covered {
                    covered = busy;
                    app.state::<Shared>().covered.store(busy, Ordering::Relaxed);
                    sync_visibility(&app, &window);
                    let _ = app.emit("fullscreen", busy);
                }
            }
        }
    });
}

/// Lagu yang sedang diputar (Spotify, browser, VLC, dan lainnya). Antarmuka menghitung posisi
/// sendiri di antara dua kiriman, jadi cukup mengirim saat ada perubahan atau posisi melompat.
fn watch_media(app: AppHandle) {
    std::thread::spawn(move || {
        winsys::init_thread();
        let mut poller = winsys::MediaPoller::new();
        let mut last: Option<(winsys::Media, Instant)> = None;
        loop {
            // Setengah detik saat musik diputar; lebih jarang bila tidak ada apa-apa yang diputar.
            let playing_now = app.state::<Shared>().playing.load(Ordering::Relaxed);
            std::thread::sleep(Duration::from_millis(if playing_now { 500 } else { 1000 }));
            let now = poller.poll();
            app.state::<Shared>().playing.store(now.as_ref().map(|m| m.playing).unwrap_or(false), Ordering::Relaxed);
            let changed = match (&now, &last) {
                (None, None) => false,
                (Some(n), Some((l, at))) => {
                    let predicted = l.position + if l.playing { at.elapsed().as_secs_f64() } else { 0.0 };
                    let mut a = n.clone();
                    let mut b = l.clone();
                    a.position = 0.0;
                    b.position = 0.0;
                    a != b || (n.position - predicted).abs() > 1.5
                }
                _ => true,
            };
            if changed {
                let _ = app.emit("media", &now);
                last = now.map(|m| (m, Instant::now()));
            }
        }
    });
}

/// Riwayat clipboard, hanya saat dinyalakan di pengaturan.
fn watch_clipboard(app: AppHandle) {
    std::thread::spawn(move || {
        winsys::init_thread();
        let mut seq = 0u32;
        let mut was_on = false;
        loop {
            let on = app.state::<Shared>().clipboard_on.load(Ordering::Relaxed);
            // Mati: cukup melihat saklarnya tiap 2 detik.
            std::thread::sleep(Duration::from_millis(if on { 700 } else { 2000 }));
            let on = app.state::<Shared>().clipboard_on.load(Ordering::Relaxed);
            if !on {
                was_on = false;
                continue;
            }
            let event = winsys::clipboard_poll(&mut seq);
            // Yang disalin sebelum fitur dinyalakan tidak dicatat.
            if !was_on {
                was_on = true;
                continue;
            }
            if let Some(event) = event {
                let _ = app.emit("clip", event);
            }
        }
    });
}

/// Unduhan selesai: file baru di folder Downloads yang ukurannya sudah berhenti bertambah.
fn watch_downloads(app: AppHandle) {
    std::thread::spawn(move || {
        let Some(dir) = dirs::download_dir() else { return };
        let snapshot = |dir: &Path| -> HashMap<String, u64> {
            std::fs::read_dir(dir)
                .into_iter()
                .flatten()
                .flatten()
                .filter_map(|e| Some((e.file_name().to_string_lossy().into_owned(), e.metadata().ok()?)))
                .filter(|(_, m)| m.is_file())
                .map(|(n, m)| (n, m.len()))
                .collect()
        };
        let temp = |name: &str| {
            let l = name.to_lowercase();
            [".crdownload", ".part", ".tmp", ".download", ".opdownload"].iter().any(|x| l.ends_with(x)) || l.starts_with('.')
        };
        let mut known = snapshot(&dir);
        let mut pending: HashMap<String, u64> = HashMap::new();
        // Memeriksa semua file (satu panggilan sistem per file) mahal bila foldernya besar. Waktu ubah folder
        // berubah tiap ada file baru, dihapus, atau diganti nama (browser mengganti nama .crdownload saat selesai),
        // jadi isi folder hanya dibaca bila waktu itu berubah atau masih ada unduhan yang ditunggu.
        let stamp = |dir: &Path| std::fs::metadata(dir).and_then(|m| m.modified()).ok();
        let mut last_stamp = stamp(&dir);
        loop {
            std::thread::sleep(Duration::from_secs(2));
            let current = stamp(&dir);
            if pending.is_empty() && current.is_some() && current == last_stamp {
                continue;
            }
            last_stamp = current;
            let now = snapshot(&dir);
            for (name, size) in &now {
                if known.contains_key(name) || temp(name) {
                    continue;
                }
                if pending.get(name) == Some(size) && *size > 0 {
                    known.insert(name.clone(), *size);
                    pending.remove(name);
                    let _ = app.emit("download", name);
                } else {
                    pending.insert(name.clone(), *size);
                }
            }
            pending.retain(|n, _| now.contains_key(n));
            known.retain(|n, _| now.contains_key(n));
        }
    });
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .manage(Shared::default())
        .manage(updater::Pending::default())
        .invoke_handler(tauri::generate_handler![
            set_hit_rect,
            open_settings,
            set_pinned,
            set_hotkey,
            fetch_text,
            read_ics_file,
            open_target,
            reveal,
            existing_paths,
            set_clipboard_watch,
            set_hide_fullscreen,
            clip_files,
            clip_set_text,
            clip_set_image,
            media_cmd,
            media_seek,
            set_volume,
            update_supported,
            update_check,
            update_download,
            update_apply,
            autostart_get,
            autostart_set
        ])
        .on_window_event(|window, event| {
            // File yang dijatuhkan ke notch masuk Tray (bukan yang dijatuhkan ke jendela lain).
            if window.label() != "notch" {
                return;
            }
            if let WindowEvent::DragDrop(DragDropEvent::Drop { paths, .. }) = event {
                let list: Vec<String> = paths.iter().map(|p| p.to_string_lossy().into_owned()).collect();
                let _ = window.emit("files-dropped", list);
            }
        })
        .setup(|app| {
            let window = app.get_webview_window("notch").expect("jendela notch tidak ada");
            dock(&window)?;
            window.set_ignore_cursor_events(true)?;
            window.show()?;

            // Ikon di area ikon tersembunyi taskbar: klik kiri menyembunyikan atau menampilkan notch,
            // klik kanan membuka menu.
            let toggle = MenuItem::with_id(app, "toggle", "Sembunyikan notch", true, None::<&str>)?;
            let settings = MenuItem::with_id(app, "settings", "Pengaturan…", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle, &settings, &PredefinedMenuItem::separator(app)?, &quit])?;
            let toggle_label = toggle.clone();
            let flip = move |app: &AppHandle| {
                let s = app.state::<Shared>();
                let hidden = !s.user_hidden.load(Ordering::Relaxed);
                s.user_hidden.store(hidden, Ordering::Relaxed);
                let _ = toggle_label.set_text(if hidden { "Tampilkan notch" } else { "Sembunyikan notch" });
                if let Some(w) = app.get_webview_window("notch") {
                    sync_visibility(app, &w);
                }
            };
            let flip_menu = flip.clone();
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("ikon tidak ada"))
                .tooltip("Cognify Notch")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app, event| match event.id().as_ref() {
                    "toggle" => flip_menu(app),
                    "settings" => open_settings(app.clone()),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(move |tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        flip(tray.app_handle());
                    }
                })
                .build(app)?;

            watch_system(app.handle().clone(), window.clone());
            watch_media(app.handle().clone());
            watch_clipboard(app.handle().clone());
            watch_downloads(app.handle().clone());
            watch_cursor(app.handle().clone(), window);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Cognify Notch gagal dijalankan");
}
