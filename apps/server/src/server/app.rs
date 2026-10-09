use std::{
    collections::HashSet,
    path::PathBuf,
    sync::{
        Arc, Mutex,
        atomic::{AtomicU64, Ordering},
    },
};

use axum::{
    extract::ws::{Message, WebSocket},
    http::StatusCode,
};
use futures_util::{SinkExt, StreamExt};
use serde::Deserialize;
use serde_json::json;
use tokio::sync::mpsc;

use super::{
    layout::{self, Group, Layout, Tab, remove_tab, tab_ids, unused_name},
    logos,
};
use crate::{
    config::{self, Launch},
    frame::{self, Frame},
};

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

pub(super) struct App {
    inner: Mutex<Inner>,
    keeper: mpsc::UnboundedSender<Vec<u8>>,
    path: PathBuf,
    connections: AtomicU64,
}

impl App {
    pub(super) fn new(path: PathBuf, keeper: mpsc::UnboundedSender<Vec<u8>>) -> Self {
        App {
            inner: Mutex::new(Inner {
                layout: layout::load(&path),
                active: None,
                generation: 0,
                pending: HashSet::new(),
            }),
            keeper,
            path,
            connections: AtomicU64::new(0),
        }
    }
}

pub(super) async fn connect(app: Arc<App>, socket: WebSocket) {
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
                    name: unused_name("Group", layout.groups.iter().map(|group| &group.name)),
                    logo: None,
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
                    if group.id == id && !name.is_empty() {
                        group.name = name.clone();
                    }
                    for tab in &mut group.tabs {
                        if tab.id == id {
                            tab.custom_name = match name.is_empty() {
                                true => None,
                                false => Some(name.clone()),
                            };
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

    pub(super) fn keeper_frame(&self, message: Frame) {
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
                        match config::launch() {
                            Ok(launch) => self.spawn(*id, &launch),
                            Err(error) => eprintln!(
                                "could not load config, terminal {id} not started: {error}"
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
        let launch = match config::launch() {
            Ok(launch) => launch,
            Err(error) => {
                eprintln!("could not load config, terminal not created: {error}");
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
            custom_name: None,
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
            if let Some(logo) = &group.logo {
                logos::delete(logo);
            }
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

    pub(super) fn replace_logo(
        &self,
        group_id: u64,
        logo: Option<String>,
    ) -> Result<Option<String>, StatusCode> {
        let mut guard = self.inner.lock().unwrap();
        let inner = &mut *guard;
        let Some(group) = inner
            .layout
            .groups
            .iter_mut()
            .find(|group| group.id == group_id)
        else {
            return Err(StatusCode::NOT_FOUND);
        };
        let previous = std::mem::replace(&mut group.logo, logo);
        self.save(&inner.layout);
        publish(inner);
        Ok(previous)
    }

    pub(super) fn has_logo(&self, file: &str) -> bool {
        let inner = self.inner.lock().unwrap();
        inner
            .layout
            .groups
            .iter()
            .any(|group| group.logo.as_deref() == Some(file))
    }

    fn save(&self, layout: &Layout) {
        if let Err(error) = layout::write_layout(&self.path, layout) {
            eprintln!("could not save layout: {error}");
        }
    }

    fn to_keeper(&self, bytes: Vec<u8>) {
        let _ = self.keeper.send(bytes);
    }
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
