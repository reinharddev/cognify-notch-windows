//! Skin desktop: jendela transparan di desktop yang menampilkan halaman web kecil (HTML/CSS/JS) dan menerima data dari Notch
//! lewat `window.cognify`, seperti Rainmeter. Sama dengan Skins.swift di Mac dan TIDAK BOLEH berbeda: format `skin.json`,
//! API `window.cognify`, skin bawaan (Mimik, Lirik), cara memindahkan (Alt + seret, atau mode Atur posisi), tingkat jendela
//! (di desktop atau selalu di atas), ukuran, dan semua datanya. Lihat docs/notch/skin-desktop.md di repo utama.
//!
//! Keamanan: halaman skin dimuat lewat skema `skin://` yang hanya melayani berkas di folder skinnya sendiri (jalur seperti
//! `../` ditolak), semua jawaban membawa CSP tanpa jaringan, dan jendela skin tidak punya izin memanggil perintah Tauri.
//! Data yang dikirim sama dengan yang sudah ditampilkan Notch dan tidak keluar dari komputer ini.
//!
//! Hanya memakai API Tauri lintas platform (jendela, protokol, berkas) supaya modul ini ikut diperiksa tipenya di Mac;
//! hanya pembacaan tombol mouse dan Alt yang memakai `winsys` (kosong di platform lain).

use std::borrow::Cow;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::http::{header, Request, Response, StatusCode};
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, Url, WebviewUrl, WebviewWindow, WebviewWindowBuilder, WindowEvent};

use crate::winsys;

/// Jembatan `window.cognify` yang disuntikkan ke tiap halaman skin. Harus sama persis dengan `bridge` di Skins.swift
/// (diperiksa `scripts/sync-windows-skins.sh --check`).
const BRIDGE: &str = r#"
    window.cognify = { data: {}, _h: [],
      on(fn) { this._h.push(fn); fn(this.data) },
      _push(d) { this.data = d; this._h.forEach(f => { try { f(d) } catch (e) { console.error(e) } }) },
      _nt: [], onNotice(fn) { this._nt.push(fn) },
      _notice() { this._nt.forEach(f => { try { f() } catch (x) { console.error(x) } }) },
      _n: [], onNotch(fn) { this._n.push(fn) },
      _notch(on) { this._n.forEach(f => { try { f(on) } catch (x) { console.error(x) } }) },
      _a: [], onAudio(fn) { this._a.push(fn) },
      _audio(e, b, p, on) { this._a.forEach(f => { try { f(e, b, p, on) } catch (x) { console.error(x) } }) },
      _cfg(c) { this.data = Object.assign({}, this.data, { config: c }); this._h.forEach(f => { try { f(this.data) } catch (e) { console.error(e) } }) },
      _cursor(x, y) { window.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, bubbles: true })) } };
    "#;

/// Tambahan hanya untuk pratinjau di Pengaturan (iframe): konfigurasi datang lewat `postMessage` dari halaman Pengaturan.
const PREVIEW_BRIDGE: &str =
    "window.addEventListener('message', function (e) { if (e.data && e.data.cognifyCfg) window.cognify._cfg(e.data.cognifyCfg) });";

const CSP: &str = "default-src skin: http://skin.localhost data: blob: 'unsafe-inline' 'unsafe-eval'";

/// Skin bawaan: dibenamkan ke dalam exe (paket Velopack hanya berisi exe) lalu disalin ke folder pengguna.
/// Sumber tunggalnya notch/Skins di repo utama; salinan di `skins/` dijaga identik oleh scripts/sync-windows-skins.sh.
const BUILTIN: &[(&str, &[u8])] = &[
    ("mimik/face.js", include_bytes!("../../skins/mimik/face.js")),
    ("mimik/index.html", include_bytes!("../../skins/mimik/index.html")),
    ("mimik/skin.json", include_bytes!("../../skins/mimik/skin.json")),
    ("lyrics/index.html", include_bytes!("../../skins/lyrics/index.html")),
    ("lyrics/skin.json", include_bytes!("../../skins/lyrics/skin.json")),
];

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinInfo {
    pub id: String,
    pub name: String,
    pub desc: String,
    pub width: f64,
    pub height: f64,
    /// Skin meminta posisi kursor (wajah yang mengikuti kursor).
    pub cursor: bool,
    /// Skin meminta irama lagu (`cognify.onAudio`), ±15 kali per detik selama musik diputar.
    pub audio: bool,
    /// Skin meminta kabar kursor di atas notch dan notifikasi (`cognify.onNotch`, `cognify.onNotice`).
    pub notch: bool,
    /// Posisi awal sebelum skin pernah dipindahkan: top|bottom + left|center|right.
    pub anchor: String,
    pub entry: String,
}

