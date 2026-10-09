use std::fs;

use axum::{Json, extract::Query, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::utils::paths::expand_home;

#[derive(Deserialize)]
pub(super) struct Request {
    path: String,
}

#[derive(Serialize)]
pub(super) struct Listing {
    path: String,
    parent: Option<String>,
    directories: Vec<Directory>,
}

#[derive(Serialize)]
pub(super) struct Directory {
    name: String,
    path: String,
}

pub(super) async fn list(
    Query(request): Query<Request>,
) -> Result<Json<Listing>, (StatusCode, String)> {
    let path = fs::canonicalize(expand_home(&request.path)).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            format!("{}: {error}", request.path),
        )
    })?;
    let entries = fs::read_dir(&path).map_err(|error| {
        (
            StatusCode::BAD_REQUEST,
            format!("{}: {error}", path.display()),
        )
    })?;
    let mut directories: Vec<Directory> = entries
        .filter_map(Result::ok)
        .filter(|entry| entry.path().is_dir())
        .map(|entry| Directory {
            name: entry.file_name().to_string_lossy().into_owned(),
            path: entry.path().to_string_lossy().into_owned(),
        })
        .filter(|directory| !directory.name.starts_with('.'))
        .collect();
    directories.sort_by_key(|directory| directory.name.to_lowercase());
    Ok(Json(Listing {
        path: path.to_string_lossy().into_owned(),
        parent: path
            .parent()
            .map(|parent| parent.to_string_lossy().into_owned()),
        directories,
    }))
}
