mod app;
mod assets;
mod keeper_link;
mod layout;

use std::sync::Arc;

use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
    response::Response,
    routing::get,
};
use tokio::sync::mpsc;

use crate::config;
use app::App;

pub fn run() {
    tokio::runtime::Runtime::new()
        .expect("could not start the async runtime")
        .block_on(serve());
}

async fn serve() {
    config::create().expect("could not create the config file");
    let (keeper, frames) = mpsc::unbounded_channel();
    let app = Arc::new(App::new(
        crate::data_directory().join("layout.json"),
        keeper,
    ));
    tokio::spawn(keeper_link::link(app.clone(), frames));
    let router = Router::new()
        .route("/ws", get(socket))
        .route("/api/config", get(config::handler).put(config::save))
        .fallback(assets::asset)
        .with_state(app);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", crate::SERVER_PORT))
        .await
        .expect("could not bind the server port");
    println!("listening on http://0.0.0.0:{}", crate::SERVER_PORT);
    axum::serve(listener, router).await.expect("server failed");
}

async fn socket(upgrade: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    upgrade.on_upgrade(move |socket| app::connect(app, socket))
}
