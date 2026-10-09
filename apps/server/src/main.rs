mod config;
mod frame;
mod keeper;
mod server;
mod utils;

use clap::{Parser, Subcommand};

const KEEPER_PORT: u16 = 47832;

#[derive(Parser)]
#[command(version, about)]
struct Cli {
    #[arg(long, default_value = "127.0.0.1", help = "Address to listen on")]
    host: String,
    #[arg(long, default_value_t = 47831, help = "Port to listen on")]
    port: u16,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    #[command(hide = true)]
    Keeper,
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        None => server::run(cli.host, cli.port),
        Some(Command::Keeper) => keeper::run(),
    }
}
