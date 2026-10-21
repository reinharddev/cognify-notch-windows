//! Implementasi Windows.
use std::path::Path;

use windows::core::{w, HSTRING, PCWSTR, PWSTR};
use windows::Foundation::TimeSpan;
use windows::Media::Control::{
    GlobalSystemMediaTransportControlsSession as Session, GlobalSystemMediaTransportControlsSessionManager as Manager,
    GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
};
use windows::Networking::Connectivity::{NetworkConnectivityLevel, NetworkInformation};
use windows::Storage::Streams::{DataReader, IRandomAccessStreamReference};
use windows::Win32::Devices::FunctionDiscovery::PKEY_Device_FriendlyName;
use windows::Win32::Foundation::{CloseHandle, HGLOBAL, HWND};
use windows::Win32::Globalization::{GetLocaleInfoW, LOCALE_SISO639LANGNAME};
use windows::Win32::Media::Audio::Endpoints::{IAudioEndpointVolume, IAudioMeterInformation};
use windows::Win32::Media::Audio::{eMultimedia, eRender, IMMDevice, IMMDeviceEnumerator, MMDeviceEnumerator};
use windows::Win32::System::Com::StructuredStorage::{PropVariantClear, PropVariantToStringAlloc};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CoTaskMemFree, CLSCTX_ALL, COINIT_MULTITHREADED, STGM_READ};
use windows::Win32::System::DataExchange::{
    CloseClipboard, GetClipboardData, GetClipboardOwner, GetClipboardSequenceNumber, IsClipboardFormatAvailable, OpenClipboard,
    RegisterClipboardFormatW,
};
use windows::Win32::System::Memory::{GlobalLock, GlobalUnlock};
use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{GetKeyState, GetKeyboardLayout, VK_CAPITAL};
use windows::Win32::UI::Shell::{
    SHQueryUserNotificationState, ShellExecuteW, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowThreadProcessId, SW_SHOWNORMAL,
};

use super::{ClipEvent, Media, Power, Volume};

/// Setiap thread pekerja yang memanggil COM atau WinRT harus memanggil ini dulu.
pub fn init_thread() {
    unsafe {
        let _ = CoInitializeEx(None, COINIT_MULTITHREADED);
    }
}

// ---------- Baterai ----------
pub fn power() -> Option<Power> {
    let mut s = SYSTEM_POWER_STATUS::default();
    unsafe { GetSystemPowerStatus(&mut s).ok()? };
    // BatteryFlag 128 = tidak ada baterai (PC desktop); 255 = tidak diketahui.
    if s.BatteryFlag & 128 != 0 || s.BatteryLifePercent > 100 {
        return None;
    }
    Some(Power { percent: s.BatteryLifePercent, charging: s.BatteryFlag & 8 != 0, plugged: s.ACLineStatus == 1 })
}

// ---------- Suara ----------
fn endpoint() -> windows::core::Result<IMMDevice> {
    unsafe {
        let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
        enumerator.GetDefaultAudioEndpoint(eRender, eMultimedia)
    }
}

pub fn volume() -> Option<Volume> {
    unsafe {
        let v: IAudioEndpointVolume = endpoint().ok()?.Activate(CLSCTX_ALL, None).ok()?;
        Some(Volume { volume: v.GetMasterVolumeLevelScalar().ok()?, muted: v.GetMute().ok()?.as_bool() })
    }
}

pub fn set_volume(value: f32) {
    unsafe {
        if let Some(v) = endpoint().ok().and_then(|d| d.Activate::<IAudioEndpointVolume>(CLSCTX_ALL, None).ok()) {
            let _ = v.SetMasterVolumeLevelScalar(value.clamp(0.0, 1.0), std::ptr::null());
            let _ = v.SetMute(false, std::ptr::null());
        }
    }
}

/// Keras suara yang sedang keluar dari speaker atau headphone, 0 sampai 1.
pub fn peak() -> f32 {
    unsafe {
        endpoint()
            .ok()
            .and_then(|d| d.Activate::<IAudioMeterInformation>(CLSCTX_ALL, None).ok())
            .and_then(|m| m.GetPeakValue().ok())
            .unwrap_or(0.0)
    }
}

pub fn output_name() -> Option<String> {
    unsafe {
        let store = endpoint().ok()?.OpenPropertyStore(STGM_READ).ok()?;
        let mut value = store.GetValue(&PKEY_Device_FriendlyName).ok()?;
        let text = PropVariantToStringAlloc(&value).ok().map(|p: PWSTR| {
            let s = p.to_string().unwrap_or_default();
            CoTaskMemFree(Some(p.0 as *const _));
            s
        });
        let _ = PropVariantClear(&mut value);
        text.filter(|s| !s.is_empty())
    }
}

// ---------- Layar, keyboard, jaringan ----------
/// Ada app layar penuh atau presentasi di depan (game, video, PowerPoint).
pub fn fullscreen_busy() -> bool {
    unsafe {
        matches!(SHQueryUserNotificationState(), Ok(s) if s == QUNS_BUSY || s == QUNS_RUNNING_D3D_FULL_SCREEN || s == QUNS_PRESENTATION_MODE)
    }
}