#[derive(Deserialize)]
struct Manifest {
    name: Option<String>,
    description: Option<String>,
    width: Option<f64>,
    height: Option<f64>,
    cursor: Option<bool>,
    audio: Option<bool>,
    notch: Option<bool>,
    anchor: Option<String>,
    entry: Option<String>,
}

/// Yang disimpan di `skins.json` (di samping folder Skins).
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Saved {
    #[serde(default)]
    enabled: Vec<String>,
    /// false = di desktop (di bawah jendela lain), true = selalu di atas.
    #[serde(default)]
    on_top: bool,
    #[serde(default = "one")]
    scale: f64,
    #[serde(default)]
    origins: HashMap<String, [i32; 2]>,
    /// Gaya wajah Mimik dari playground (bentuknya milik antarmuka Pengaturan) dan gaya yang disimpan pengguna.
    #[serde(default)]
    mimik: Value,
    #[serde(default)]
    presets: Value,
}

fn one() -> f64 {
    1.0
}

impl Default for Saved {
    fn default() -> Self {
        Saved { enabled: vec![], on_top: false, scale: 1.0, origins: HashMap::new(), mimik: Value::Null, presets: Value::Null }
    }
}

pub struct Skins {
    saved: Mutex<Saved>,
    infos: Mutex<Vec<SkinInfo>>,
    arranging: AtomicBool,
    /// Reaksi sesaat yang diminta dari playground (nama, nomor urut).
    reaction: Mutex<(String, u32)>,
    folder: PathBuf,
    file: PathBuf,
}

impl Skins {
    pub fn new() -> Skins {
        let base = dirs::data_dir().unwrap_or_else(std::env::temp_dir).join("Cognify Notch");
        Skins {
            saved: Mutex::new(Saved::default()),
            infos: Mutex::new(vec![]),
            arranging: AtomicBool::new(false),
            reaction: Mutex::new((String::new(), 0)),
            folder: base.join("Skins"),
            file: base.join("skins.json"),
        }
    }
}

// ------------------------------------------------------------------------------------------------ berkas ---

fn load_saved(s: &Skins) {
    if let Ok(text) = fs::read_to_string(&s.file) {
        if let Ok(mut saved) = serde_json::from_str::<Saved>(&text) {
            saved.scale = saved.scale.clamp(0.5, 2.5);
            *s.saved.lock().unwrap() = saved;
        }
    }
}

fn persist(s: &Skins) {
    let text = serde_json::to_string_pretty(&*s.saved.lock().unwrap()).unwrap_or_default();
    if let Some(dir) = s.file.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let _ = fs::write(&s.file, text);
}

/// Skin bawaan disalin ke folder pengguna; yang sudah ada ditimpa hanya bila versi app berganti. Folder bernama sama
/// tanpa penanda `.builtin-version` adalah skin pengguna dan tidak pernah ditimpa. Build dev menyalin dari `skins/` di repo
/// supaya perubahan skin langsung ikut.
fn install_builtins(s: &Skins) {
    let _ = fs::create_dir_all(&s.folder);
    let dev_dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../skins");
    let dev = cfg!(debug_assertions) && dev_dir.join("mimik/skin.json").exists();
    let version = if dev { "dev".to_string() } else { env!("CARGO_PKG_VERSION").to_string() };

    let mut files: Vec<(String, Vec<u8>)> = vec![];
    if dev {
        for (rel, _) in BUILTIN {
            if let Ok(bytes) = fs::read(dev_dir.join(rel)) {
                files.push((rel.to_string(), bytes));
            }
        }
    } else {
        files = BUILTIN.iter().map(|(rel, bytes)| (rel.to_string(), bytes.to_vec())).collect();
    }
    let mut names: Vec<String> = files.iter().filter_map(|(rel, _)| rel.split('/').next().map(str::to_string)).collect();
    names.sort();
    names.dedup();
    for name in names {
        let dst = s.folder.join(&name);
        let marker = dst.join(".builtin-version");
        if !dev && fs::read_to_string(&marker).map(|v| v.trim() == version).unwrap_or(false) {
            continue;
        }
        if dst.exists() && !marker.exists() {
            continue; // skin pengguna bernama sama: jangan ditimpa
        }
        let _ = fs::remove_dir_all(&dst);
        for (rel, bytes) in files.iter().filter(|(rel, _)| rel.starts_with(&format!("{name}/"))) {
            let target = s.folder.join(rel);
            if let Some(dir) = target.parent() {
                let _ = fs::create_dir_all(dir);
            }
            let _ = fs::write(target, bytes);
        }
        let _ = fs::write(&marker, &version);
    }
}

