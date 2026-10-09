use std::{
    fs::{self, File, OpenOptions, TryLockError},
    io,
};

use serde::{Deserialize, Serialize};

use crate::utils::paths::data_directory;

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

pub fn try_acquire() -> io::Result<Option<File>> {
    fs::create_dir_all(data_directory())?;
    let file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(false)
        .open(data_directory().join("ttysh.lock"))?;
    match file.try_lock() {
        Ok(()) => Ok(Some(file)),
        Err(TryLockError::WouldBlock) => Ok(None),
        Err(TryLockError::Error(error)) => Err(error),
    }
}

pub fn write_running(running: &Running) -> io::Result<()> {
    let text = serde_json::to_string(running).expect("running details serialize");
    fs::write(data_directory().join("running.json"), text)
}

pub fn read_running() -> Result<Running, String> {
    let path = data_directory().join("running.json");
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("could not read {}: {error}", path.display()))?;
    serde_json::from_str(&text).map_err(|error| format!("invalid {}: {error}", path.display()))
}
