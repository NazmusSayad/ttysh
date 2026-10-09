mod app;
mod assets;
mod keeper_link;
mod layout;
mod logos;

use std::sync::Arc;

use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
    response::Response,
    routing::{get, put},
};
use tokio::sync::mpsc;

use crate::{config, utils::paths::data_directory};
use app::App;

pub fn run(host: String, port: u16) {
    tokio::runtime::Runtime::new()
        .expect("could not start the async runtime")
        .block_on(serve(host, port));
}

async fn serve(host: String, port: u16) {
    config::create().expect("could not create the config file");
    let (keeper, frames) = mpsc::unbounded_channel();
    let app = Arc::new(App::new(data_directory().join("layout.json"), keeper));
    tokio::spawn(keeper_link::link(app.clone(), frames));
    let router = Router::new()
        .route("/ws", get(socket))
        .route("/api/config", get(config::handler).put(config::save))
        .route(
            "/api/groups/{id}/logo",
            put(logos::upload).delete(logos::remove),
        )
        .route("/api/logos/{file}", get(logos::serve))
        .fallback(assets::asset)
        .with_state(app);
    let listener = match tokio::net::TcpListener::bind((host.as_str(), port)).await {
        Ok(listener) => listener,
        Err(error) => {
            eprintln!("could not listen on {host}:{port}: {error}");
            std::process::exit(1);
        }
    };
    println!(
        "listening on http://{}",
        listener.local_addr().expect("listener has an address")
    );
    axum::serve(listener, router).await.expect("server failed");
}

async fn socket(upgrade: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    upgrade.on_upgrade(move |socket| app::connect(app, socket))
}