fn valid_id(id: &str) -> bool {
    !id.is_empty() && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

fn scan(s: &Skins) {
    let mut out = vec![];
    let mut names: Vec<String> = fs::read_dir(&s.folder)
        .map(|rd| rd.filter_map(|e| e.ok()).filter_map(|e| e.file_name().into_string().ok()).collect())
        .unwrap_or_default();
    names.sort();
    for name in names {
        if name.starts_with('.') || !valid_id(&name) {
            continue;
        }
        let dir = s.folder.join(&name);
        let Ok(text) = fs::read_to_string(dir.join("skin.json")) else { continue };
        let Ok(m) = serde_json::from_str::<Manifest>(&text) else { continue };
        let entry = m.entry.unwrap_or_else(|| "index.html".into());
        if !dir.join(&entry).is_file() {
            continue;
        }
        out.push(SkinInfo {
            id: name.clone(),
            name: m.name.unwrap_or(name),
            desc: m.description.unwrap_or_default(),
            width: m.width.unwrap_or(240.0).clamp(80.0, 1200.0),
            height: m.height.unwrap_or(240.0).clamp(60.0, 900.0),
            cursor: m.cursor.unwrap_or(false),
            audio: m.audio.unwrap_or(false),
            notch: m.notch.unwrap_or(false),
            anchor: m.anchor.unwrap_or_else(|| "top-right".into()),
            entry,
        });
    }
    *s.infos.lock().unwrap() = out;
}

fn info_of(s: &Skins, id: &str) -> Option<SkinInfo> {
    s.infos.lock().unwrap().iter().find(|i| i.id == id).cloned()
}

// ----------------------------------------------------------------------------------------------- protokol ---

fn content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()).map(|e| e.to_ascii_lowercase()).as_deref() {
        Some("html") => "text/html",
        Some("js") | Some("mjs") => "text/javascript",
        Some("css") => "text/css",
        Some("json") => "application/json",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("woff") => "font/woff",
        Some("woff2") => "font/woff2",
        Some("ttf") => "font/ttf",
        Some("otf") => "font/otf",
        _ => "application/octet-stream",
    }
}

fn reply(status: u16, content_type: &str, body: Vec<u8>) -> Response<Cow<'static, [u8]>> {
    Response::builder()
        .status(StatusCode::from_u16(status).unwrap_or(StatusCode::OK))
        .header(header::CONTENT_TYPE, content_type)
        .header(header::CONTENT_LENGTH, body.len())
        .header(header::CACHE_CONTROL, "no-store")
        .header("Content-Security-Policy", CSP)
        .body(Cow::Owned(body))
        .unwrap()
}

