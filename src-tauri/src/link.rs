//! Hubungan dengan Cognify utama lewat berkas di folder bersama `%APPDATA%\Cognify Link\`
//! (protokol: docs/notch/protokol-tautan.md di repo Cognify). Notch hanya menulis `notch-data.json` setelah
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
const HUB: &str = "cognify-hub.json";
const INBOX: &str = "inbox";
const RESULTS: &str = "results";
const MAX_HUB_BYTES: u64 = 1024 * 1024;
const MAX_COMMAND_BYTES: usize = 64 * 1024;
const MAX_RESULT_BYTES: u64 = 256 * 1024;
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

/// Ringkasan Cognify (cognify-hub.json), hanya selagi terhubung. Teks mentah JSON; UI yang menguraikannya.
fn read_hub(dir: &Path) -> Option<String> {
    if !read_consent(dir).enabled {
        return None;
    }
    let path = dir.join(HUB);
    if fs::metadata(&path).ok()?.len() > MAX_HUB_BYTES {
        return None;
    }
    fs::read_to_string(path).ok()
}

#[derive(Serialize, Default, Debug, PartialEq)]
pub struct Lesson { pub id: String, pub title: String, pub start: String, pub end: String, pub room: Option<String> }
#[derive(Serialize, Debug, PartialEq)]
pub struct DocRef { pub id: String, pub title: String, pub kind: String }
#[derive(Serialize, Debug, PartialEq)]
pub struct ToolRef { pub id: String, pub name: String }
#[derive(Serialize, Default, Debug, PartialEq)]
pub struct Hub { pub lessons: Vec<Lesson>, pub pinned: Vec<DocRef>, pub recent: Vec<DocRef>, pub tools: Vec<ToolRef> }
#[derive(Serialize, Debug, PartialEq)]
pub struct Hit { pub id: String, pub title: String, pub kind: String, pub snippet: String }

fn text<'a>(v: &'a serde_json::Value, key: &str) -> Option<&'a str> {
    v[key].as_str().filter(|s| !s.is_empty())
}

fn docs(v: &serde_json::Value) -> Vec<DocRef> {
    v.as_array().map(|a| a.iter().filter_map(|d| {
        let kind = text(d, "kind").filter(|k| matches!(*k, "doc" | "board" | "table")).unwrap_or("doc");
        Some(DocRef { id: text(d, "id")?.into(), title: text(d, "title")?.into(), kind: kind.into() })
    }).take(8).collect()).unwrap_or_default()
}

/// Uraikan cognify-hub.json. Elemen rusak dilewati, bidang tak dikenal diabaikan, bentuk salah = hub kosong.
fn parse_hub(json: &str) -> Hub {
    let Ok(v) = serde_json::from_str::<serde_json::Value>(json) else { return Hub::default() };
    if v["schema"] != serde_json::json!(1) {
        return Hub::default();
    }
    let lessons = v["lessons"].as_array().map(|a| a.iter().filter_map(|l| {
        let (start, end) = (text(l, "start")?, text(l, "end")?);
        Some(Lesson { id: text(l, "id")?.into(), title: text(l, "title")?.into(), start: start.into(), end: end.into(), room: text(l, "room").map(Into::into) })
    }).take(12).collect()).unwrap_or_default();
    let tools = v["tools"].as_array().map(|a| a.iter().filter_map(|t| {
        Some(ToolRef { id: text(t, "id")?.into(), name: text(t, "name")?.into() })
    }).take(24).collect()).unwrap_or_default();
    Hub { lessons, pinned: docs(&v["docs"]["pinned"]), recent: docs(&v["docs"]["recent"]), tools }
}

/// Uraikan results/<id>.json: paling banyak 8 hasil; id harus cocok dengan pencarian.
fn parse_hits(json: &str, id: &str) -> Option<Vec<Hit>> {
    let v = serde_json::from_str::<serde_json::Value>(json).ok()?;
    if v["id"].as_str() != Some(id) {
        return None;
    }
    Some(v["hits"].as_array()?.iter().filter_map(|h| {
        Some(Hit { id: text(h, "id")?.into(), title: text(h, "title")?.into(), kind: text(h, "kind").unwrap_or("doc").into(), snippet: h["snippet"].as_str().unwrap_or("").into() })
    }).take(8).collect())
}

/// `<id>` perintah dan hasil hanya boleh huruf, angka, `-`, `_` (tanpa pemisah folder).
fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Tulis satu perintah ke `inbox/<id>.json` secara atomik. Ditolak tanpa persetujuan, id tak sah, bukan objek JSON, atau di atas 64 KB.
fn write_command(dir: &Path, id: &str, json: &str) -> Result<(), String> {
    if !read_consent(dir).enabled {
        return Err("Hubungan ke Cognify belum diizinkan".into());
    }
    if !valid_id(id) {
        return Err("Id perintah tidak sah".into());
    }
    if json.len() > MAX_COMMAND_BYTES {
        return Err("Perintah terlalu besar".into());
    }
    let v = serde_json::from_str::<serde_json::Value>(json).map_err(|e| format!("Bukan JSON: {e}"))?;
    if !v.is_object() || !v["type"].is_string() {
        return Err("Perintah harus objek dengan bidang type".into());
    }
    let inbox = dir.join(INBOX);
    fs::create_dir_all(&inbox).map_err(|e| e.to_string())?;
    let tmp = inbox.join(format!("{id}.tmp"));
    {
        let mut f = fs::File::create(&tmp).map_err(|e| e.to_string())?;
        f.write_all(json.as_bytes()).map_err(|e| e.to_string())?;
        f.sync_all().map_err(|e| e.to_string())?;
    }
    fs::rename(&tmp, inbox.join(format!("{id}.json"))).map_err(|e| {
        let _ = fs::remove_file(&tmp);
        e.to_string()
    })
}

