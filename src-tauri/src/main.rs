// Jangan membuka jendela konsol di Windows pada build rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Harus pertama: installer Velopack memanggil app ini dengan argumen khusus saat pasang, perbarui, dan hapus.
    velopack::VelopackApp::build().run();
    cognify_notch_lib::run()
}
