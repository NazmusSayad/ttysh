use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
};

use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::utils::{
    fs::write_atomic,
    paths::{data_directory, expand_home},
};

const DEFAULT: &str = include_str!("default-config.json");

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    shell: Shell,
    font: Font,
    cursor: Cursor,
    padding: Padding,
    scrollback: u32,
    colors: Colors,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Shell {
    command: Option<String>,
    cwd: String,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Font {
    family: String,
    size: f64,
    line_height: f64,
    ligatures: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Cursor {
    style: CursorStyle,
    blink: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
enum CursorStyle {
    Block,
    Bar,
    Underline,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Padding {
    top: u32,
    right: u32,
    bottom: u32,
    left: u32,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Colors {
    background: String,
    foreground: String,
    cursor: String,
    cursor_text: String,
    selection_background: String,
    selection_foreground: String,
    bold_is_bright: bool,
    palette: [String; 16],
}

#[derive(Serialize)]
pub struct Launch {
    command: Option<String>,
    cwd: PathBuf,
}

fn path() -> PathBuf {
    data_directory().join("config.json")
}

pub fn create() -> io::Result<()> {
    fs::create_dir_all(data_directory())?;
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path())
    {
        Ok(mut file) => file.write_all(DEFAULT.as_bytes()),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => Ok(()),
        Err(error) => Err(error),
    }
}

fn validate(config: &Config) -> Result<(), String> {
    let colors = &config.colors;
    let named = [
        &colors.background,
        &colors.foreground,
        &colors.cursor,
        &colors.cursor_text,
        &colors.selection_background,
        &colors.selection_foreground,
    ];
    for color in named.into_iter().chain(&colors.palette) {
        let valid = color.len() == 7
            && color.starts_with('#')
            && color[1..]
                .chars()
                .all(|character| character.is_ascii_hexdigit());
        if !valid {
            return Err(format!("color {color} must look like #RRGGBB"));
        }
    }
    Ok(())
}

fn read() -> Result<Config, String> {
    let path = path();
    let text = fs::read_to_string(&path)
        .map_err(|error| format!("could not read {}: {error}", path.display()))?;
    let config: Config = serde_json::from_str(&text)
        .map_err(|error| format!("invalid {}: {error}", path.display()))?;
    validate(&config).map_err(|error| format!("invalid {}: {error}", path.display()))?;
    Ok(config)
}

pub async fn handler() -> Result<Json<Config>, (StatusCode, String)> {
    read()
        .map(Json)
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error))
}

pub async fn save(Json(config): Json<Config>) -> Result<Json<Config>, (StatusCode, String)> {
    validate(&config).map_err(|error| (StatusCode::BAD_REQUEST, error))?;
    let mut text = serde_json::to_string_pretty(&config).expect("config serializes");
    text.push('\n');
    write_atomic(&path(), text.as_bytes())
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(Json(config))
}

pub fn launch() -> Result<Launch, String> {
    let shell = read()?.shell;
    Ok(Launch {
        command: shell.command,
        cwd: expand_home(&shell.cwd),
    })
}
