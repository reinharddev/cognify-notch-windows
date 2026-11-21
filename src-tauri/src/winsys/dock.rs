//! Bahan dock: daftar jendela yang tampil di taskbar, ikon aplikasi, mengaktifkan atau menutup jendela,
//! menyembunyikan taskbar Windows, dan mengirim tombol Windows (Start, Pengaturan cepat, Notifikasi).
//!
//! Di platform selain Windows semuanya kosong, supaya proyek tetap bisa diperiksa tipenya di Mac.

use super::DockWindow;

#[cfg(windows)]
pub use real::*;
#[cfg(not(windows))]
pub use stub::*;

/// Aturan murni yang dipakai pemindai jendela. Terpisah dari Windows API supaya bisa diuji di mana saja.
pub mod rules {
    /// Kelas jendela milik shell Windows yang tidak pernah tampil sebagai aplikasi di taskbar.
    pub fn is_shell_class(class: &str) -> bool {
        matches!(
            class,
            "Progman"
                | "WorkerW"
                | "Shell_TrayWnd"
                | "Shell_SecondaryTrayWnd"
                | "XamlExplorerHostIslandWindow"
                | "ForegroundStaging"
                | "Windows.UI.Core.CoreWindow"
                | "NotifyIconOverflowWindow"
                | "TopLevelWindowForOverflowXamlIsland"
        )
    }

    /// Jendela layak tampil di taskbar bila terlihat, berjudul, tidak tersaput (cloaked), dan bukan jendela alat
    /// atau milik jendela lain, kecuali ia sendiri minta tampil di taskbar (`WS_EX_APPWINDOW`).
    pub fn eligible(visible: bool, has_title: bool, cloaked: bool, tool_window: bool, no_activate: bool, app_window: bool, has_owner: bool) -> bool {
        visible && has_title && !cloaked && !no_activate && (app_window || (!tool_window && !has_owner))
    }

    /// Nama tampilan dari jalur program: "C:\\Program Files\\App\\app.exe" menjadi "app".
    pub fn app_name(exe: &str) -> String {
        let file = exe.rsplit(['\\', '/']).next().unwrap_or(exe);
        file.strip_suffix(".exe").or_else(|| file.strip_suffix(".EXE")).unwrap_or(file).to_string()
    }

    /// Dua jalur program sama bila hanya beda huruf besar kecil (Windows tidak membedakannya).
    pub fn same_exe(a: &str, b: &str) -> bool {
        a.eq_ignore_ascii_case(b)
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn shell_windows_are_never_apps() {
            assert!(is_shell_class("Shell_TrayWnd"));
            assert!(is_shell_class("Progman"));
            assert!(!is_shell_class("Chrome_WidgetWin_1"));
            assert!(!is_shell_class("ApplicationFrameWindow"));
        }

        #[test]
        fn a_normal_window_is_listed() {
            assert!(eligible(true, true, false, false, false, false, false));
        }

        #[test]
        fn hidden_untitled_cloaked_and_non_activating_windows_are_not() {
            assert!(!eligible(false, true, false, false, false, false, false));
            assert!(!eligible(true, false, false, false, false, false, false));
            assert!(!eligible(true, true, true, false, false, false, false), "UWP app suspended on another desktop");
            assert!(!eligible(true, true, false, false, true, false, false));
        }

        #[test]
        fn tool_windows_and_owned_dialogs_are_not_unless_they_ask() {
            assert!(!eligible(true, true, false, true, false, false, false));
            assert!(!eligible(true, true, false, false, false, false, true));
            assert!(eligible(true, true, false, true, false, true, false), "WS_EX_APPWINDOW wins over TOOLWINDOW");
            assert!(eligible(true, true, false, false, false, true, true), "WS_EX_APPWINDOW wins over an owner");
        }

        #[test]
        fn names_come_from_the_file_name() {
            assert_eq!(app_name(r"C:\Program Files\Google\Chrome\Application\chrome.exe"), "chrome");
            assert_eq!(app_name("C:/Tools/Code.EXE"), "Code");
            assert_eq!(app_name("notepad"), "notepad");
        }

        #[test]
        fn paths_are_compared_without_case() {
            assert!(same_exe(r"C:\A\app.exe", r"c:\a\APP.exe"));
            assert!(!same_exe(r"C:\A\app.exe", r"C:\A\other.exe"));
        }
    }
}

