mod config;
mod frame;
mod keeper;
mod server;
mod utils;

const SERVER_PORT: u16 = 47831;
const KEEPER_PORT: u16 = 47832;

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
