use std::{
    collections::HashSet,
    fs, io,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
    time::Duration,
};

use axum::{
    Router,
    extract::{
        State, WebSocketUpgrade,
        ws::{Message, WebSocket},
    },
    http::{StatusCode, Uri, header},
    response::{IntoResponse, Response},
    routing::get,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::{io::AsyncWriteExt, net::TcpStream, sync::mpsc};

use crate::{
    frame::{self, Frame},
    ghostty::{self, Launch},
};

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
struct Layout {
    groups: Vec<Group>,
    active_group: Option<u64>,
    next_id: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Group {
    id: u64,
    name: String,
    tabs: Vec<Tab>,
    active_tab: Option<u64>,
}

#[derive(Serialize, Deserialize)]
struct Tab {
    id: u64,
    name: String,
}

#[derive(Deserialize)]
#[serde(
    tag = "type",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
enum Request {
    Hello { client_id: String },
    Resume { client_id: String },
    CreateGroup,
    CreateTab { group_id: u64 },
    Close { id: u64 },
    Rename { id: u64, name: String },
    Select { group_id: u64, tab_id: Option<u64> },
    Resize { id: u64, cols: u16, rows: u16 },
}

struct Client {
    connection: u64,
    client_id: String,
    sender: mpsc::UnboundedSender<Message>,
}

struct Inner {
    layout: Layout,
    active: Option<Client>,
    generation: u64,
    pending: HashSet<u64>,
}

struct App {
    inner: Mutex<Inner>,
    keeper: mpsc::UnboundedSender<Vec<u8>>,
    path: PathBuf,
    connections: AtomicU64,
}

pub fn run() {
    tokio::runtime::Runtime::new()
        .expect("could not start the async runtime")
        .block_on(serve());
}

async fn serve() {
    let path = crate::data_directory().join("layout.json");
    let layout = load(&path);
    let (keeper, frames) = mpsc::unbounded_channel();
    let app = Arc::new(App {
        inner: Mutex::new(Inner {
            layout,
            active: None,
            generation: 0,
            pending: HashSet::new(),
        }),
        keeper,
        path,
        connections: AtomicU64::new(0),
    });
    tokio::spawn(link(app.clone(), frames));
    let router = Router::new()
        .route("/ws", get(socket))
        .route("/api/ghostty", get(crate::ghostty::config))
        .fallback(asset)
        .with_state(app);
    let listener = tokio::net::TcpListener::bind(("0.0.0.0", crate::SERVER_PORT))
        .await
        .expect("could not bind the server port");
    println!("listening on http://0.0.0.0:{}", crate::SERVER_PORT);
    axum::serve(listener, router).await.expect("server failed");
}

#[derive(rust_embed::Embed)]
#[folder = "../web/dist"]
#[allow_missing = true]
struct Assets;

async fn asset(uri: Uri) -> Response {
    let path = match uri.path().trim_start_matches('/') {
        "" => "index.html",
        path => path,
    };
    match Assets::get(path) {
        Some(file) => (
            [(header::CONTENT_TYPE, file.metadata.mimetype().to_string())],
            file.data,
        )
            .into_response(),
        None => StatusCode::NOT_FOUND.into_response(),
    }
}

fn load(path: &Path) -> Layout {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).expect("layout file is corrupt"),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Layout::default(),
        Err(error) => panic!("could not read layout file: {error}"),
    }
}

fn write_layout(path: &Path, layout: &Layout) -> io::Result<()> {
    fs::create_dir_all(crate::data_directory())?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, serde_json::to_vec_pretty(layout)?)?;
    fs::rename(&temporary, path)
}

async fn link(app: Arc<App>, mut frames: mpsc::UnboundedReceiver<Vec<u8>>) {
    loop {
        let stream = connect_keeper().await;
        let (mut reader, mut writer) = stream.into_split();
        let reading = async {
            loop {
                match frame::read_async(&mut reader).await {
                    Ok(message) => app.keeper_frame(message),
                    Err(error) => {
                        eprintln!("keeper connection lost: {error}");
                        break;
                    }
                }
            }
        };
        let writing = async {
            while let Some(bytes) = frames.recv().await {
                if let Err(error) = writer.write_all(&bytes).await {
                    eprintln!("could not write to keeper: {error}");
                    break;
                }
            }
        };
        tokio::select! {
            _ = reading => {}
            _ = writing => {}
        }
    }
}

async fn connect_keeper() -> TcpStream {
    loop {
        if let Ok(stream) = TcpStream::connect(("127.0.0.1", crate::KEEPER_PORT)).await {
            return stream;
        }
        if let Err(error) = start_keeper() {
            eprintln!("could not start keeper: {error}");
        }
        for _ in 0..50 {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if let Ok(stream) = TcpStream::connect(("127.0.0.1", crate::KEEPER_PORT)).await {
                return stream;
            }
        }
        eprintln!("keeper did not start in time, trying again");
    }
}

