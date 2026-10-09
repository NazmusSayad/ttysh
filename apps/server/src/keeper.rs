use std::{
    collections::{HashMap, VecDeque},
    io::{Read, Write},
    net::{Shutdown, TcpListener, TcpStream},
    path::PathBuf,
    sync::{Arc, Mutex, mpsc},
    thread,
};

use portable_pty::{ChildKiller, CommandBuilder, MasterPty, PtySize, native_pty_system};
use serde::Deserialize;

use crate::frame::{self, Frame};

const HISTORY_LIMIT: usize = 2 * 1024 * 1024;

#[derive(Deserialize)]
struct Launch {
    command: Option<String>,
    cwd: PathBuf,
}

struct Session {
    history: VecDeque<u8>,
    master: Box<dyn MasterPty + Send>,
    killer: Box<dyn ChildKiller + Send + Sync>,
    input: mpsc::Sender<Vec<u8>>,
}

#[derive(Default)]
struct Keeper {
    sessions: HashMap<u64, Session>,
    link: Option<(u64, mpsc::Sender<Vec<u8>>)>,
}

impl Keeper {
    fn send(&self, bytes: Vec<u8>) {
        if let Some(link) = &self.link {
            let _ = link.1.send(bytes);
        }
    }
}

type Shared = Arc<Mutex<Keeper>>;

pub fn run() {
    let listener = TcpListener::bind(("127.0.0.1", crate::KEEPER_PORT))
        .expect("keeper could not bind its port");
    eprintln!("keeper listening on 127.0.0.1:{}", crate::KEEPER_PORT);
    let keeper = Shared::default();
    for (number, stream) in listener.incoming().enumerate() {
        match stream {
            Ok(stream) => {
                let keeper = keeper.clone();
                thread::spawn(move || serve(&keeper, stream, number as u64));
            }
            Err(error) => eprintln!("keeper: connection failed: {error}"),
        }
    }
}

fn serve(keeper: &Shared, stream: TcpStream, number: u64) {
    let mut writer = match stream.try_clone() {
        Ok(writer) => writer,
        Err(error) => {
            eprintln!("keeper: could not use connection: {error}");
            return;
        }
    };
    let (sender, receiver) = mpsc::channel::<Vec<u8>>();
    thread::spawn(move || {
        for bytes in receiver {
            if writer.write_all(&bytes).is_err() {
                break;
            }
        }
        let _ = writer.shutdown(Shutdown::Both);
    });
    {
        let mut state = keeper.lock().unwrap();
        let ids: Vec<u8> = state
            .sessions
            .keys()
            .flat_map(|id| id.to_be_bytes())
            .collect();
        let _ = sender.send(frame::encode(frame::LIST, 0, &ids));
        state.link = Some((number, sender));
    }
    let mut reader = stream;
    while let Ok(message) = frame::read(&mut reader) {
        handle(keeper, message);
    }
    let mut state = keeper.lock().unwrap();
    if state.link.as_ref().is_some_and(|link| link.0 == number) {
        state.link = None;
    }
}

fn handle(keeper: &Shared, message: Frame) {
    match message.kind {
        frame::SPAWN => {
            let size = message.payload.get(..4).and_then(frame::decode_size);
            let launch = message
                .payload
                .get(4..)
                .map(serde_json::from_slice::<Launch>);
            match (size, launch) {
                (Some(size), Some(Ok(launch))) => {
                    spawn(keeper, message.id, pty_size(size), &launch)
                }
                _ => eprintln!("keeper: invalid spawn request"),
            }
        }
        frame::INPUT => {
            let state = keeper.lock().unwrap();
            if let Some(session) = state.sessions.get(&message.id) {
                let _ = session.input.send(message.payload);
            }
        }
        frame::RESIZE => match frame::decode_size(&message.payload) {
            Some(size) => {
                let state = keeper.lock().unwrap();
                if let Some(session) = state.sessions.get(&message.id)
                    && let Err(error) = session.master.resize(pty_size(size))
                {
                    eprintln!("keeper: could not resize terminal {}: {error}", message.id);
                }
            }
            None => eprintln!("keeper: invalid resize size"),
        },
        frame::KILL => {
            let mut state = keeper.lock().unwrap();
            if let Some(session) = state.sessions.get_mut(&message.id) {
                let _ = session.killer.kill();
            }
        }
        frame::REPLAY => {
            let state = keeper.lock().unwrap();
            let mut payload = message.payload;
            if let Some(session) = state.sessions.get(&message.id) {
                payload.extend(&session.history);
            }
            state.send(frame::encode(frame::SNAPSHOT, message.id, &payload));
        }
        kind => eprintln!("keeper: unknown frame kind {kind}"),
    }
}

