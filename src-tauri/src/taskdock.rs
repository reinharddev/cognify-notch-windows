//! Dock: taskbar kustom milik Cognify Notch.
//!
//! Dock adalah jendela Tauri sendiri (label `taskdock`) di tepi bawah layar. Rust memindai jendela yang
//! tampil di taskbar Windows dan mengirimnya ke antarmuka (`taskdock-windows`); antarmuka menggambar dock,
//! menyimpan aplikasi yang disematkan, lalu memanggil perintah di sini untuk mengaktifkan, menutup, atau
//! meluncurkan.
//!
//! Taskbar Windows bisa disembunyikan. Itu perubahan di luar proses kita, jadi dijaga berlapis supaya
//! taskbar tidak pernah tertinggal hilang: keadaan asli ditulis ke berkas penanda sebelum menyembunyikan,
//! dikembalikan saat dock dimatikan, saat app keluar, dan saat app dibuka lagi setelah macet.

use std::{
    collections::HashMap,
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::Duration,
};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindowBuilder};

use crate::winsys;

const LABEL: &str = "taskdock";
/// Jarak minimal dock dari tepi kiri dan kanan layar (piksel CSS); sama dengan `EDGE` di `dockLayout.ts`.
const EDGE_PX: f64 = 16.0;
/// Berkas penanda: ada selama taskbar Windows disembunyikan; isinya keadaan asli taskbar.
const MARKER: &str = "taskbar-hidden.flag";
/// Berapa lama taskbar Windows ditampilkan saat tombol "Ikon tersembunyi" ditekan.
const PEEK: Duration = Duration::from_secs(8);

#[derive(Default)]
pub struct TaskDock {
    on: AtomicBool,
    /// Ikon per program, dibaca sekali. None = tidak terbaca (tidak dicoba lagi).
    icons: Mutex<HashMap<String, Option<String>>>,
    /// Ukuran, jarak dari tepi bawah (piksel CSS), dan mode menempel yang diminta antarmuka.
    layout: Mutex<(f64, f64, f64, bool)>,
    /// Keadaan asli taskbar bila sedang kita sembunyikan.
    hidden_from: Mutex<Option<u32>>,
}

// ---------------------------------------------------------------- penanda ---

fn marker_path(app: &AppHandle) -> Option<PathBuf> {
    app.path().app_data_dir().ok().map(|d| d.join(MARKER))
}

pub fn parse_marker(text: &str) -> Option<u32> {
    text.trim().parse::<u32>().ok()
}

/// Dipanggil saat app dibuka: kalau penanda ada, app sebelumnya berhenti saat taskbar tersembunyi.
pub fn recover(app: &AppHandle) {
    let Some(path) = marker_path(app) else { return };
    let Ok(text) = std::fs::read_to_string(&path) else { return };
    let original = parse_marker(&text).unwrap_or(0);
    let _ = winsys::taskbar_apply(false, original);
    let _ = std::fs::remove_file(path);
}

/// Dipanggil saat app keluar.
pub fn restore(app: &AppHandle) {
    let state = app.state::<TaskDock>();
    let original = state.hidden_from.lock().ok().and_then(|mut g| g.take());
    if let Some(original) = original {
        let _ = winsys::taskbar_apply(false, original);
        if let Some(path) = marker_path(app) {
            let _ = std::fs::remove_file(path);
        }
    }
}

fn hide_taskbar(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<TaskDock>();
    let mut from = state.hidden_from.lock().map_err(|_| "Keadaan taskbar tidak terbaca".to_string())?;
    let original = match *from {
        Some(o) => o,
        None => {
            let o = winsys::taskbar_state().ok_or_else(|| "Taskbar Windows tidak ditemukan".to_string())?;
            // Penanda ditulis lebih dulu: kalau app macet sesudahnya, taskbar tetap bisa dipulihkan.
            if let Some(path) = marker_path(app) {
                if let Some(dir) = path.parent() {
                    let _ = std::fs::create_dir_all(dir);
                }
                std::fs::write(path, o.to_string()).map_err(|e| format!("Penanda taskbar gagal ditulis: {e}"))?;
            }
            o
        }
    };
    winsys::taskbar_apply(true, original)?;
    *from = Some(original);
    Ok(())
}

fn show_taskbar(app: &AppHandle) {
    let state = app.state::<TaskDock>();
    let original = state.hidden_from.lock().ok().and_then(|mut g| g.take());
    if let Some(original) = original {
        let _ = winsys::taskbar_apply(false, original);
        if let Some(path) = marker_path(app) {
            let _ = std::fs::remove_file(path);
        }
    }
}

// --------------------------------------------------------------- penempatan ---

