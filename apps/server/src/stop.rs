use std::{
    io::{self, Read, Write},
    net::TcpStream,
    process, thread,
    time::{Duration, Instant},
};

use crate::{
    frame,
    lock::{self, Keeper, Running},
};

pub fn run() {
    let stopped_server = match lock::try_acquire() {
        Ok(Some(_)) => false,
        Ok(None) => match stop_server() {
            Ok(running) => {
                println!("Stopped ttysh at {}", running.url());
                true
            }
            Err(error) => fail(&error),
        },
        Err(error) => fail(&format!(
            "could not check whether ttysh is running: {error}"
        )),
    };
    let stopped_keeper = match stop_keeper() {
        Ok(stopped) => stopped,
        Err(error) => fail(&error),
    };
    if stopped_keeper {
        println!("Stopped the keeper and ended all terminals");
    }
    if !stopped_server && !stopped_keeper {
        println!("ttysh is not running");
    }
}

fn fail(error: &str) -> ! {
    eprintln!("{error}");
    process::exit(1);
}

fn stop_server() -> Result<Running, String> {
    let running = lock::read_running()?;
    terminate(running.pid)
        .map_err(|error| format!("could not stop ttysh (pid {}): {error}", running.pid))?;
    let server = match running.host.as_str() {
        "0.0.0.0" => "127.0.0.1",
        "::" => "::1",
        host => host,
    };
    let deadline = Instant::now() + Duration::from_secs(10);
    while Instant::now() < deadline {
        let unlocked = lock::try_acquire()
            .map_err(|error| format!("could not check whether ttysh stopped: {error}"))?
            .is_some();
        if unlocked && TcpStream::connect((server, running.port)).is_err() {
            return Ok(running);
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err(format!(
        "ttysh (pid {}) did not stop within 10 seconds",
        running.pid
    ))
}

fn stop_keeper() -> Result<bool, String> {
    let port = match lock::keeper() {
        Ok(Keeper::Running(port)) => port,
        Ok(Keeper::Stopped) => return Ok(false),
        Ok(Keeper::Starting) => {
            return Err("The keeper is still starting; try again in a moment.".to_string());
        }
        Err(error) => return Err(format!("could not check the keeper: {error}")),
    };
    let mut stream = TcpStream::connect(("127.0.0.1", port))
        .map_err(|error| format!("could not reach the keeper: {error}"))?;
    stream
        .write_all(&frame::encode(frame::SHUTDOWN, 0, &[]))
        .map_err(|error| format!("could not reach the keeper: {error}"))?;
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| format!("could not wait for the keeper: {error}"))?;
    let mut buffer = [0; 4096];
    loop {
        match stream.read(&mut buffer) {
            Ok(0) => return Ok(true),
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::ConnectionReset => return Ok(true),
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
                ) =>
            {
                return Err("The keeper did not stop within 5 seconds; stop the \"ttysh keeper\" process manually.".to_string());
            }
            Err(error) => return Err(format!("could not wait for the keeper: {error}")),
        }
    }
}

#[cfg(unix)]
fn terminate(pid: u32) -> io::Result<()> {
    let pid = libc::pid_t::try_from(pid).map_err(io::Error::other)?;
    match unsafe { libc::kill(pid, libc::SIGTERM) } {
        0 => Ok(()),
        _ => Err(io::Error::last_os_error()),
    }
}

#[cfg(windows)]
fn terminate(pid: u32) -> io::Result<()> {
    let status = process::Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .stdout(process::Stdio::null())
        .status()?;
    match status.success() {
        true => Ok(()),
        false => Err(io::Error::other(format!("taskkill exited with {status}"))),
    }
}
