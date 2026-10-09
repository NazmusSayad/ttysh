use std::{
    fs::{self, OpenOptions},
    io,
    path::PathBuf,
    process,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use tracing_subscriber::{
    filter::{LevelFilter, Targets},
    fmt,
    layer::SubscriberExt,
    util::SubscriberInitExt,
};

use crate::utils::paths::data_directory;

pub fn directory() -> PathBuf {
    data_directory().join("logs")
}

pub fn run_id() -> String {
    let started = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("system clock is after 1970")
        .as_millis();
    format!("{started}-{}", process::id())
}

pub fn init(file_name: &str, debug: bool, console: bool) {
    let directory = directory();
    fs::create_dir_all(&directory).expect("could not create the log directory");
    let path = directory.join(file_name);
    let file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .expect("could not open the log file");
    let level = match debug {
        true => LevelFilter::TRACE,
        false => LevelFilter::INFO,
    };
    let file_layer = fmt::layer()
        .with_ansi(false)
        .with_line_number(true)
        .with_writer(Mutex::new(file));
    let console_layer = console.then(|| {
        fmt::layer()
            .without_time()
            .with_target(false)
            .with_writer(io::stderr)
    });
    tracing_subscriber::registry()
        .with(
            Targets::new()
                .with_target("ttysh", level)
                .with_default(LevelFilter::WARN),
        )
        .with(file_layer)
        .with(console_layer)
        .init();
    let default_hook = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        tracing::error!("{info}");
        default_hook(info);
    }));
    tracing::info!(pid = process::id(), level = %level, log_file = %path.display(), "logging started");
}
