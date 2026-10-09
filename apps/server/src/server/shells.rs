use std::{collections::HashSet, fs, path::PathBuf};

use axum::Json;
use serde::Serialize;

#[cfg(unix)]
const NAMES: [&str; 4] = ["zsh", "bash", "fish", "pwsh"];
#[cfg(windows)]
const NAMES: [&str; 3] = ["pwsh", "powershell", "cmd"];

#[derive(Serialize)]
pub(super) struct Shell {
    name: &'static str,
    path: String,
}

pub(super) async fn list() -> Json<Vec<Shell>> {
    let mut candidates: Vec<PathBuf> = std::env::var_os("PATH")
        .map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .unwrap_or_default()
        .into_iter()
        .flat_map(|directory| NAMES.map(|name| directory.join(executable(name))))
        .collect();
    if cfg!(unix)
        && let Ok(listed) = fs::read_to_string("/etc/shells")
    {
        candidates.extend(
            listed
                .lines()
                .map(str::trim)
                .filter(|line| line.starts_with('/'))
                .map(PathBuf::from),
        );
    }
    let mut seen = HashSet::new();
    let mut shells = Vec::new();
    for name in NAMES {
        for candidate in &candidates {
            if candidate.file_name() != Some(executable(name).as_ref()) || !candidate.is_file() {
                continue;
            }
            let Ok(target) = fs::canonicalize(candidate) else {
                continue;
            };
            if seen.insert(target) {
                shells.push(Shell {
                    name,
                    path: candidate.to_string_lossy().into_owned(),
                });
            }
        }
    }
    Json(shells)
}

fn executable(name: &str) -> String {
    match cfg!(windows) {
        true => format!("{name}.exe"),
        false => name.to_string(),
    }
}
