use axum::{
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
};

#[derive(rust_embed::Embed)]
#[folder = "../web/dist"]
#[allow_missing = true]
struct Assets;

pub(super) async fn asset(uri: Uri) -> Response {
    let path = match uri.path().trim_start_matches('/') {
        "" => "index.html",
        path => path,
    };
    let cache = match path.starts_with("assets/") {
        true => "public, max-age=31536000, immutable",
        false => "no-cache",
    };
    let file = match Assets::get(path) {
        Some(file) => Some(file),
        None if path.contains('.') => None,
        None => Assets::get("index.html"),
    };
    match file {
        Some(file) => (
            [
                (header::CONTENT_TYPE, file.metadata.mimetype().to_string()),
                (header::CACHE_CONTROL, cache.to_string()),
            ],
            file.data,
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}
