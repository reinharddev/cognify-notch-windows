//! Hubungan dengan Cognify utama lewat berkas di folder bersama `%APPDATA%\Cognify Link\`
//! (protokol: docs/NOTCH_LINK.md di repo Cognify). Notch hanya menulis `notch-data.json` setelah
//! pengguna menekan "Hubungkan ke Cognify Notch" di Cognify, yang menulis `link.json`.
//! Tanpa jaringan dan tanpa port; penulisan selalu atomik.

use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use serde::Serialize;

const FOLDER: &str = "Cognify Link";
const CONSENT: &str = "link.json";
const DATA: &str = "notch-data.json";
const AGENDA: &str = "cognify-agenda.json";
const MAX_AGENDA_BYTES: u64 = 1024 * 1024;
const MAX_BYTES: usize = 5 * 1024 * 1024;

#[derive(Serialize, Default, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Consent {
    pub enabled: bool,
    /// Pengguna mengizinkan riwayat clipboard dibagikan.
    pub clipboard: bool,
}

fn dir() -> Option<PathBuf> {
    dirs::data_dir().map(|d| d.join(FOLDER))
}

/// Persetujuan dari `link.json`. Tidak ada, tidak terbaca, atau bentuknya salah = tidak diizinkan.
fn read_consent(dir: &Path) -> Consent {
    let Ok(text) = fs::read_to_string(dir.join(CONSENT)) else { return Consent::default() };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else { return Consent::default() };
    let enabled = v["enabled"] == serde_json::json!(true);
    Consent { enabled, clipboard: enabled && v["share"]["clipboard"] == serde_json::json!(true) }
}

/// Tulis `notch-data.json` secara atomik (berkas sementara di folder yang sama, lalu ganti nama).
/// Ditolak bila persetujuan sudah dicabut, bukan JSON, atau terlalu besar.
fn write_data(dir: &Path, json: &str) -> Result<(), String> {
    if !read_consent(dir).enabled {
        return Err("Hubungan ke Cognify belum diizinkan".into());
    }
    if json.len() > MAX_BYTES {
        return Err("Data terlalu besar".into());
    }
    serde_json::from_str::<serde_json::Value>(json).map_err(|e| format!("Bukan JSON: {e}"))?;
    let tmp = dir.join(format!("{DATA}.tmp"));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, dir.join(DATA)).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Agenda kalender Cognify (cognify-agenda.json), hanya selagi Cognify terhubung. Teks mentah JSON; UI yang menguraikannya.
fn read_agenda(dir: &Path) -> Option<String> {
    if !read_consent(dir).enabled {
        return None;
    }
    let path = dir.join(AGENDA);
    if fs::metadata(&path).ok()?.len() > MAX_AGENDA_BYTES {
        return None;
    }
    fs::read_to_string(path).ok()
}

fn clear_data(dir: &Path) {
    let _ = fs::remove_file(dir.join(DATA));
    let _ = fs::remove_file(dir.join(format!("{DATA}.tmp")));
}

#[tauri::command]
pub fn link_consent() -> Consent {
    dir().map(|d| read_consent(&d)).unwrap_or_default()
}

#[tauri::command]
pub fn link_write(json: String) -> Result<(), String> {
    write_data(&dir().ok_or("Folder data tidak ditemukan")?, &json)
}

#[tauri::command]
pub fn link_read_agenda() -> Option<String> {
    dir().and_then(|d| read_agenda(&d))
}

#[tauri::command]
pub fn link_clear() {
    if let Some(d) = dir() {
        clear_data(&d);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp() -> PathBuf {
        let d = std::env::temp_dir().join(format!("cn-link-test-{}-{:?}", std::process::id(), std::thread::current().id()));
        let _ = fs::remove_dir_all(&d);
        fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn nothing_is_allowed_without_a_valid_consent_file() {
        let d = temp();
        assert_eq!(read_consent(&d), Consent::default());
        fs::write(d.join(CONSENT), "bukan json").unwrap();
        assert!(!read_consent(&d).enabled);
        fs::write(d.join(CONSENT), r#"{"enabled":"true"}"#).unwrap();
        assert!(!read_consent(&d).enabled, "hanya boolean true yang sah");
        assert!(write_data(&d, "{}").is_err());
        assert!(!d.join(DATA).exists());
    }

    #[test]
    fn clipboard_sharing_needs_both_flags() {
        let d = temp();
        fs::write(d.join(CONSENT), r#"{"enabled":false,"share":{"clipboard":true}}"#).unwrap();
        assert_eq!(read_consent(&d), Consent { enabled: false, clipboard: false });
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        assert_eq!(read_consent(&d), Consent { enabled: true, clipboard: false });
        fs::write(d.join(CONSENT), r#"{"enabled":true,"share":{"clipboard":true}}"#).unwrap();
        assert_eq!(read_consent(&d), Consent { enabled: true, clipboard: true });
    }

    #[test]
    fn writes_atomically_validates_and_clears() {
        let d = temp();
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        write_data(&d, r#"{"schema":1}"#).unwrap();
        assert_eq!(fs::read_to_string(d.join(DATA)).unwrap(), r#"{"schema":1}"#);
        assert!(!d.join(format!("{DATA}.tmp")).exists());
        assert!(write_data(&d, "{rusak").is_err());
        assert!(write_data(&d, &format!("\"{}\"", "x".repeat(MAX_BYTES))).is_err());
        assert_eq!(fs::read_to_string(d.join(DATA)).unwrap(), r#"{"schema":1}"#, "penulisan gagal tidak merusak berkas lama");
        clear_data(&d);
        assert!(!d.join(DATA).exists());
    }

    #[test]
    fn the_cognify_agenda_is_read_only_while_connected_and_within_the_size_limit() {
        let d = temp();
        fs::write(d.join(AGENDA), r#"{"schema":1,"events":[]}"#).unwrap();
        assert_eq!(read_agenda(&d), None, "tanpa persetujuan tidak dibaca");
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        assert_eq!(read_agenda(&d).as_deref(), Some(r#"{"schema":1,"events":[]}"#));
        fs::write(d.join(AGENDA), "x".repeat(MAX_AGENDA_BYTES as usize + 1)).unwrap();
        assert_eq!(read_agenda(&d), None);
        fs::remove_file(d.join(AGENDA)).unwrap();
        assert_eq!(read_agenda(&d), None);
    }

    #[test]
    fn revoked_consent_blocks_further_writes() {
        let d = temp();
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        write_data(&d, "{}").unwrap();
        fs::remove_file(d.join(CONSENT)).unwrap();
        assert!(write_data(&d, "{}").is_err());
    }
}