/// Melayani skin://localhost/<id>/<jalur> (di Windows http://skin.localhost/<id>/<jalur>) dari folder skin itu saja.
/// Jalur di luar folder ditolak. Dengan `?preview=1` jembatan disuntikkan ke halaman (untuk iframe di Pengaturan).
pub fn protocol(app: &AppHandle, request: Request<Vec<u8>>) -> Response<Cow<'static, [u8]>> {
    let skins = app.state::<Skins>();
    let raw = request.uri().path().to_string();
    let decoded = percent_decode(&raw);
    let mut parts = decoded.trim_start_matches('/').splitn(2, '/');
    let id = parts.next().unwrap_or("").to_string();
    let rest = parts.next().unwrap_or("").to_string();
    if !valid_id(&id) {
        return reply(404, "text/plain", b"not found".to_vec());
    }
    let root = skins.folder.join(&id);
    let rel = if rest.is_empty() { info_of(&skins, &id).map(|i| i.entry).unwrap_or_else(|| "index.html".into()) } else { rest };
    let file = root.join(&rel);
    // Penjaga jalur: hasil kanonik harus tetap di dalam folder skin ("../" dan tautan keluar ditolak).
    let (Ok(root_c), Ok(file_c)) = (root.canonicalize(), file.canonicalize()) else {
        return reply(404, "text/plain", b"not found".to_vec());
    };
    if !file_c.starts_with(&root_c) || !file_c.is_file() {
        return reply(404, "text/plain", b"not found".to_vec());
    }
    let Ok(mut bytes) = fs::read(&file_c) else { return reply(404, "text/plain", b"not found".to_vec()) };
    let ty = content_type(&file_c);
    if ty == "text/html" && request.uri().query().map(|q| q.contains("preview=1")).unwrap_or(false) {
        bytes = inject(&bytes, &format!("<script>{BRIDGE}{PREVIEW_BRIDGE}</script>"));
    }
    reply(200, ty, bytes)
}

/// Menyisipkan skrip tepat setelah `<!doctype ...>` (di depan doctype membuat halaman masuk quirks mode).
fn inject(html: &[u8], script: &str) -> Vec<u8> {
    let text = String::from_utf8_lossy(html).to_string();
    let lower = text.to_ascii_lowercase();
    let at = if lower.trim_start().starts_with("<!doctype") { lower.find('>').map(|i| i + 1).unwrap_or(0) } else { 0 };
    format!("{}{}{}", &text[..at], script, &text[at..]).into_bytes()
}

