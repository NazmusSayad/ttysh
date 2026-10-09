use std::path::PathBuf;

fn home_directory() -> PathBuf {
    dirs::home_dir().expect("home directory not found")
}

pub fn data_directory() -> PathBuf {
    home_directory().join(".ttysh")
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
