// Jangan membuka jendela konsol di Windows pada build rilis.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    cognify_notch_lib::run()
}
