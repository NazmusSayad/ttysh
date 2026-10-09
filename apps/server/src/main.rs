mod config;
mod frame;
mod keeper;
mod lock;
mod logging;
mod server;
mod stop;
mod supervisor;
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
    #[arg(
        long,
        global = true,
        help = "Write detailed logs and serve them at /api/debug/logs"
    )]
    debug: bool,
    #[command(subcommand)]
    command: Option<Command>,
}

#[derive(Subcommand)]
enum Command {
    #[command(hide = true)]
    Server {
        #[arg(long)]
        session: String,
    },
    #[command(hide = true)]
    Keeper,
    #[command(about = "Stop ttysh and end all its terminals")]
    Stop,
}

fn main() {
    let cli = Cli::parse();
    match cli.command {
        None => supervisor::run(&cli.host, cli.port, cli.debug),
        Some(Command::Server { session }) => server::run(cli.host, cli.port, cli.debug, &session),
        Some(Command::Keeper) => keeper::run(cli.debug),
        Some(Command::Stop) => stop::run(),
    }
}