fn start_keeper() -> io::Result<()> {
    let directory = crate::data_directory();
    fs::create_dir_all(&directory)?;
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(directory.join("keeper.log"))?;
    let mut command = Command::new(std::env::current_exe()?);
    command
        .arg("keeper")
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0000_0008 | 0x0000_0200);
    }
    command.spawn()?;
    Ok(())
}

async fn socket(upgrade: WebSocketUpgrade, State(app): State<Arc<App>>) -> Response {
    upgrade.on_upgrade(move |socket| connect(app, socket))
}

async fn connect(app: Arc<App>, socket: WebSocket) {
    let connection = app.connections.fetch_add(1, Ordering::Relaxed);
    let (mut sink, mut stream) = socket.split();
    let (sender, mut receiver) = mpsc::unbounded_channel();
    let forwarding = tokio::spawn(async move {
        while let Some(message) = receiver.recv().await {
            if sink.send(message).await.is_err() {
                break;
            }
        }
    });
    while let Some(Ok(message)) = stream.next().await {
        match message {
            Message::Text(text) => match serde_json::from_str(&text) {
                Ok(request) => app.request(connection, &sender, request),
                Err(error) => eprintln!("invalid request: {error}"),
            },
            Message::Binary(bytes) => app.input(connection, &bytes),
            Message::Ping(_) | Message::Pong(_) | Message::Close(_) => {}
        }
    }
    forwarding.abort();
    let mut inner = app.inner.lock().unwrap();
    if inner
        .active
        .as_ref()
        .is_some_and(|client| client.connection == connection)
    {
        inner.active = None;
    }
}

impl App {
    fn request(&self, connection: u64, sender: &mpsc::UnboundedSender<Message>, request: Request) {
        let mut guard = self.inner.lock().unwrap();
        let inner = &mut *guard;
        let active = inner
            .active
            .as_ref()
            .is_some_and(|client| client.connection == connection);
        match request {
            Request::Hello { client_id } => {
                let available = match &inner.active {
                    None => true,
                    Some(client) => client.client_id == client_id,
                };
                if available {
                    let sender = sender.clone();
                    self.activate(
                        inner,
                        Client {
                            connection,
                            client_id,
                            sender,
                        },
                    );
                } else {
                    send(sender, json!({ "type": "paused" }));
                }
                return;
            }
            Request::Resume { client_id } => {
                let sender = sender.clone();
                self.activate(
                    inner,
                    Client {
                        connection,
                        client_id,
                        sender,
                    },
                );
                return;
            }
            _ if !active => return,
            Request::Resize { id, cols, rows } => {
                self.to_keeper(frame::encode(
                    frame::RESIZE,
                    id,
                    &frame::encode_size(cols, rows),
                ));
                return;
            }
            Request::CreateGroup => {
                let layout = &mut inner.layout;
                layout.next_id += 1;
                let id = layout.next_id;
                layout.groups.push(Group {
                    id,
                    name: format!("Group {}", layout.groups.len() + 1),
                    tabs: Vec::new(),
                    active_tab: None,
                });
                layout.active_group = Some(id);
                self.create_tab(layout, id);
            }
            Request::CreateTab { group_id } => self.create_tab(&mut inner.layout, group_id),
            Request::Close { id } => self.close(&mut inner.layout, id),
            Request::Rename { id, name } => {
                for group in &mut inner.layout.groups {
                    if group.id == id {
                        group.name = name.clone();
                    }
                    for tab in &mut group.tabs {
                        if tab.id == id {
                            tab.name = name.clone();
                        }
                    }
                }
            }
            Request::Select { group_id, tab_id } => {
                let Some(group) = inner
                    .layout
                    .groups
                    .iter_mut()
                    .find(|group| group.id == group_id)
                else {
                    return;
                };
                if tab_id.is_some() {
                    group.active_tab = tab_id;
                }
                inner.layout.active_group = Some(group_id);
            }
        }
        self.save(&inner.layout);
        publish(inner);
    }

    fn input(&self, connection: u64, bytes: &[u8]) {
        let inner = self.inner.lock().unwrap();
        if !inner
            .active
            .as_ref()
            .is_some_and(|client| client.connection == connection)
        {
            return;
        }
        if bytes.len() < 8 {
            eprintln!("input message is too short");
            return;
        }
        self.to_keeper(frame::encode(
            frame::INPUT,
            frame::read_u64(bytes),
            &bytes[8..],
        ));
    }

