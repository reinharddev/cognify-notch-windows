//! Pengganti di platform selain Windows: tidak melakukan apa-apa.
use super::{ClipEvent, Media, Power, Volume};

pub fn init_thread() {}
pub fn play_chime(_soft: bool) {}
pub fn power() -> Option<Power> { None }
pub fn set_power_saver(_enabled: bool) -> Result<bool, String> { Err("Mode hemat daya hanya tersedia di Windows 11".into()) }
pub fn volume() -> Option<Volume> { None }
pub fn set_volume(_value: f32) {}
pub fn peak() -> f32 { 0.0 }
pub fn output_name() -> Option<String> { None }
pub fn audio_outputs() -> Vec<super::AudioOutput> { Vec::new() }
pub fn set_default_output(_id: &str) -> Result<(), String> { Err("Pilihan output hanya tersedia di Windows".into()) }
pub fn fullscreen_busy() -> bool { false }
pub fn caps_lock() -> bool { false }
pub fn keyboard_lang() -> Option<String> { None }
pub fn online() -> bool { true }
pub fn open_target(_target: &str) {}
pub fn reveal(_path: &str) {}
pub fn clipboard_poll(_last: &mut u32) -> Option<ClipEvent> { None }
pub fn clipboard_set_text(_text: &str) {}
pub fn clipboard_set_image(_data_url: &str) {}
pub struct MediaPoller;
impl MediaPoller {
    pub fn new() -> Self { Self }
    pub fn poll(&mut self) -> Option<Media> { None }
}
pub fn media_command(_action: &str) {}
pub fn media_seek(_seconds: f64) {}
pub fn clipboard_files() -> Vec<String> { Vec::new() }
pub struct BrightnessReader;
impl BrightnessReader {
    pub fn new() -> Self { Self }
    pub fn read(&mut self) -> Option<u8> { None }
}
