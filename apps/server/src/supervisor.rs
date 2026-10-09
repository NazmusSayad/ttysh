use std::process::{self, Command, Stdio};

use crate::lock::{self, Running};

pub const RESTART_CODE: i32 = 75;

pub fn run(host: &str, port: u16) {
    let _lock = match lock::try_acquire() {
        Ok(Some(lock)) => lock,
        Ok(None) => {
            match lock::read_running() {
                Ok(running) => eprintln!("ttysh is already running at {}", running.url()),
                Err(error) => eprintln!("ttysh is already running ({error})"),
            }
            eprintln!("Open it in your browser, or run `ttysh stop` to stop it first.");
            process::exit(1);
        }
        Err(error) => {
            eprintln!("could not check whether ttysh is already running: {error}");
            process::exit(1);
        }
    };
    let running = Running {
        pid: process::id(),
        host: host.to_string(),
        port,
    };
    if let Err(error) = lock::write_running(&running) {
        eprintln!("could not record the running ttysh: {error}");
        process::exit(1);
    }
    let executable = match std::env::current_exe() {
        Ok(executable) => executable,
        Err(error) => {
            eprintln!("could not find the ttysh executable: {error}");
            process::exit(1);
        }
    };
    loop {
        let mut child = match Command::new(&executable)
            .args(["--host", host, "--port", &port.to_string(), "server"])
            .stdin(Stdio::piped())
            .spawn()
        {
            Ok(child) => child,
            Err(error) => {
                eprintln!("could not start the server: {error}");
                process::exit(1);
            }
        };
        let stdin = child.stdin.take();
        let status = child.wait();
        drop(stdin);
        match status {
            Ok(status) => match status.code() {
                Some(RESTART_CODE) => println!("restarting"),
                Some(code) => process::exit(code),
                None => process::exit(1),
            },
            Err(error) => {
                eprintln!("could not wait for the server: {error}");
                process::exit(1);
            }
        }
    }
}
