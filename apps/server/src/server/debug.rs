use std::{fs, time::UNIX_EPOCH};

use axum::{Json, extract::Path, http::StatusCode};
use serde::Serialize;

use crate::utils::paths;

#[derive(Serialize)]
pub(super) struct LogFile {
    name: String,
    size: u64,
    modified: u128,
}

pub(super) async fn list() -> Result<Json<Vec<LogFile>>, (StatusCode, String)> {
    let failed = |error: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string());
    let mut files = Vec::new();
    for entry in fs::read_dir(paths::logs_directory()).map_err(failed)? {
        let entry = entry.map_err(failed)?;
        let metadata = entry.metadata().map_err(failed)?;
        files.push(LogFile {
            name: entry.file_name().to_string_lossy().into_owned(),
            size: metadata.len(),
            modified: metadata
                .modified()
                .map_err(failed)?
                .duration_since(UNIX_EPOCH)
                .expect("file time is after 1970")
                .as_millis(),
        });
    }
    files.sort_by_key(|file| std::cmp::Reverse(file.modified));
    Ok(Json(files))
}

pub(super) async fn file(Path(file): Path<String>) -> Result<String, (StatusCode, String)> {
    let valid = file.ends_with(".log")
        && !file.contains("..")
        && file
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "-.".contains(character));
    if !valid {
        return Err((StatusCode::BAD_REQUEST, format!("invalid log file {file}")));
    }
    fs::read_to_string(paths::logs_directory().join(&file)).map_err(|error| match error.kind() {
        std::io::ErrorKind::NotFound => (StatusCode::NOT_FOUND, format!("no log file {file}")),
        _ => (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()),
    })
}