pub fn caps_lock() -> bool {
    unsafe { GetKeyState(VK_CAPITAL.0 as i32) & 1 != 0 }
}

/// Kode bahasa keyboard yang sedang dipakai di jendela depan, mis. "EN" atau "ID".
pub fn keyboard_lang() -> Option<String> {
    unsafe {
        let thread = GetWindowThreadProcessId(GetForegroundWindow(), None);
        let lang = (GetKeyboardLayout(thread).0 as usize & 0xFFFF) as u32;
        let mut buf = [0u16; 16];
        let n = GetLocaleInfoW(lang, LOCALE_SISO639LANGNAME, Some(&mut buf));
        (n > 1).then(|| String::from_utf16_lossy(&buf[..(n as usize - 1)]).to_uppercase())
    }
}

pub fn online() -> bool {
    NetworkInformation::GetInternetConnectionProfile()
        .and_then(|p| p.GetNetworkConnectivityLevel())
        .map(|l| l == NetworkConnectivityLevel::InternetAccess)
        .unwrap_or(false)
}

// ---------- Buka file, tautan, app ----------
pub fn open_target(target: &str) {
    let target = HSTRING::from(target);
    unsafe {
        ShellExecuteW(None, w!("open"), &target, PCWSTR::null(), PCWSTR::null(), SW_SHOWNORMAL);
    }
}

pub fn reveal(path: &str) {
    let _ = std::process::Command::new("explorer").arg(format!("/select,{path}")).spawn();
}

// ---------- Clipboard ----------
fn format_present(name: PCWSTR) -> bool {
    unsafe {
        let id = RegisterClipboardFormatW(name);
        id != 0 && IsClipboardFormatAvailable(id).is_ok()
    }
}

/// Isi yang ditandai pengelola kata sandi atau Windows agar tidak masuk riwayat.
fn excluded() -> bool {
    if format_present(w!("ExcludeClipboardContentFromMonitorProcessing")) {
        return true;
    }
    unsafe {
        let id = RegisterClipboardFormatW(w!("CanIncludeInClipboardHistory"));
        if id == 0 || IsClipboardFormatAvailable(id).is_err() || OpenClipboard(None).is_err() {
            return false;
        }
        // Formatnya berisi satu DWORD; 0 berarti jangan dicatat.
        let flag = GetClipboardData(id)
            .ok()
            .map(|h| {
                let mem = HGLOBAL(h.0);
                let p = GlobalLock(mem) as *const u32;
                let v = if p.is_null() { 1 } else { *p };
                let _ = GlobalUnlock(mem);
                v
            })
            .unwrap_or(1);
        let _ = CloseClipboard();
        flag == 0
    }
}

fn owner_app() -> Option<String> {
    unsafe {
        let hwnd: HWND = GetClipboardOwner().ok()?;
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 520];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(process);
        ok.then(|| String::from_utf16_lossy(&buf[..len as usize]))
            .and_then(|p| Path::new(&p).file_stem().map(|s| s.to_string_lossy().into_owned()))
    }
}

fn png_data_url(img: &arboard::ImageData) -> Option<String> {
    use base64::Engine;
    let mut out = Vec::new();
    {
        let mut enc = png::Encoder::new(&mut out, img.width as u32, img.height as u32);
        enc.set_color(png::ColorType::Rgba);
        enc.set_depth(png::BitDepth::Eight);
        enc.write_header().ok()?.write_image_data(&img.bytes).ok()?;
    }
    // Sampul besar tidak dikirim ke antarmuka.
    (out.len() < 4_000_000).then(|| format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(out)))
}

/// Bila isi clipboard berubah sejak `last`, kembalikan isinya (teks, tautan, atau gambar).
pub fn clipboard_poll(last: &mut u32) -> Option<ClipEvent> {
    let seq = unsafe { GetClipboardSequenceNumber() };
    if seq == *last {
        return None;
    }
    *last = seq;
    if excluded() {
        return None;
    }
    let app = owner_app();
    let mut board = arboard::Clipboard::new().ok()?;
    if let Ok(text) = board.get_text() {
        let text: String = text.chars().take(20_000).collect();
        if text.trim().is_empty() {
            return None;
        }
        let link = (text.starts_with("http://") || text.starts_with("https://")) && !text.contains(char::is_whitespace);
        return Some(ClipEvent { kind: if link { "link" } else { "text" }, text, image: None, app });
    }
    let img = board.get_image().ok()?;
    let url = png_data_url(&img)?;
    Some(ClipEvent { kind: "image", text: format!("{} x {}", img.width, img.height), image: Some(url), app })
}

pub fn clipboard_set_text(text: &str) {
    if let Ok(mut board) = arboard::Clipboard::new() {
        let _ = board.set_text(text.to_owned());
    }
}