/// Posisi fisik dock (kiri, atas) dan ukurannya untuk layar dengan area kerja `work` (x, y, lebar, tinggi, piksel fisik).
/// Lebarnya tidak pernah melebihi area kerja, jadi dock tidak bisa terpotong layar walau antarmuka meminta lebih.
/// `attached`: menempel di tepi bawah tanpa jarak.
pub fn dock_rect(work: (i32, i32, u32, u32), scale: f64, w: f64, h: f64, margin: f64, attached: bool) -> (i32, i32, u32, u32) {
    // Selalu menyisakan jarak dari tepi kiri dan kanan layar (sama dengan EDGE di dockLayout.ts).
    let edge = (EDGE_PX * scale).round() as u32;
    let max_w = work.2.saturating_sub(edge * 2).max(1);
    let pw = ((w * scale).round().max(1.0) as u32).min(max_w);
    let ph = ((h * scale).round().max(1.0) as u32).min(work.3.max(1));
    let gap = if attached { 0 } else { (margin * scale).round() as i32 };
    let x = work.0 + (work.2 as i32 - pw as i32) / 2;
    let y = work.1 + work.3 as i32 - ph as i32 - gap;
    (x, y, pw, ph)
}

fn place(app: &AppHandle) {
    let state = app.state::<TaskDock>();
    let (w, h, margin, attached) = *state.layout.lock().unwrap();
    if w <= 0.0 || h <= 0.0 {
        return;
    }
    let (Some(window), Ok(Some(monitor))) = (app.get_webview_window(LABEL), app.primary_monitor()) else { return };
    let area = monitor.work_area();
    let (x, y, pw, ph) = dock_rect((area.position.x, area.position.y, area.size.width, area.size.height), monitor.scale_factor(), w, h, margin, attached);
    let moved = window.outer_position().map(|p| (p.x, p.y) != (x, y)).unwrap_or(true);
    let resized = window.outer_size().map(|s| (s.width, s.height) != (pw, ph)).unwrap_or(true);
    if resized {
        let _ = window.set_size(PhysicalSize::new(pw, ph));
    }
    if moved || resized {
        let _ = window.set_position(PhysicalPosition::new(x, y));
    }
}

// ---------------------------------------------------------------- perintah ---