fn percent_decode(s: &str) -> String {
    let b = s.as_bytes();
    let mut out = Vec::with_capacity(b.len());
    let mut i = 0;
    while i < b.len() {
        if b[i] == b'%' && i + 2 < b.len() {
            if let Ok(v) = u8::from_str_radix(&s[i + 1..i + 3], 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(b[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn skin_url(id: &str, entry: &str) -> String {
    if cfg!(windows) { format!("http://skin.localhost/{id}/{entry}") } else { format!("skin://localhost/{id}/{entry}") }
}

// ------------------------------------------------------------------------------------------------ jendela ---

fn label(id: &str) -> String {
    format!("skin-{id}")
}

fn id_of(label: &str) -> Option<&str> {
    label.strip_prefix("skin-")
}

fn skin_windows(app: &AppHandle) -> Vec<(String, WebviewWindow)> {
    app.webview_windows().into_iter().filter_map(|(l, w)| id_of(&l).map(|id| (id.to_string(), w))).collect()
}

/// Titik awal dari `anchor` di area kerja layar utama (tanpa taskbar), jarak tepi 32 piksel logis.
fn default_origin(app: &AppHandle, info: &SkinInfo, scale: f64) -> PhysicalPosition<i32> {
    let Some(monitor) = app.primary_monitor().ok().flatten() else { return PhysicalPosition::new(32, 32) };
    let area = monitor.work_area();
    let dpi = monitor.scale_factor();
    let (w, h) = ((info.width * scale * dpi) as i32, (info.height * scale * dpi) as i32);
    let margin = (32.0 * dpi) as i32;
    let (ax, ay) = (area.position.x, area.position.y);
    let (aw, ah) = (area.size.width as i32, area.size.height as i32);
    let x = if info.anchor.ends_with("left") {
        ax + margin
    } else if info.anchor.ends_with("center") {
        ax + (aw - w) / 2
    } else {
        ax + aw - w - margin
    };
    let y = if info.anchor.starts_with("bottom") { ay + ah - h - margin } else { ay + margin };
    PhysicalPosition::new(x, y)
}

/// Posisi tersimpan hanya dipakai bila masih berada di salah satu layar (layar bisa dicabut).
fn saved_origin(app: &AppHandle, id: &str) -> Option<PhysicalPosition<i32>> {
    let o = app.state::<Skins>().saved.lock().unwrap().origins.get(id).copied()?;
    let on_screen = app
        .available_monitors()
        .ok()?
        .iter()
        .any(|m| {
            let (p, s) = (m.position(), m.size());
            o[0] >= p.x - 40 && o[0] < p.x + s.width as i32 - 40 && o[1] >= p.y - 40 && o[1] < p.y + s.height as i32 - 40
        });
    on_screen.then(|| PhysicalPosition::new(o[0], o[1]))
}

fn page_json(app: &AppHandle, id: &str) -> Value {
    let skins = app.state::<Skins>();
    let mut cfg = if id == "mimik" { skins.saved.lock().unwrap().mimik.clone() } else { Value::Null };
    if cfg.is_null() {
        cfg = json!({});
    }
    let (name, n) = skins.reaction.lock().unwrap().clone();
    if let Value::Object(map) = &mut cfg {
        map.insert("react".into(), json!({ "name": name, "n": n }));
    }
    cfg
}

fn eval(w: &WebviewWindow, js: &str) {
    let _ = w.eval(js);
}

fn push_config(app: &AppHandle, w: &WebviewWindow, id: &str) {
    if id == "mimik" {
        eval(w, &format!("window.cognify&&window.cognify._cfg({})", page_json(app, id)));
    }
}

fn arrange_css(on: bool) -> String {
    // Bingkai biru dan klik tidak diteruskan ke halaman (sama dengan mode Atur posisi di Mac).
    let css = if on { "html::after{content:'';position:fixed;inset:0;border:2px solid #0a84ff;border-radius:12px;pointer-events:none}body{pointer-events:none!important}" } else { "" };
    format!(
        "(function(){{var s=document.getElementById('__cn_arrange');if(!s){{s=document.createElement('style');s.id='__cn_arrange';(document.head||document.documentElement).appendChild(s)}}s.textContent=\"{css}\"}})()"
    )
}

fn apply_level(w: &WebviewWindow, on_top: bool, arranging: bool) {
    let top = on_top || arranging;
    let _ = w.set_always_on_top(top);
    let _ = w.set_always_on_bottom(!top);
}

/// Membuka jendela satu skin. Harus dipanggil dari konteks async (membuat jendela dari penangan sinkron membuat WebView2 macet).
async fn open_skin(app: AppHandle, info: SkinInfo) {
    let id = info.id.clone();
    if app.get_webview_window(&label(&id)).is_some() {
        return;
    }
    let (scale, on_top) = {
        let skins = app.state::<Skins>();
        let saved = skins.saved.lock().unwrap();
        (saved.scale, saved.on_top)
    };
    let Ok(url) = Url::parse(&skin_url(&id, &info.entry)) else { return };
    let load_app = app.clone();
    let load_id = id.clone();
    let built = WebviewWindowBuilder::new(&app, label(&id), WebviewUrl::External(url))
        .title(format!("Skin {}", info.name))
        .inner_size(info.width * scale, info.height * scale)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .skip_taskbar(true)
        .resizable(false)
        .focusable(false)
        .focused(false)
        .visible(false)
        .always_on_top(on_top)
        .always_on_bottom(!on_top)
        .initialization_script(BRIDGE)
        .on_page_load(move |win, payload| {
            if let PageLoadEvent::Finished = payload.event() {
                // Konfigurasi playground ikut, dan jendela Notch diminta mengirim data terbaru.
                push_config(&load_app, &win, &load_id);
                let _ = load_app.emit_to("notch", "skins-need-data", ());
            }
        })
        .build();
    let Ok(win) = built else { return };
    let origin = saved_origin(&app, &id).unwrap_or_else(|| default_origin(&app, &info, scale));
    let _ = win.set_position(origin);
    let _ = win.set_zoom(scale);
    // Tingkat jendela diterapkan setelah dibuat (bukan hanya lewat builder), supaya pasti berlaku di Windows.
    let arranging = app.state::<Skins>().arranging.load(Ordering::Relaxed);
    apply_level(&win, on_top, arranging);
    if arranging {
        eval(&win, &arrange_css(true));
    }
    // Posisi baru disimpan tiap jendela dipindahkan (diseret).
    let move_app = app.clone();
    let move_id = id.clone();
    win.on_window_event(move |event| {
        if let WindowEvent::Moved(p) = event {
            let skins = move_app.state::<Skins>();
            skins.saved.lock().unwrap().origins.insert(move_id.clone(), [p.x, p.y]);
            persist(&skins);
        }
    });
    let _ = win.show();
    let _ = app.emit("skins-changed", ());
}

fn close_skin(app: &AppHandle, id: &str) {
    if let Some(w) = app.get_webview_window(&label(id)) {
        let _ = w.close();
    }
    let _ = app.emit("skins-changed", ());
}

// ---------------------------------------------------------------------------------- kursor dan seret ---

struct Drag {
    id: String,
    cursor: (f64, f64),
    origin: (i32, i32),
}

/// Satu putaran ±30 kali per detik hanya selama ada jendela skin: mengirim posisi kursor ke skin yang memintanya, dan
/// memindahkan skin saat diseret (Alt + seret, atau tanpa Alt dalam mode Atur posisi; sama dengan Mac).
fn spawn_loop(app: AppHandle) {
    std::thread::spawn(move || {
        let mut last: HashMap<String, (i32, i32)> = HashMap::new();
        let mut last_sent = Instant::now();
        let mut drag: Option<Drag> = None;
        let mut was_down = false;
        loop {
            let wins = skin_windows(&app);
            if wins.is_empty() {
                drag = None;
                last.clear();
                std::thread::sleep(Duration::from_millis(400));
                continue;
            }
            std::thread::sleep(Duration::from_millis(33));
            let Some(cursor) = wins[0].1.cursor_position().ok() else { continue };
            let skins = app.state::<Skins>();
            let arranging = skins.arranging.load(Ordering::Relaxed);
            let zoom = skins.saved.lock().unwrap().scale;

            // Seret.
            let down = winsys::mouse_left_down();
            if let Some(d) = &drag {
                if down {
                    if let Some((_, w)) = wins.iter().find(|(id, _)| *id == d.id) {
                        let nx = d.origin.0 + (cursor.x - d.cursor.0) as i32;
                        let ny = d.origin.1 + (cursor.y - d.cursor.1) as i32;
                        let _ = w.set_position(PhysicalPosition::new(nx, ny));
                    }
                } else {
                    drag = None;
                }
            } else if down && !was_down && (arranging || winsys::alt_down()) {
                for (id, w) in &wins {
                    let (Ok(p), Ok(s)) = (w.outer_position(), w.outer_size()) else { continue };
                    if cursor.x >= p.x as f64 && cursor.x < (p.x + s.width as i32) as f64 && cursor.y >= p.y as f64 && cursor.y < (p.y + s.height as i32) as f64 {
                        drag = Some(Drag { id: id.clone(), cursor: (cursor.x, cursor.y), origin: (p.x, p.y) });
                        break;
                    }
                }
            }
            was_down = down;

            // Kursor untuk skin yang memintanya (±30 kali per detik, hanya bila berubah).
            if last_sent.elapsed() < Duration::from_millis(30) {
                continue;
            }
            last_sent = Instant::now();
            for (id, w) in &wins {
                if !info_of(&skins, id).map(|i| i.cursor).unwrap_or(false) {
                    continue;
                }
                let (Ok(p), Ok(scale)) = (w.outer_position(), w.scale_factor()) else { continue };
                let key = (cursor.x as i32, cursor.y as i32);
                if last.get(id) == Some(&key) {
                    continue;
                }
                last.insert(id.clone(), key);
                // Titik layar (piksel fisik) → piksel CSS di dalam skin (asal kiri atas).
                let x = (cursor.x - p.x as f64) / (scale * zoom);
                let y = (cursor.y - p.y as f64) / (scale * zoom);
                eval(w, &format!("window.cognify&&window.cognify._cursor({},{})", x as i32, y as i32));
            }
        }
    });
}

// ----------------------------------------------------------------------------------------------- awal ---

/// Dipanggil sekali saat app mulai: baca pengaturan, pasang skin bawaan, buka skin yang menyala, dan jalankan putaran kursor.
pub fn start(app: &AppHandle) {
    let skins = app.state::<Skins>();
    load_saved(&skins);
    install_builtins(&skins);
    scan(&skins);
    let enabled = skins.saved.lock().unwrap().enabled.clone();
    let infos: Vec<SkinInfo> = skins.infos.lock().unwrap().iter().filter(|i| enabled.contains(&i.id)).cloned().collect();
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        for info in infos {
            open_skin(handle.clone(), info).await;
        }
    });
    spawn_loop(app.clone());
}

// -------------------------------------------------------------------------------------------- perintah ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StateView {
    skins: Vec<SkinInfo>,
    enabled: Vec<String>,
    on_top: bool,
    scale: f64,
    arranging: bool,
    mimik: Value,
    presets: Value,
    folder: String,
}

#[tauri::command]
pub fn skins_state(app: AppHandle) -> StateView {
    let skins = app.state::<Skins>();
    let saved = skins.saved.lock().unwrap().clone();
    let infos = skins.infos.lock().unwrap().clone();
    let folder = skins.folder.to_string_lossy().to_string();
    let arranging = skins.arranging.load(Ordering::Relaxed);
    StateView {
        skins: infos,
        enabled: saved.enabled,
        on_top: saved.on_top,
        scale: saved.scale,
        arranging,
        mimik: saved.mimik,
        presets: saved.presets,
        folder,
    }
}

/// Menyalakan atau mematikan satu skin. Async: membuat jendela dari perintah sinkron membuat WebView2 macet.
#[tauri::command]
pub async fn skins_set_enabled(app: AppHandle, id: String, on: bool) {
    let skins = app.state::<Skins>();
    {
        let mut saved = skins.saved.lock().unwrap();
        saved.enabled.retain(|e| e != &id);
        if on {
            saved.enabled.push(id.clone());
        }
    }
    persist(&skins);
    if on {
        if let Some(info) = info_of(&skins, &id) {
            open_skin(app.clone(), info).await;
        }
    } else {
        close_skin(&app, &id);
    }
}

/// Tingkat jendela (`onTop`) dan ukuran (`scale`, 0,5 sampai 2,5).
#[tauri::command]
pub fn skins_set_option(app: AppHandle, on_top: Option<bool>, scale: Option<f64>) {
    let skins = app.state::<Skins>();
    {
        let mut saved = skins.saved.lock().unwrap();
        if let Some(v) = on_top {
            saved.on_top = v;
        }
        if let Some(v) = scale {
            saved.scale = v.clamp(0.5, 2.5);
        }
    }
    persist(&skins);
    let (top, scale) = {
        let s = skins.saved.lock().unwrap();
        (s.on_top, s.scale)
    };
    let arranging = skins.arranging.load(Ordering::Relaxed);
    for (id, w) in skin_windows(&app) {
        apply_level(&w, top, arranging);
        if let Some(info) = info_of(&skins, &id) {
            let _ = w.set_zoom(scale);
            // Sudut kiri atas tetap: ukuran jendela berubah tanpa memindahkan posisinya.
            let _ = w.set_size(tauri::LogicalSize::new(info.width * scale, info.height * scale));
        }
    }
}

/// Mode Atur posisi: semua skin naik ke atas, berbingkai, dan bisa diseret bebas.
#[tauri::command]
pub fn skins_set_arranging(app: AppHandle, on: bool) {
    let skins = app.state::<Skins>();
    skins.arranging.store(on, Ordering::Relaxed);
    let top = skins.saved.lock().unwrap().on_top;
    for (_, w) in skin_windows(&app) {
        apply_level(&w, top, on);
        eval(&w, &arrange_css(on));
    }
}

/// Hapus posisi tersimpan; skin kembali ke posisi awal (`anchor`).
#[tauri::command]
pub fn skins_reset_positions(app: AppHandle) {
    let skins = app.state::<Skins>();
    skins.saved.lock().unwrap().origins.clear();
    persist(&skins);
    let scale = skins.saved.lock().unwrap().scale;
    for (id, w) in skin_windows(&app) {
        if let Some(info) = info_of(&skins, &id) {
            let _ = w.set_position(default_origin(&app, &info, scale));
        }
    }
}

#[tauri::command]
pub fn skins_reveal(app: AppHandle) {
    let skins = app.state::<Skins>();
    let _ = fs::create_dir_all(&skins.folder);
    winsys::open_target(&skins.folder.to_string_lossy());
}

/// Baca ulang folder dan muat ulang halaman semua skin yang menyala (berguna saat mengedit skin).
#[tauri::command]
pub async fn skins_reload(app: AppHandle) {
    let skins = app.state::<Skins>();
    scan(&skins);
    let infos = skins.infos.lock().unwrap().clone();
    let enabled = skins.saved.lock().unwrap().enabled.clone();
    for (id, w) in skin_windows(&app) {
        if infos.iter().any(|i| i.id == id) {
            eval(&w, "location.reload()");
        } else {
            close_skin(&app, &id);
        }
    }
    for info in infos.into_iter().filter(|i| enabled.contains(&i.id)) {
        open_skin(app.clone(), info).await;
    }
    let _ = app.emit("skins-changed", ());
}

/// Gaya wajah Mimik dari playground: disimpan dan langsung dikirim ke skin di desktop.
#[tauri::command]
pub fn skins_save_mimik(app: AppHandle, style: Value) {
    let skins = app.state::<Skins>();
    skins.saved.lock().unwrap().mimik = style;
    persist(&skins);
    if let Some(w) = app.get_webview_window(&label("mimik")) {
        push_config(&app, &w, "mimik");
    }
}

#[tauri::command]
pub fn skins_save_presets(app: AppHandle, presets: Value) {
    let skins = app.state::<Skins>();
    skins.saved.lock().unwrap().presets = presets;
    persist(&skins);
}

/// Reaksi sesaat dari playground (boing, putar, dan seterusnya). Mengembalikan nomor urut untuk pratinjau.
#[tauri::command]
pub fn skins_react(app: AppHandle, name: String) -> u32 {
    let skins = app.state::<Skins>();
    let n = {
        let mut r = skins.reaction.lock().unwrap();
        *r = (name, r.1 + 1);
        r.1
    };
    if let Some(w) = app.get_webview_window(&label("mimik")) {
        push_config(&app, &w, "mimik");
    }
    n
}

/// Data terbaru dari jendela Notch (satu objek JSON, bentuknya sama dengan `payload()` di Mac). Konfigurasi Mimik ditambahkan di sini.
#[tauri::command]
pub fn skins_push(app: AppHandle, json: String) {
    let Ok(mut data) = serde_json::from_str::<Value>(&json) else { return };
    if !data.is_object() {
        return;
    }
    for (id, w) in skin_windows(&app) {
        if id == "mimik" {
            data["config"] = page_json(&app, &id);
        } else if let Value::Object(map) = &mut data {
            map.remove("config");
        }
        eval(&w, &format!("window.cognify&&window.cognify._push({data})"));
    }
}

/// Irama lagu untuk skin berpermintaan audio: kerasnya musik, jumlah ketukan, detik per ketukan, dan apakah terdengar.
#[tauri::command]
pub fn skins_audio(app: AppHandle, energy: f64, beats: u32, period: f64, on: bool) {
    let skins = app.state::<Skins>();
    for (id, w) in skin_windows(&app) {
        if info_of(&skins, &id).map(|i| i.audio).unwrap_or(false) {
            eval(&w, &format!("window.cognify&&window.cognify._audio({energy:.3},{beats},{period:.3},{on})"));
        }
    }
}

/// Kursor masuk atau keluar dari notch (skin dengan `"notch": true`).
#[tauri::command]
pub fn skins_hover(app: AppHandle, inside: bool) {
    let skins = app.state::<Skins>();
    for (id, w) in skin_windows(&app) {
        if info_of(&skins, &id).map(|i| i.notch).unwrap_or(false) {
            eval(&w, &format!("window.cognify&&window.cognify._notch({inside})"));
        }
    }
}

/// Ada notifikasi atau kabar di notch (skin dengan `"notch": true`).
#[tauri::command]
pub fn skins_notice(app: AppHandle) {
    let skins = app.state::<Skins>();
    for (id, w) in skin_windows(&app) {
        if info_of(&skins, &id).map(|i| i.notch).unwrap_or(false) {
            eval(&w, "window.cognify&&window.cognify._notice()");
        }
    }
}
