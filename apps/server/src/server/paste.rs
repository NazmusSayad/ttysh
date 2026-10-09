use std::{
    fs,
    time::{SystemTime, UNIX_EPOCH},
};

use axum::{
    Json,
    body::Bytes,
    http::{HeaderMap, StatusCode, header},
};

const TYPES: [(&str, &str); 4] = [
    ("image/png", "png"),
    ("image/jpeg", "jpg"),
    ("image/gif", "gif"),
    ("image/webp", "webp"),
];

pub(super) async fn upload(
    headers: HeaderMap,
    body: Bytes,
) -> Result<Json<String>, (StatusCode, String)> {
    let content_type = headers
        .get(header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok());
    let Some((_, extension)) = TYPES.iter().find(|(kind, _)| Some(*kind) == content_type) else {
        return Err((
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "pasted image must be a PNG, JPEG, GIF or WebP image".to_string(),
        ));
    };
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("clock is after 1970")
        .as_nanos();
    let directory = std::env::temp_dir().join("ttysh-pastes");
    let path = directory.join(format!("{stamp}.{extension}"));
    let failed = |error: std::io::Error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string());
    fs::create_dir_all(&directory).map_err(failed)?;
    fs::write(&path, &body).map_err(failed)?;
    tracing::info!(path = %path.display(), bytes = body.len(), "saved pasted image");
    Ok(Json(path.to_string_lossy().into_owned()))
}
