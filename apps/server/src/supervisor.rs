use std::process::{self, Command, Stdio};

pub const RESTART_CODE: i32 = 75;

pub fn run(host: &str, port: u16) {
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