fn pty_size(size: (u16, u16)) -> PtySize {
    PtySize {
        cols: size.0,
        rows: size.1,
        pixel_width: 0,
        pixel_height: 0,
    }
}

fn spawn(keeper: &Shared, id: u64, size: PtySize, launch: &Launch) {
    if keeper.lock().unwrap().sessions.contains_key(&id) {
        return;
    }
    if let Err(error) = open(keeper, id, size, launch) {
        eprintln!("keeper: could not start terminal {id}: {error}");
        keeper
            .lock()
            .unwrap()
            .send(frame::encode(frame::EXIT, id, &[]));
    }
}

fn open(keeper: &Shared, id: u64, size: PtySize, launch: &Launch) -> Result<(), String> {
    let pair = native_pty_system()
        .openpty(size)
        .map_err(|error| error.to_string())?;
    let mut command = shell_command(launch);
    command.cwd(&launch.cwd);
    command.env("TERM", "xterm-256color");
    command.env("COLORTERM", "truecolor");
    let mut child = pair
        .slave
        .spawn_command(command)
        .map_err(|error| error.to_string())?;
    drop(pair.slave);
    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|error| error.to_string())?;
    let mut writer = pair
        .master
        .take_writer()
        .map_err(|error| error.to_string())?;
    let (input, inputs) = mpsc::channel::<Vec<u8>>();
    keeper.lock().unwrap().sessions.insert(
        id,
        Session {
            history: VecDeque::new(),
            master: pair.master,
            killer: child.clone_killer(),
            input,
        },
    );
    thread::spawn(move || {
        for bytes in inputs {
            if writer.write_all(&bytes).is_err() {
                break;
            }
        }
    });
    let reading = keeper.clone();
    thread::spawn(move || {
        let mut chunk = vec![0; 64 * 1024];
        loop {
            match reader.read(&mut chunk) {
                Ok(0) | Err(_) => break,
                Ok(length) => record(&reading, id, &chunk[..length]),
            }
        }
    });
    let waiting = keeper.clone();
    thread::spawn(move || {
        let _ = child.wait();
        let mut state = waiting.lock().unwrap();
        state.sessions.remove(&id);
        state.send(frame::encode(frame::EXIT, id, &[]));
    });
    Ok(())
}

#[cfg(unix)]
fn shell_command(launch: &Launch) -> CommandBuilder {
    let mut command = CommandBuilder::new("/bin/bash");
    command.env_clear();
    for name in ["HOME", "USER", "LOGNAME", "TMPDIR", "SSH_AUTH_SOCK"] {
        if let Some(value) = std::env::var_os(name) {
            command.env(name, value);
        }
    }
    let shell = command.get_shell();
    command.env("SHELL", &shell);
    command.env("LANG", "en_US.UTF-8");
    let program = match &launch.command {
        Some(program) => program.clone(),
        None => format!("'{shell}'"),
    };
    command.args(["--noprofile", "--norc", "-c", &format!("exec -l {program}")]);
    command
}

#[cfg(windows)]
fn shell_command(launch: &Launch) -> CommandBuilder {
    match &launch.command {
        Some(program) => CommandBuilder::new(program),
        None => CommandBuilder::new_default_prog(),
    }
}

fn record(keeper: &Shared, id: u64, bytes: &[u8]) {
    let mut state = keeper.lock().unwrap();
    let Some(session) = state.sessions.get_mut(&id) else {
        return;
    };
    session.history.extend(bytes);
    let excess = session.history.len().saturating_sub(HISTORY_LIMIT);
    session.history.drain(..excess);
    state.send(frame::encode(frame::OUTPUT, id, bytes));
}
