//! Bagian yang bicara langsung dengan Windows. Tidak bergantung pada Tauri, supaya mudah diperiksa
//! sendiri. Di platform lain semua fungsi mengembalikan nilai kosong, jadi proyek tetap bisa
//! dikompilasi di Mac untuk pemeriksaan tipe.

use serde::Serialize;

#[cfg(windows)]
mod imp;
#[cfg(not(windows))]
#[path = "stub.rs"]
mod imp;

pub use imp::*;

#[derive(Clone, PartialEq, Serialize)]
pub struct Power {
    pub percent: u8,
    pub charging: bool,
    pub plugged: bool,
}

#[derive(Clone, PartialEq, Serialize)]
pub struct Volume {
    pub volume: f32,
    pub muted: bool,
}

#[derive(Clone, PartialEq, Serialize)]
pub struct Media {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub app: String,
    pub playing: bool,
    pub position: f64,
    pub duration: f64,
    /// Sampul sebagai data URL (PNG atau JPEG), bila ada.
    pub thumb: Option<String>,
}

#[derive(Clone, Serialize)]
pub struct ClipEvent {
    /// "text", "link", atau "image"
    pub kind: &'static str,
    pub text: String,
    pub image: Option<String>,
    pub app: Option<String>,
}
