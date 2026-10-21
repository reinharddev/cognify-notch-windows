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
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, DragDropEvent, Emitter, Manager, PhysicalPosition, State, WebviewWindow, WindowEvent};
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

/// Memeriksa posisi kursor sekitar 20 kali per detik. Hanya saat status masuk/keluar berubah,
/// jendela diubah antara tembus klik dan menerima klik, dan antarmuka diberi tahu.
fn watch_cursor(app: AppHandle, window: WebviewWindow) {
    std::thread::spawn(move || {
        let mut inside = false;
        loop {
            std::thread::sleep(Duration::from_millis(50));
            let (Ok(cursor), Ok(origin), Ok(scale)) =
                (window.cursor_position(), window.outer_position(), window.scale_factor())
            else {
                continue;
            };
            let rect = *app.state::<Shared>().rect.lock().unwrap();
            let x = (cursor.x - origin.x as f64) / scale;
            let y = (cursor.y - origin.y as f64) / scale;
            let pinned = app.state::<Shared>().pinned.load(Ordering::Relaxed);
            let now = pinned || rect.w > 0.0 && x >= rect.x && x <= rect.x + rect.w && y >= 0.0 && y <= rect.y + rect.h;
            if now != inside {
                inside = now;
                let _ = window.set_ignore_cursor_events(!now);
                let _ = app.emit("notch-hover", now);
            }
        }
    });
}

/// Keadaan perangkat: suara, baterai, keyboard, internet, layar penuh. Hanya mengirim saat berubah.
fn watch_system(app: AppHandle, window: WebviewWindow) {
    std::thread::spawn(move || {
        winsys::init_thread();
        let (mut level, mut volume, mut power, mut caps, mut layout, mut output) = (0.0f32, None, None, false, None, None);
        let (mut online, mut covered) = (true, false);
        let mut brightness = (winsys::BrightnessReader::new(), None::<u8>);
        let mut tick = 0u64;
        loop {
            std::thread::sleep(Duration::from_millis(100));
            tick += 1;

            let now = winsys::peak();
            if (now - level).abs() > 0.03 || (now == 0.0 && level != 0.0) {
                level = now;
                let _ = app.emit("level", now);
            }
            if tick % 5 == 0 {
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
            if tick % 5 == 0 {
                let b = brightness.0.read();
                if b != brightness.1 {
                    if let Some(b) = b {
                        let _ = app.emit("brightness", b);
                    }
                    brightness.1 = b;
                }
            }
            if tick % 20 == 0 {
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
                    let _ = if busy { window.hide() } else { window.show() };
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
            std::thread::sleep(Duration::from_millis(500));
            let now = poller.poll();
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
            std::thread::sleep(Duration::from_millis(700));
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
        loop {
            std::thread::sleep(Duration::from_secs(2));
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
            // File yang dijatuhkan ke notch masuk Tray.
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

            let quit = MenuItem::with_id(app, "quit", "Keluar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit])?;
            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().expect("ikon tidak ada"))
                .tooltip("Cognify Notch")
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id() == "quit" {
                        app.exit(0);
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
