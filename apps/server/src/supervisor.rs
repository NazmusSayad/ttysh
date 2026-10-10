use std::process::{self, Command, Stdio};

use crate::{
    lock::{self, Running},
    logging,
    utils::paths,
};

pub const RESTART_CODE: i32 = 75;

pub fn run(host: &str, port: u16, debug: bool) {
    let _lock = match lock::try_acquire() {
        Ok(Some(lock)) => lock,
        Ok(None) => {
            match lock::read_running() {
                Ok(running) => eprintln!("sshtty is already running at {}", running.url()),
                Err(error) => eprintln!("sshtty is already running ({error})"),
            }
            eprintln!("Open it in your browser, or run `sshtty stop` to stop it first.");
            process::exit(1);
        }
        Err(error) => {
            eprintln!("could not check whether sshtty is already running: {error}");
            process::exit(1);
        }
    };
    let session = logging::run_id();
    logging::init(&format!("session-{session}.log"), debug, true);
    let running = Running {
        pid: process::id(),
        host: host.to_string(),
        port,
    };
    if let Err(error) = lock::write_running(&running) {
        tracing::error!("could not record the running sshtty: {error}");
        process::exit(1);
    }
    let executable = match std::env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            tracing::error!("could not find the sshtty executable: {error}");
            process::exit(1);
        }
    };
    loop {
        let mut command = Command::new(&executable);
        command.args(["--host", host, "--port", &port.to_string()]);
        command.arg("--config").arg(paths::root());
        if debug {
            command.arg("--debug");
        }
        let mut child = match command
            .args(["server", "--session", &session])
            .stdin(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                tracing::error!("could not start the server: {error}");
                process::exit(1);
            }
        };
        let stdin = child.stdin.take();
        let status = child.wait();
        drop(stdin);
        match status {
            Ok(status) => match status.code() {
                Some(RESTART_CODE) => tracing::info!("server asked to restart"),
                Some(code) => {
                    tracing::info!(code, "server exited");
                    process::exit(code);
                }
                None => {
                    tracing::error!(%status, "server was stopped by a signal");
                    process::exit(1);
                }
            },
            Err(error) => {
                tracing::error!("could not wait for the server: {error}");
                process::exit(1);
            }
        }
    }
}