/// Baca `results/<id>.json` lalu hapus. `None` bila belum ada (atau rusak/terlalu besar, yang juga dihapus).
fn take_result(dir: &Path, id: &str) -> Option<String> {
    if !valid_id(id) || !read_consent(dir).enabled {
        return None;
    }
    let path = dir.join(RESULTS).join(format!("{id}.json"));
    let len = fs::metadata(&path).ok()?.len();
    let text = if len > MAX_RESULT_BYTES { None } else { fs::read_to_string(&path).ok() };
    if text.is_some() || len > MAX_RESULT_BYTES {
        let _ = fs::remove_file(&path);
    }
    text
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
pub fn link_read_hub() -> Option<Hub> {
    dir().and_then(|d| read_hub(&d)).map(|t| parse_hub(&t))
}

#[tauri::command]
pub fn link_send(id: String, json: String) -> Result<(), String> {
    write_command(&dir().ok_or("Folder data tidak ditemukan")?, &id, &json)
}

#[tauri::command]
pub fn link_take_result(id: String) -> Option<Vec<Hit>> {
    dir().and_then(|d| take_result(&d, &id)).and_then(|t| parse_hits(&t, &id))
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

    #[test]
    fn the_hub_is_read_only_while_connected_and_within_the_size_limit() {
        let d = temp();
        fs::write(d.join(HUB), r#"{"schema":1}"#).unwrap();
        assert_eq!(read_hub(&d), None);
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        assert_eq!(read_hub(&d).as_deref(), Some(r#"{"schema":1}"#));
        fs::write(d.join(HUB), "x".repeat(MAX_HUB_BYTES as usize + 1)).unwrap();
        assert_eq!(read_hub(&d), None);
    }

    #[test]
    fn commands_are_written_atomically_to_the_inbox_and_validated() {
        let d = temp();
        let cmd = r#"{"type":"open","path":"/p/abc"}"#;
        assert!(write_command(&d, "a1", cmd).is_err(), "tanpa persetujuan ditolak");
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        write_command(&d, "open-1_x", cmd).unwrap();
        assert_eq!(fs::read_to_string(d.join("inbox/open-1_x.json")).unwrap(), cmd);
        assert!(!d.join("inbox/open-1_x.tmp").exists());
        for bad in ["", "../x", "a/b", "a.b", "a b"] {
            assert!(write_command(&d, bad, cmd).is_err(), "{bad}");
        }
        assert!(write_command(&d, "b", "[1]").is_err());
        assert!(write_command(&d, "b", "{rusak").is_err());
        assert!(write_command(&d, "b", r#"{"x":1}"#).is_err());
        let big = format!(r#"{{"type":"note_to_doc","text":"{}"}}"#, "x".repeat(MAX_COMMAND_BYTES));
        assert!(write_command(&d, "b", &big).is_err());
        assert!(!d.join("inbox/b.json").exists());
    }

    #[test]
    fn a_search_result_is_read_once_then_deleted() {
        let d = temp();
        fs::write(d.join(CONSENT), r#"{"enabled":true}"#).unwrap();
        assert_eq!(take_result(&d, "s1"), None);
        fs::create_dir_all(d.join(RESULTS)).unwrap();
        fs::write(d.join("results/s1.json"), r#"{"schema":1,"hits":[]}"#).unwrap();
        assert_eq!(take_result(&d, "s1").as_deref(), Some(r#"{"schema":1,"hits":[]}"#));
        assert!(!d.join("results/s1.json").exists());
        assert_eq!(take_result(&d, "../x"), None);
    }

    #[test]
    fn parses_the_hub_leniently() {
        let hub = parse_hub(r#"{"schema":1,"extra":1,
          "lessons":[{"id":"l1","title":"Fisika","start":"2026-11-09T01:00:00.000Z","end":"2026-11-09T02:30:00.000Z","room":"Lab"},
                     {"id":"l2","title":"tanpa waktu"}, 5],
          "docs":{"pinned":[{"id":"d1","title":"Bab 3","kind":"board"},{"title":"tanpa id"}],"recent":[{"id":"d2","title":"Sejarah","kind":"aneh"}]},
          "tools":[{"id":"pdf-merge","name":"Gabungkan PDF"},{"id":"x"}]}"#);
        assert_eq!(hub.lessons.len(), 1);
        assert_eq!(hub.lessons[0].room.as_deref(), Some("Lab"));
        assert_eq!(hub.pinned, vec![DocRef { id: "d1".into(), title: "Bab 3".into(), kind: "board".into() }]);
        assert_eq!(hub.recent[0].kind, "doc", "jenis tak dikenal jadi doc");
        assert_eq!(hub.tools, vec![ToolRef { id: "pdf-merge".into(), name: "Gabungkan PDF".into() }]);
        assert_eq!(parse_hub("rusak"), Hub::default());
        assert_eq!(parse_hub(r#"{"schema":2,"lessons":[]}"#), Hub::default());
    }

    #[test]
    fn parses_search_hits_capped_at_eight_and_matching_the_id() {
        let hits: Vec<String> = (0..10).map(|i| format!(r#"{{"id":"d{i}","title":"T{i}","kind":"doc","snippet":"s"}}"#)).collect();
        let json = format!(r#"{{"schema":1,"id":"q1","q":"x","hits":[{}]}}"#, hits.join(","));
        assert_eq!(parse_hits(&json, "q1").unwrap().len(), 8);
        assert_eq!(parse_hits(&json, "q2"), None);
        assert_eq!(parse_hits("rusak", "q1"), None);
    }
}