    fn keeper_frame(&self, message: Frame) {
        let mut guard = self.inner.lock().unwrap();
        let inner = &mut *guard;
        match message.kind {
            frame::OUTPUT => {
                if !inner.pending.contains(&message.id) {
                    forward(inner, message.id, &message.payload);
                }
            }
            frame::SNAPSHOT => {
                if message.payload.len() < 8 {
                    eprintln!("snapshot is too short");
                    return;
                }
                let generation = frame::read_u64(&message.payload);
                if generation == inner.generation && inner.pending.remove(&message.id) {
                    forward(inner, message.id, &message.payload[8..]);
                }
            }
            frame::EXIT => {
                inner.pending.remove(&message.id);
                if remove_tab(&mut inner.layout, message.id) {
                    self.save(&inner.layout);
                    publish(inner);
                }
            }
            frame::LIST => {
                let live: HashSet<u64> = message
                    .payload
                    .as_chunks::<8>()
                    .0
                    .iter()
                    .map(|chunk| u64::from_be_bytes(*chunk))
                    .collect();
                let tabs = tab_ids(&inner.layout);
                for id in &live {
                    if !tabs.contains(id) {
                        self.to_keeper(frame::encode(frame::KILL, *id, &[]));
                    }
                }
                for id in &tabs {
                    if !live.contains(id) {
                        match ghostty::launch() {
                            Ok(launch) => self.spawn(*id, &launch),
                            Err(error) => eprintln!(
                                "could not read Ghostty config, terminal {id} not started: {error}"
                            ),
                        }
                    }
                }
                self.reset(inner);
            }
            kind => eprintln!("unknown keeper frame kind {kind}"),
        }
    }

    fn activate(&self, inner: &mut Inner, client: Client) {
        let connection = client.connection;
        if let Some(previous) = inner.active.replace(client)
            && previous.connection != connection
        {
            send(&previous.sender, json!({ "type": "paused" }));
        }
        self.reset(inner);
    }

    fn reset(&self, inner: &mut Inner) {
        let Some(client) = &inner.active else {
            return;
        };
        inner.generation += 1;
        send(
            &client.sender,
            json!({ "type": "active", "layout": inner.layout }),
        );
        inner.pending.clear();
        for id in tab_ids(&inner.layout) {
            inner.pending.insert(id);
            self.to_keeper(frame::encode(
                frame::REPLAY,
                id,
                &inner.generation.to_be_bytes(),
            ));
        }
    }

    fn create_tab(&self, layout: &mut Layout, group_id: u64) {
        let launch = match ghostty::launch() {
            Ok(launch) => launch,
            Err(error) => {
                eprintln!("could not read Ghostty config, terminal not created: {error}");
                return;
            }
        };
        layout.next_id += 1;
        let id = layout.next_id;
        let Some(group) = layout.groups.iter_mut().find(|group| group.id == group_id) else {
            return;
        };
        group.tabs.push(Tab {
            id,
            name: format!("Terminal {}", group.tabs.len() + 1),
        });
        group.active_tab = Some(id);
        self.spawn(id, &launch);
    }

    fn spawn(&self, id: u64, launch: &Launch) {
        let mut payload = frame::encode_size(80, 24);
        payload.extend(serde_json::to_vec(launch).expect("launch settings serialize"));
        self.to_keeper(frame::encode(frame::SPAWN, id, &payload));
    }

    fn close(&self, layout: &mut Layout, id: u64) {
        if let Some(index) = layout.groups.iter().position(|group| group.id == id) {
            let group = layout.groups.remove(index);
            for tab in &group.tabs {
                self.to_keeper(frame::encode(frame::KILL, tab.id, &[]));
            }
            if layout.active_group == Some(id) {
                layout.active_group = layout
                    .groups
                    .get(index)
                    .or(layout.groups.last())
                    .map(|group| group.id);
            }
            return;
        }
        if remove_tab(layout, id) {
            self.to_keeper(frame::encode(frame::KILL, id, &[]));
        }
    }

    fn save(&self, layout: &Layout) {
        if let Err(error) = write_layout(&self.path, layout) {
            eprintln!("could not save layout: {error}");
        }
    }

    fn to_keeper(&self, bytes: Vec<u8>) {
        let _ = self.keeper.send(bytes);
    }
}

fn remove_tab(layout: &mut Layout, id: u64) -> bool {
    for group in &mut layout.groups {
        if let Some(index) = group.tabs.iter().position(|tab| tab.id == id) {
            group.tabs.remove(index);
            if group.active_tab == Some(id) {
                group.active_tab = group
                    .tabs
                    .get(index)
                    .or(group.tabs.last())
                    .map(|tab| tab.id);
            }
            return true;
        }
    }
    false
}

fn tab_ids(layout: &Layout) -> Vec<u64> {
    layout
        .groups
        .iter()
        .flat_map(|group| group.tabs.iter().map(|tab| tab.id))
        .collect()
}

fn publish(inner: &Inner) {
    if let Some(client) = &inner.active {
        send(
            &client.sender,
            json!({ "type": "layout", "layout": inner.layout }),
        );
    }
}

fn forward(inner: &Inner, id: u64, data: &[u8]) {
    let Some(client) = &inner.active else {
        return;
    };
    let mut bytes = id.to_be_bytes().to_vec();
    bytes.extend_from_slice(data);
    let _ = client.sender.send(Message::Binary(bytes.into()));
}

fn send(sender: &mpsc::UnboundedSender<Message>, value: serde_json::Value) {
    let _ = sender.send(Message::Text(value.to_string().into()));
}