#[cfg(not(windows))]
mod stub {
    use super::DockWindow;

    pub fn dock_windows() -> Vec<DockWindow> {
        Vec::new()
    }
    pub fn dock_activate(_id: i64) {}
    pub fn dock_toggle(_id: i64) {}
    pub fn dock_close(_id: i64) {}
    pub fn dock_icon(_exe: &str) -> Option<String> {
        None
    }
    pub fn taskbar_state() -> Option<u32> {
        None
    }
    pub fn taskbar_apply(_hidden: bool, _original: u32) -> Result<(), String> {
        Err("Taskbar hanya ada di Windows".into())
    }
    pub fn tap_keys(_name: &str) {}
}

#[cfg(windows)]
mod real {
    use std::ffi::c_void;
    use std::mem::size_of;

    use windows::core::{w, BOOL, PCWSTR, PWSTR};
    use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, TRUE, WPARAM};
    use windows::Win32::Graphics::Dwm::{DwmGetWindowAttribute, DWMWA_CLOAKED};
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO, BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS,
    };
    use windows::Win32::Storage::FileSystem::FILE_ATTRIBUTE_NORMAL;
    use windows::Win32::System::Threading::{
        GetCurrentProcessId, OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::UI::Controls::{IImageList, ILD_TRANSPARENT};
    use windows::Win32::UI::Input::KeyboardAndMouse::{keybd_event, KEYEVENTF_KEYUP, VK_LWIN, VK_MENU};
    use windows::Win32::UI::Shell::{
        SHAppBarMessage, SHGetFileInfoW, SHGetImageList, ABM_GETSTATE, ABM_SETSTATE, ABS_AUTOHIDE, APPBARDATA, SHFILEINFOW,
        SHGFI_ICON, SHGFI_LARGEICON, SHGFI_SYSICONINDEX, SHIL_EXTRALARGE,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        DestroyIcon, EnumChildWindows, EnumWindows, FindWindowExW, FindWindowW, GetClassNameW, GetForegroundWindow, GetIconInfo,
        GetWindow, GetWindowLongPtrW, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindowVisible,
        PostMessageW, SetForegroundWindow, ShowWindow, GWL_EXSTYLE, GW_OWNER, HICON, ICONINFO, SW_HIDE, SW_MINIMIZE, SW_RESTORE,
        SW_SHOWNA, WM_CLOSE, WS_EX_APPWINDOW, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW,
    };

    use super::{rules, DockWindow};

    fn hwnd_of(id: i64) -> HWND {
        HWND(id as isize as *mut c_void)
    }

    unsafe extern "system" fn collect(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<HWND>);
        list.push(hwnd);
        TRUE
    }

    unsafe extern "system" fn collect_children(hwnd: HWND, lparam: LPARAM) -> BOOL {
        let list = &mut *(lparam.0 as *mut Vec<HWND>);
        list.push(hwnd);
        TRUE
    }

    unsafe fn class_of(hwnd: HWND) -> String {
        let mut buf = [0u16; 256];
        let n = GetClassNameW(hwnd, &mut buf);
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    unsafe fn title_of(hwnd: HWND) -> String {
        let len = GetWindowTextLengthW(hwnd);
        if len <= 0 {
            return String::new();
        }
        let mut buf = vec![0u16; len as usize + 1];
        let n = GetWindowTextW(hwnd, &mut buf);
        String::from_utf16_lossy(&buf[..n.max(0) as usize])
    }

    unsafe fn pid_of(hwnd: HWND) -> u32 {
        let mut pid = 0u32;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        pid
    }

    unsafe fn exe_of_pid(pid: u32) -> Option<String> {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 1040];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buf.as_mut_ptr()), &mut len).is_ok();
        let _ = CloseHandle(process);
        ok.then(|| String::from_utf16_lossy(&buf[..len as usize]))
    }

    /// Aplikasi UWP tampil di dalam `ApplicationFrameHost`; program aslinya ada di jendela anak
    /// berkelas `Windows.UI.Core.CoreWindow` dengan proses yang berbeda.
    unsafe fn real_pid(hwnd: HWND, frame_pid: u32) -> u32 {
        if class_of(hwnd) != "ApplicationFrameWindow" {
            return frame_pid;
        }
        let mut children: Vec<HWND> = Vec::new();
        let _ = EnumChildWindows(Some(hwnd), Some(collect_children), LPARAM(&mut children as *mut Vec<HWND> as isize));
        children
            .into_iter()
            .map(|c| pid_of(c))
            .find(|p| *p != 0 && *p != frame_pid)
            .unwrap_or(frame_pid)
    }

    /// Jendela yang tampil di taskbar Windows, kecuali milik Cognify Notch sendiri.
    pub fn dock_windows() -> Vec<DockWindow> {
        unsafe {
            let mut all: Vec<HWND> = Vec::new();
            if EnumWindows(Some(collect), LPARAM(&mut all as *mut Vec<HWND> as isize)).is_err() {
                return Vec::new();
            }
            let own = GetCurrentProcessId();
            let foreground = GetForegroundWindow();
            let mut out = Vec::new();
            for hwnd in all {
                let title = title_of(hwnd);
                let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
                let cloaked = {
                    let mut value = 0u32;
                    DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &mut value as *mut u32 as *mut c_void, size_of::<u32>() as u32).is_ok() && value != 0
                };
                let has_owner = GetWindow(hwnd, GW_OWNER).map(|o| !o.0.is_null()).unwrap_or(false);
                if !rules::eligible(
                    IsWindowVisible(hwnd).as_bool(),
                    !title.is_empty(),
                    cloaked,
                    ex & WS_EX_TOOLWINDOW.0 != 0,
                    ex & WS_EX_NOACTIVATE.0 != 0,
                    ex & WS_EX_APPWINDOW.0 != 0,
                    has_owner,
                ) {
                    continue;
                }
                if rules::is_shell_class(&class_of(hwnd)) {
                    continue;
                }
                let frame_pid = pid_of(hwnd);
                if frame_pid == own {
                    continue;
                }
                let Some(exe) = exe_of_pid(real_pid(hwnd, frame_pid)) else { continue };
                out.push(DockWindow {
                    id: hwnd.0 as isize as i64,
                    name: rules::app_name(&exe),
                    title,
                    exe,
                    active: hwnd == foreground,
                });
            }
            out
        }
    }

    // ---------- Mengaktifkan dan menutup ----------

    /// Windows menolak `SetForegroundWindow` dari proses yang tidak sedang aktif; menekan Alt sekali
    /// membuat panggilan itu diizinkan (cara yang dipakai banyak peluncur).
    pub fn dock_activate(id: i64) {
        unsafe {
            let hwnd = hwnd_of(id);
            if IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_RESTORE);
            }
            keybd_event(VK_MENU.0 as u8, 0, Default::default(), 0);
            keybd_event(VK_MENU.0 as u8, 0, KEYEVENTF_KEYUP, 0);
            let _ = SetForegroundWindow(hwnd);
        }
    }

    /// Seperti klik di taskbar: jendela yang sedang di depan diminimalkan, yang lain dibawa ke depan.
    pub fn dock_toggle(id: i64) {
        unsafe {
            let hwnd = hwnd_of(id);
            if GetForegroundWindow() == hwnd && !IsIconic(hwnd).as_bool() {
                let _ = ShowWindow(hwnd, SW_MINIMIZE);
            } else {
                dock_activate(id);
            }
        }
    }

    pub fn dock_close(id: i64) {
        unsafe {
            let _ = PostMessageW(Some(hwnd_of(id)), WM_CLOSE, WPARAM(0), LPARAM(0));
        }
    }

    // ---------- Ikon aplikasi ----------

    /// Ikon aplikasi sebagai data URL PNG (48 px bila tersedia), atau None bila tidak terbaca.
    pub fn dock_icon(exe: &str) -> Option<String> {
        use base64::Engine;
        super::super::init_thread();
        let (w, h, rgba) = unsafe { icon_pixels(exe)? };
        let mut out = Vec::new();
        {
            let mut enc = png::Encoder::new(&mut out, w, h);
            enc.set_color(png::ColorType::Rgba);
            enc.set_depth(png::BitDepth::Eight);
            enc.write_header().ok()?.write_image_data(&rgba).ok()?;
        }
        Some(format!("data:image/png;base64,{}", base64::engine::general_purpose::STANDARD.encode(out)))
    }

    unsafe fn icon_pixels(exe: &str) -> Option<(u32, u32, Vec<u8>)> {
        let path: Vec<u16> = exe.encode_utf16().chain(std::iter::once(0)).collect();
        let mut info = SHFILEINFOW::default();
        let size = size_of::<SHFILEINFOW>() as u32;

        // Daftar gambar sistem ukuran 48 px: lebih tajam dari ikon 32 px bawaan.
        let got = SHGetFileInfoW(PCWSTR(path.as_ptr()), FILE_ATTRIBUTE_NORMAL, Some(&mut info), size, SHGFI_SYSICONINDEX);
        if got != 0 {
            if let Ok(list) = SHGetImageList::<IImageList>(SHIL_EXTRALARGE as i32) {
                if let Ok(icon) = list.GetIcon(info.iIcon, ILD_TRANSPARENT.0 as u32) {
                    let pixels = hicon_pixels(icon);
                    let _ = DestroyIcon(icon);
                    if pixels.is_some() {
                        return pixels;
                    }
                }
            }
        }

        let mut info = SHFILEINFOW::default();
        let got = SHGetFileInfoW(PCWSTR(path.as_ptr()), FILE_ATTRIBUTE_NORMAL, Some(&mut info), size, SHGFI_ICON | SHGFI_LARGEICON);
        if got == 0 || info.hIcon.is_invalid() {
            return None;
        }
        let pixels = hicon_pixels(info.hIcon);
        let _ = DestroyIcon(info.hIcon);
        pixels
    }

    /// Piksel RGBA dari ikon. Ikon lama tanpa saluran alfa dianggap buram di piksel yang berwarna.
    unsafe fn hicon_pixels(icon: HICON) -> Option<(u32, u32, Vec<u8>)> {
        let mut info = ICONINFO::default();
        GetIconInfo(icon, &mut info).ok()?;
        let result = (|| {
            let mut bitmap = BITMAP::default();
            if GetObjectW(info.hbmColor.into(), size_of::<BITMAP>() as i32, Some(&mut bitmap as *mut BITMAP as *mut c_void)) == 0 {
                return None;
            }
            let (w, h) = (bitmap.bmWidth, bitmap.bmHeight);
            if w <= 0 || h <= 0 || w > 512 || h > 512 {
                return None;
            }
            let mut bmi = BITMAPINFO::default();
            bmi.bmiHeader = BITMAPINFOHEADER {
                biSize: size_of::<BITMAPINFOHEADER>() as u32,
                biWidth: w,
                biHeight: -h, // atas ke bawah
                biPlanes: 1,
                biBitCount: 32,
                biCompression: BI_RGB.0,
                ..Default::default()
            };
            let mut px = vec![0u8; (w * h * 4) as usize];
            let dc = GetDC(None);
            let rows = GetDIBits(dc, info.hbmColor, 0, h as u32, Some(px.as_mut_ptr() as *mut c_void), &mut bmi, DIB_RGB_COLORS);
            ReleaseDC(None, dc);
            if rows == 0 {
                return None;
            }
            let has_alpha = px.chunks_exact(4).any(|p| p[3] != 0);
            for p in px.chunks_exact_mut(4) {
                p.swap(0, 2); // BGRA ke RGBA
                if !has_alpha {
                    p[3] = if p[0] | p[1] | p[2] != 0 { 255 } else { 0 };
                }
            }
            Some((w as u32, h as u32, px))
        })();
        if !info.hbmColor.is_invalid() {
            let _ = DeleteObject(info.hbmColor.into());
        }
        if !info.hbmMask.is_invalid() {
            let _ = DeleteObject(info.hbmMask.into());
        }
        result
    }

    // ---------- Taskbar Windows ----------

    unsafe fn taskbars() -> Vec<HWND> {
        let mut list = Vec::new();
        if let Ok(main) = FindWindowW(w!("Shell_TrayWnd"), PCWSTR::null()) {
            list.push(main);
        }
        let mut after: Option<HWND> = None;
        while let Ok(next) = FindWindowExW(None, after, w!("Shell_SecondaryTrayWnd"), PCWSTR::null()) {
            if next.0.is_null() {
                break;
            }
            list.push(next);
            after = Some(next);
        }
        list
    }

    /// Keadaan taskbar utama saat ini (bit `ABS_AUTOHIDE` dan `ABS_ALWAYSONTOP`), atau None bila tidak ada.
    /// Simpan nilai ini sebelum menyembunyikan, lalu berikan lagi ke `taskbar_apply(false, ..)`.
    pub fn taskbar_state() -> Option<u32> {
        unsafe {
            let main = taskbars().first().copied()?;
            let mut data = APPBARDATA { cbSize: size_of::<APPBARDATA>() as u32, hWnd: main, ..Default::default() };
            Some(SHAppBarMessage(ABM_GETSTATE, &mut data) as u32)
        }
    }

    /// Menyembunyikan taskbar Windows (juga di layar kedua), atau menampilkannya lagi dengan keadaan `original`.
    /// Sembunyi memakai sembunyi-otomatis bawaan Windows (supaya jendela lain memakai tinggi penuh) lalu
    /// menyembunyikan jendelanya, sehingga tidak muncul saat kursor ke tepi bawah.
    pub fn taskbar_apply(hidden: bool, original: u32) -> Result<(), String> {
        unsafe {
            let bars = taskbars();
            let Some(main) = bars.first().copied() else {
                return Err("Taskbar Windows tidak ditemukan".into());
            };
            let set_state = |state: u32| {
                let mut data =
                    APPBARDATA { cbSize: size_of::<APPBARDATA>() as u32, hWnd: main, lParam: LPARAM(state as isize), ..Default::default() };
                SHAppBarMessage(ABM_SETSTATE, &mut data);
            };
            if hidden {
                set_state(original | ABS_AUTOHIDE as u32);
                for bar in &bars {
                    let _ = ShowWindow(*bar, SW_HIDE);
                }
            } else {
                for bar in &bars {
                    let _ = ShowWindow(*bar, SW_SHOWNA);
                }
                set_state(original);
            }
        }
        Ok(())
    }

    // ---------- Tombol Windows ----------

    /// "start": tombol Windows; "quick": Win+A (Pengaturan cepat); "notifications": Win+N (Notifikasi dan kalender).
    pub fn tap_keys(name: &str) {
        let extra: Option<u8> = match name {
            "start" => None,
            "quick" => Some(0x41),         // A
            "notifications" => Some(0x4E), // N
            _ => return,
        };
        unsafe {
            keybd_event(VK_LWIN.0 as u8, 0, Default::default(), 0);
            if let Some(key) = extra {
                keybd_event(key, 0, Default::default(), 0);
                keybd_event(key, 0, KEYEVENTF_KEYUP, 0);
            }
            keybd_event(VK_LWIN.0 as u8, 0, KEYEVENTF_KEYUP, 0);
        }
    }
}
