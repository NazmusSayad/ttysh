use std::{sync::Arc, time::Duration};

use axum::{Json, extract::State, http::StatusCode};

use super::app::App;
use crate::supervisor::RESTART_CODE;

pub(super) async fn instance(State(app): State<Arc<App>>) -> Json<String> {
    Json(app.instance.clone())
}

pub(super) async fn server(State(app): State<Arc<App>>) -> Json<String> {
    tracing::info!("restarting the server");
    exit_soon();
    Json(app.instance.clone())
}

pub(super) async fn everything(
    State(app): State<Arc<App>>,
) -> Result<Json<String>, (StatusCode, String)> {
    tracing::info!("restarting everything");
    app.stop_keeper().await.map_err(|error| {
        tracing::error!("could not stop the keeper: {error}");
        (StatusCode::INTERNAL_SERVER_ERROR, error)
    })?;
    exit_soon();
    Ok(Json(app.instance.clone()))
}

fn exit_soon() {
    tokio::spawn(async {
        tokio::time::sleep(Duration::from_millis(250)).await;
        std::process::exit(RESTART_CODE);
    });
}
