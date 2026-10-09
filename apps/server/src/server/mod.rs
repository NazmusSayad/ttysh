mod app;
mod assets;
mod debug;
mod directories;
mod keeper_link;
mod layout;
mod logos;
mod restart;
mod shells;

use std::{
    io::{self, Read},
    sync::Arc,
};

use axum::{
    Json, Router,
    extract::{State, WebSocketUpgrade},
    http::StatusCode,
    response::Response,
    routing::{get, post, put},
};
use tokio::sync::mpsc;

use crate::{config, logging, utils::paths::data_directory};
use app::App;

pub fn run(host: String, port: u16, debug: bool, session: &str) {
    logging::init(&format!("session-{session}.log"), debug, true);
    std::thread::spawn(|| {
        let mut byte = [0];
        loop {
            match io::stdin().read(&mut byte) {
                Ok(0) | Err(_) => {
                    tracing::info!("supervisor is gone, exiting");
                    std::process::exit(0);
                }
                Ok(_) => {}
            }
        }
    });
    tokio::runtime::Runtime::new()
        .expect("could not start the async runtime")
        .block_on(serve(host, port, debug));
}

async fn serve(host: String, port: u16, debug: bool) {
    config::create().expect("could not create the config file");
    let (keeper, frames) = mpsc::unbounded_channel();
    let app = Arc::new(App::new(
        data_directory().join("layout.json"),
        keeper,
        debug,
    ));
    tokio::spawn(keeper_link::link(app.clone(), frames));
    let mut router = Router::new()
        .route("/ws", get(socket))
        .route("/api/config", get(config::handler).put(save_config))
        .route("/api/config/defaults", get(config::defaults))
        .route("/api/platform", get(config::platform))
        .route("/api/directories", get(directories::list))
        .route("/api/shells", get(shells::list))
        .route(
            "/api/groups/{id}/logo",
            put(logos::upload).delete(logos::remove),
        )
        .route("/api/logos/{file}", get(logos::serve))
        .route("/api/instance", get(restart::instance))
        .route("/api/restart/server", post(restart::server))
        .route("/api/restart/everything", post(restart::everything));
    if debug {
        router = router
            .route("/api/debug/logs", get(debug::list))
            .route("/api/debug/logs/{file}", get(debug::file));
    }
    let router = router.fallback(assets::asset).with_state(app);
    let listener = match tokio::net::TcpListener::bind((host.as_str(), port)).await {
        Ok(listener) => listener,
        Err(error) => {
            tracing::error!("could not listen on {host}:{port}: {error}");
            std::process::exit(1);
        }
    };
    tracing::info!(
        "listening on http://{}",
        listener.local_addr().expect("listener has an address")
    );
    axum::serve(listener, router).await.expect("server failed");
}

async fn save_config(
    State(app): State<Arc<App>>,
    Json(config): Json<config::Config>,
) -> Result<Json<config::Config>, (StatusCode, String)> {
    let config = config::save(config)?;
    app.publish_config(&config);
    Ok(Json(config))
}

async fn socket(upgrade: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    upgrade.on_upgrade(move |socket| app::connect(app, socket))
}
