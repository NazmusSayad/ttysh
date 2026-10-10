use std::{path::PathBuf, sync::OnceLock};

static ROOT: OnceLock<PathBuf> = OnceLock::new();

fn home_directory() -> PathBuf {
    dirs::home_dir().expect("home directory not found")
}

pub fn init(root: PathBuf) {
    ROOT.set(root).expect("paths are initialized only once");
}

pub fn root() -> PathBuf {
    ROOT.get()
        .expect("paths are initialized at startup")
        .clone()
}

pub fn config_file() -> PathBuf {
    root().join("config.json")
}

pub fn layout_file() -> PathBuf {
    root().join("layout.json")
}

pub fn logos_directory() -> PathBuf {
    root().join("logos")
}

pub fn logs_directory() -> PathBuf {
    root().join("logs")
}

pub fn paste_directory() -> PathBuf {
    root().join("cache").join("paste")
}

pub fn lock_file() -> PathBuf {
    root().join("sshtty.lock")
}

pub fn running_file() -> PathBuf {
    root().join("running.json")
}

pub fn keeper_lock_file() -> PathBuf {
    root().join("keeper.lock")
}

pub fn keeper_port_file() -> PathBuf {
    root().join("keeper.port")
}

pub fn expand_home(path: &str) -> PathBuf {
    match path {
        "~" => home_directory(),
        path => match path.strip_prefix("~/") {
            Some(rest) => home_directory().join(rest),
            None => PathBuf::from(path),
        },
    }
}
