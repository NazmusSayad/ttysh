mod frame;
mod ghostty;
mod keeper;
mod server;

use std::path::PathBuf;

const SERVER_PORT: u16 = 47831;
const KEEPER_PORT: u16 = 47832;

fn data_directory() -> PathBuf {
    dirs::home_dir().expect("home directory not found").join(".ttysh")
}

fn main() {
    let command = std::env::args().nth(1);
    match command.as_deref() {
        None => server::run(),
        Some("keeper") => keeper::run(),
        Some(other) => {
            eprintln!("unknown command: {other}");
            std::process::exit(2);
        }
    }
}
