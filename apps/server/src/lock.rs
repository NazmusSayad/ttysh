use std::{
    fs::{self, File, OpenOptions, TryLockError},
    io,
    path::Path,
};

use serde::{Deserialize, Serialize};

use crate::utils::paths;

#[derive(Serialize, Deserialize)]
pub struct Running {
    pub pid: u32,
    pub host: String,
    pub port: u16,
}

impl Running {
    pub fn url(&self) -> String {
        match self.host.contains(':') {
            true => format!("http://[{}]:{}", self.host, self.port),
            false => format!("http://{}:{}", self.host, self.port),
        }
    }
}

pub enum Keeper {
    Stopped,
    Starting,
    Running(u16),
}

pub fn try_acquire() -> io::Result<Option<File>> {
    try_lock(&paths::lock_file())
}

pub fn try_acquire_keeper() -> io::Result<Option<File>> {
    try_lock(&paths::keeper_lock_file())
}

fn try_lock(path: &Path) -> io::Result<Option<File>> {
    fs::create_dir_all(paths::root())?;
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(path)?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

pub fn keeper() -> io::Result<Keeper> {
    if try_acquire_keeper()?.is_some() {
        return Ok(Keeper::Stopped);
    }
    let text = match fs::read_to_string(paths::keeper_port_file()) {
        Ok(text) => text,
        Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(Keeper::Starting),
        Err(error) => return Err(error),
    };
    text.trim().parse().map(Keeper::Running).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("invalid keeper port: {error}"),
        )
    })
}

pub fn write_keeper_port(port: u16) -> io::Result<()> {
    fs::write(paths::keeper_port_file(), port.to_string())
}

pub fn remove_keeper_port() -> io::Result<()> {
    match fs::remove_file(paths::keeper_port_file()) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error),
    }
}

pub fn write_running(running: &Running) -> io::Result<()> {
    let text = serde_json::to_string(running).expect("running details serialize");
    fs::write(paths::running_file(), text)
}

pub fn read_running() -> Result<Running, String> {
    let path = paths::running_file();
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("could not read {}: {error}", path.display()))?;
    serde_json::from_str(&text).map_err(|error| format!("invalid {}: {error}", path.display()))
}
