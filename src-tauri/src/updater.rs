//! Pembaruan otomatis lewat Velopack. Umpan pembaruan adalah rilis "Latest" di GitHub
//! (`releases/latest/download`): app memeriksa `releases.win.json` di sana, mengunduh paket (selisih
//! versi bila ada), lalu memasangnya dan memulai ulang. Hanya bekerja bila app dipasang oleh
//! installer Velopack; saat dijalankan langsung (pengembangan) semua fungsi mengembalikan "tidak didukung".

use std::sync::{Arc, Mutex};

use velopack::{sources::HttpSource, UpdateCheck, UpdateInfo, UpdateManager};

const FEED: &str = "https://github.com/reinharddev/cognify-notch-windows/releases/latest/download";

/// Pembaruan yang sudah ditemukan, menunggu diunduh atau dipasang.
#[derive(Default, Clone)]
pub struct Pending(pub Arc<Mutex<Option<UpdateInfo>>>);

impl Pending {
    pub fn clone_handle(&self) -> Pending {
        self.clone()
    }
}

fn manager() -> Result<UpdateManager, String> {
    UpdateManager::new(HttpSource::new(FEED), None, None).map_err(|e| e.to_string())
}

/// Apakah app dipasang oleh Velopack (hanya yang begitu bisa memperbarui diri).
pub fn supported() -> bool {
    manager().is_ok()
}

/// Versi baru bila ada.
pub fn check(pending: &Pending) -> Result<Option<String>, String> {
    match manager()?.check_for_updates().map_err(|e| e.to_string())? {
        UpdateCheck::UpdateAvailable(info) => {
            let version = info.TargetFullRelease.Version.clone();
            *pending.0.lock().unwrap() = Some(*info);
            Ok(Some(version))
        }
        _ => Ok(None),
    }
}

pub fn download(pending: &Pending) -> Result<(), String> {
    let info = pending.0.lock().unwrap().clone().ok_or("Belum ada pembaruan")?;
    manager()?.download_updates(&info, None).map_err(|e| e.to_string())
}

/// Memasang pembaruan yang sudah diunduh dan memulai ulang app. Tidak kembali bila berhasil.
pub fn apply(pending: &Pending) -> Result<(), String> {
    let info = pending.0.lock().unwrap().clone().ok_or("Belum ada pembaruan")?;
    manager()?.apply_updates_and_restart(&info).map_err(|e| e.to_string())
}
