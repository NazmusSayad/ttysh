use std::{
    fs,
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    body::Bytes,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    response::{IntoResponse, Response},
};

use super::app::App;
use crate::utils::paths;

const TYPES: [(&str, &str); 7] = [
    ("image/png", "png"),
    ("image/jpeg", "jpg"),
    ("image/gif", "gif"),
    ("image/webp", "webp"),
    ("image/svg+xml", "svg"),
    ("image/x-icon", "ico"),
    ("image/vnd.microsoft.icon", "ico"),
];

pub(super) fn delete(file: &str) {
    if let Err(error) = fs::remove_file(paths::logos_directory().join(file)) {
        tracing::warn!("could not delete logo {file}: {error}");
    }
}

pub(super) async fn upload(
    State(app): State<Arc<App>>,
    Path(group_id): Path<u64>,
    headers: HeaderMap,
    body: Bytes,
) -> Result<StatusCode, (StatusCode, String)> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    let Some((_, extension)) = TYPES.iter().find(|(kind, _)| Some(*kind) == content_type) else {
        return Err((
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "logo must be a PNG, JPEG, GIF, WebP, SVG or ICO image".to_string(),
        ));
    };
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock is after 1970")
        .as_millis();
    let file = format!("{group_id}-{stamp}.{extension}");
    let failed = |error: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string());
    fs::create_dir_all(paths::logos_directory()).map_err(failed)?;
    fs::write(paths::logos_directory().join(&file), &body).map_err(failed)?;
    match app.replace_logo(group_id, Some(file.clone())) {
        Ok(Some(previous)) => delete(&previous),
        Ok(None) => {}
        Err(status) => {
            delete(&file);
            return Err((status, "group not found".to_string()));
        }
    }
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn remove(
    State(app): State<Arc<App>>,
    Path(group_id): Path<u64>,
) -> Result<StatusCode, StatusCode> {
    if let Some(previous) = app.replace_logo(group_id, None)? {
        delete(&previous);
    }
    Ok(StatusCode::NO_CONTENT)
}

pub(super) async fn serve(State(app): State<Arc<App>>, Path(file): Path<String>) -> Response {
    if !app.has_logo(&file) {
        return StatusCode::NOT_FOUND.into_response();
    }
    let Some((content_type, _)) = TYPES
        .iter()
        .find(|(_, extension)| file.ends_with(&format!(".{extension}")))
    else {
        return StatusCode::NOT_FOUND.into_response();
    };
    match fs::read(paths::logos_directory().join(&file)) {
        Ok(bytes) => (
            [
                (header::CONTENT_TYPE, *content_type),
                (header::CACHE_CONTROL, "public, max-age=31536000, immutable"),
            ],
            bytes,
        )
            .into_response(),
        Err(error) => (StatusCode::NOT_FOUND, error.to_string()).into_response(),
    }
}