pub fn clipboard_set_image(data_url: &str) {
    use base64::Engine;
    let Some(b64) = data_url.split_once(',').map(|(_, b)| b) else { return };
    let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64) else { return };
    let Ok(reader) = png::Decoder::new(std::io::Cursor::new(bytes)).read_info() else { return };
    let mut reader = reader;
    let mut buf = vec![0; reader.output_buffer_size()];
    let Ok(info) = reader.next_frame(&mut buf) else { return };
    if info.color_type != png::ColorType::Rgba {
        return;
    }
    if let Ok(mut board) = arboard::Clipboard::new() {
        let _ = board.set_image(arboard::ImageData {
            width: info.width as usize,
            height: info.height as usize,
            bytes: buf[..info.buffer_size()].to_vec().into(),
        });
    }
}

// ---------- Media (Windows media session) ----------
fn session() -> Option<Session> {
    Manager::RequestAsync().ok()?.get().ok()?.GetCurrentSession().ok()
}

fn ticks(span: TimeSpan) -> f64 {
    span.Duration as f64 / 10_000_000.0
}

/// Detik sejak 1 Januari 1601, patokan waktu yang dipakai Windows.
fn now_seconds_1601() -> f64 {
    let unix = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(0.0);
    unix + 11_644_473_600.0
}

fn thumbnail(reference: IRandomAccessStreamReference) -> Option<String> {
    use base64::Engine;
    let stream = reference.OpenReadAsync().ok()?.get().ok()?;
    let size = stream.Size().ok()? as u32;
    if size == 0 || size > 4_000_000 {
        return None;
    }
    let reader = DataReader::CreateDataReader(&stream.GetInputStreamAt(0).ok()?).ok()?;
    reader.LoadAsync(size).ok()?.get().ok()?;
    let mut bytes = vec![0u8; size as usize];
    reader.ReadBytes(&mut bytes).ok()?;
    let mime = stream.ContentType().ok().map(|c| c.to_string()).filter(|c| c.starts_with("image/")).unwrap_or_else(|| "image/jpeg".into());
    Some(format!("data:{mime};base64,{}", base64::engine::general_purpose::STANDARD.encode(bytes)))
}

/// Membaca lagu yang sedang diputar. Sampul hanya diambil ulang saat judul atau artis berganti.
pub struct MediaPoller {
    key: String,
    thumb: Option<String>,
    /// Berapa kali sampul lagu ini sudah dicoba diambil (Spotify kadang baru menyiapkannya setelah judul tampil).
    tries: u8,
}

impl MediaPoller {
    pub fn new() -> Self {
        Self { key: String::new(), thumb: None, tries: 0 }
    }

    pub fn poll(&mut self) -> Option<Media> {
        let session = session()?;
        let props = session.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let title = props.Title().ok()?.to_string();
        if title.is_empty() {
            return None;
        }
        let artist = props.Artist().map(|s| s.to_string()).unwrap_or_default();
        let album = props.AlbumTitle().map(|s| s.to_string()).unwrap_or_default();
        let key = format!("{title}\u{1f}{artist}\u{1f}{album}");
        if key != self.key {
            self.thumb = None;
            self.tries = 0;
            self.key = key;
        }
        if self.thumb.is_none() && self.tries < 8 {
            self.tries += 1;
            self.thumb = props.Thumbnail().ok().and_then(thumbnail);
        }
        let playing = session.GetPlaybackInfo().and_then(|i| i.PlaybackStatus()).map(|s| s == Status::Playing).unwrap_or(false);
        let (position, duration) = session
            .GetTimelineProperties()
            .map(|t| {
                let start = t.StartTime().map(ticks).unwrap_or(0.0);
                let end = t.EndTime().map(ticks).unwrap_or(0.0) - start;
                let mut pos = t.Position().map(ticks).unwrap_or(0.0) - start;
                // Posisi dari pemutar hanya diperbarui sesekali; tambahkan waktu sejak pembaruan terakhir.
                if playing {
                    if let Ok(updated) = t.LastUpdatedTime() {
                        let since = now_seconds_1601() - updated.UniversalTime as f64 / 10_000_000.0;
                        pos += since.clamp(0.0, 3600.0);
                    }
                }
                (if end > 0.0 { pos.min(end) } else { pos }, end)
            })
            .unwrap_or((0.0, 0.0));
        let app = session.SourceAppUserModelId().map(|s| s.to_string()).unwrap_or_default();
        Some(Media { title, artist, album, app, playing, position, duration: duration.max(0.0), thumb: self.thumb.clone() })
    }
}

pub fn media_command(action: &str) {
    let Some(session) = session() else { return };
    let _ = match action {
        "toggle" => session.TryTogglePlayPauseAsync().and_then(|a| a.get()),
        "next" => session.TrySkipNextAsync().and_then(|a| a.get()),
        "prev" => session.TrySkipPreviousAsync().and_then(|a| a.get()),
        _ => return,
    };
}

pub fn media_seek(seconds: f64) {
    if let Some(session) = session() {
        let _ = session.TryChangePlaybackPositionAsync((seconds.max(0.0) * 10_000_000.0) as i64).and_then(|a| a.get());
    }
}
