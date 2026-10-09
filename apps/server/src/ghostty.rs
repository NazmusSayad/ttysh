use std::{io, path::PathBuf};

use axum::http::StatusCode;
use serde::Serialize;

#[derive(Serialize)]
pub struct Launch {
    command: Option<String>,
    cwd: PathBuf,
}

fn read_config() -> io::Result<String> {
    let home = dirs::home_dir().expect("home directory not found");
    let xdg = match std::env::var_os("XDG_CONFIG_HOME") {
        Some(path) => path.into(),
        None => home.join(".config"),
    };
    let paths = [
        xdg.join("ghostty/config"),
        xdg.join("ghostty/config.ghostty"),
        home.join("Library/Application Support/com.mitchellh.ghostty/config"),
        home.join("Library/Application Support/com.mitchellh.ghostty/config.ghostty"),
    ];
    let mut text = String::new();
    for path in paths {
        if path.exists() {
            text.push_str(&std::fs::read_to_string(&path)?);
            text.push('\n');
        }
    }
    Ok(text)
}

pub async fn config() -> Result<String, (StatusCode, String)> {
    read_config().map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))
}

pub fn launch() -> io::Result<Launch> {
    let home = dirs::home_dir().expect("home directory not found");
    let mut command = None;
    let mut directory = None;
    for line in read_config()?.lines() {
        let line = line.trim();
        if line.starts_with('#') {
            continue;
        }
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        let value = value.trim().trim_matches('"');
        match key.trim() {
            "command" if value.is_empty() => command = None,
            "command" => command = Some(value.to_string()),
            "working-directory" => directory = Some(value.to_string()),
            _ => {}
        }
    }
    let cwd = match directory.as_deref() {
        None | Some("") | Some("home") | Some("inherit") | Some("~") => home,
        Some(path) => match path.strip_prefix("~/") {
            Some(rest) => home.join(rest),
            None => PathBuf::from(path),
        },
    };
    Ok(Launch { command, cwd })
}