/// Membuka dock. Harus `async`: membuat jendela dari perintah sinkron membuat WebView2 macet.
#[tauri::command]
pub async fn taskdock_open(app: AppHandle) -> Result<(), String> {
    app.state::<TaskDock>().on.store(true, Ordering::Relaxed);
    if let Some(w) = app.get_webview_window(LABEL) {
        let _ = w.show();
        return Ok(());
    }
    WebviewWindowBuilder::new(&app, LABEL, WebviewUrl::App("index.html".into()))
        .title("Cognify Notch Dock")
        .inner_size(480.0, 76.0)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .resizable(false)
        .shadow(false)
        .focusable(false)
        .focused(false)
        .initialization_script("window.__CN_WINDOW__ = 'taskdock';")
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn taskdock_close(app: AppHandle) {
    app.state::<TaskDock>().on.store(false, Ordering::Relaxed);
    if let Some(w) = app.get_webview_window(LABEL) {
        let _ = w.close();
    }
    // Tanpa dock, taskbar Windows harus kembali: pengguna tidak boleh kehilangan keduanya.
    show_taskbar(&app);
}

/// Antarmuka melaporkan ukuran dock (piksel CSS), jaraknya dari tepi bawah layar, dan apakah menempel di tepi.
#[tauri::command]
pub fn taskdock_resize(app: AppHandle, w: f64, h: f64, margin: f64, attached: bool) {
    *app.state::<TaskDock>().layout.lock().unwrap() = (w.clamp(40.0, 8000.0), h.clamp(24.0, 600.0), margin.clamp(0.0, 200.0), attached);
    place(&app);
}

/// Daftar jendela saat ini, supaya dock yang baru dibuka tidak menunggu perubahan berikutnya.
#[tauri::command]
pub fn taskdock_snapshot() -> Vec<winsys::DockWindow> {
    winsys::dock_windows()
}

#[tauri::command]
pub fn taskdock_activate(id: i64) {
    winsys::dock_activate(id);
}

#[tauri::command]
pub fn taskdock_toggle(id: i64) {
    winsys::dock_toggle(id);
}

#[tauri::command]
pub fn taskdock_close_window(id: i64) {
    winsys::dock_close(id);
}

/// Ikon program sebagai data URL PNG. Dibaca sekali per program lalu disimpan.
#[tauri::command]
pub async fn taskdock_icon(app: AppHandle, exe: String) -> Option<String> {
    let key = exe.to_lowercase();
    if let Some(hit) = app.state::<TaskDock>().icons.lock().unwrap().get(&key) {
        return hit.clone();
    }
    let icon = tauri::async_runtime::spawn_blocking({
        let exe = exe.clone();
        move || winsys::dock_icon(&exe)
    })
    .await
    .ok()
    .flatten();
    app.state::<TaskDock>().icons.lock().unwrap().insert(key, icon.clone());
    icon
}

/// "start", "quick" (Win+A), atau "notifications" (Win+N).
#[tauri::command]
pub fn taskdock_keys(name: String) {
    winsys::tap_keys(&name);
}

/// Menyembunyikan atau menampilkan taskbar Windows.
#[tauri::command]
pub fn taskbar_hide(app: AppHandle, hidden: bool) -> Result<(), String> {
    if hidden {
        hide_taskbar(&app)
    } else {
        show_taskbar(&app);
        Ok(())
    }
}

/// Menampilkan taskbar Windows sebentar (untuk ikon tray yang tidak ada di dock), lalu menyembunyikannya lagi.
#[tauri::command]
pub fn taskbar_peek(app: AppHandle) {
    let state = app.state::<TaskDock>();
    let original = *state.hidden_from.lock().unwrap();
    let Some(original) = original else { return };
    let _ = winsys::taskbar_apply(false, original);
    std::thread::spawn(move || {
        std::thread::sleep(PEEK);
        // Pengguna mungkin sudah mematikan penyembunyian selama jeda ini.
        if app.state::<TaskDock>().hidden_from.lock().unwrap().is_some() {
            let _ = winsys::taskbar_apply(true, original);
        }
    });
}

// ---------------------------------------------------------------- pemantau ---

/// Memindai jendela sekitar tiga kali per detik selama dock hidup, dan mengirim daftar saat berubah.
/// Dock juga disembunyikan saat ada app layar penuh, dan ditempatkan ulang bila layar berubah.
pub fn watch(app: AppHandle) {
    std::thread::spawn(move || {
        winsys::init_thread();
        let mut last: Vec<winsys::DockWindow> = Vec::new();
        let mut covered = false;
        let mut ticks = 0u32;
        loop {
            let state = app.state::<TaskDock>();
            if !state.on.load(Ordering::Relaxed) {
                last.clear();
                std::thread::sleep(Duration::from_millis(800));
                continue;
            }
            let now = winsys::dock_windows();
            if now != last {
                let _ = app.emit("taskdock-windows", &now);
                last = now;
            }
            let full = winsys::fullscreen_busy();
            if full != covered {
                covered = full;
                if let Some(w) = app.get_webview_window(LABEL) {
                    let _ = if covered { w.hide() } else { w.show() };
                }
            }
            ticks += 1;
            if ticks % 8 == 0 {
                place(&app);
            }
            std::thread::sleep(Duration::from_millis(350));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_dock_sits_centred_above_the_bottom_edge() {
        // layar 1920x1080 tanpa skala, dock 400x72, jarak 12
        assert_eq!(dock_rect((0, 0, 1920, 1080), 1.0, 400.0, 72.0, 12.0, false), (760, 996, 400, 72));
    }

    #[test]
    fn an_attached_dock_touches_the_bottom_edge_whatever_the_margin() {
        assert_eq!(dock_rect((0, 0, 1920, 1080), 1.0, 400.0, 72.0, 12.0, true), (760, 1008, 400, 72));
    }

    #[test]
    fn scale_and_a_second_monitor_offset_are_respected() {
        // layar kedua di kanan, skala 1,5: ukuran dan jarak ikut membesar
        let (x, y, w, h) = dock_rect((1920, 0, 2560, 1440), 1.5, 400.0, 72.0, 12.0, false);
        assert_eq!((w, h), (600, 108));
        assert_eq!(x, 1920 + (2560 - 600) / 2);
        assert_eq!(y, 1440 - 108 - 18);
    }

    #[test]
    fn a_work_area_that_does_not_start_at_the_top_is_handled() {
        let (_, y, _, h) = dock_rect((0, 40, 1920, 1000), 1.0, 300.0, 60.0, 0.0, false);
        assert_eq!(y + h as i32, 1040);
    }

    #[test]
    fn the_window_can_never_be_wider_or_taller_than_the_screen() {
        // antarmuka meminta 5000 px di layar 1920: dipotong, dan tetap menyisakan 16 px di kiri dan kanan
        let (x, y, w, h) = dock_rect((0, 0, 1920, 1080), 1.0, 5000.0, 90.0, 12.0, false);
        assert_eq!((x, w), (16, 1888));
        assert!(x >= 16 && x + w as i32 <= 1920 - 16);
        assert!(y >= 0 && y + h as i32 <= 1080);
        let (_, y, _, h) = dock_rect((0, 0, 1920, 1080), 1.0, 400.0, 5000.0, 0.0, true);
        assert_eq!((y, h), (0, 1080));
    }

    #[test]
    fn the_marker_holds_the_original_taskbar_state() {
        assert_eq!(parse_marker("2"), Some(2));
        assert_eq!(parse_marker(" 3\n"), Some(3));
        assert_eq!(parse_marker(""), None);
        assert_eq!(parse_marker("hidden"), None);
    }
}
