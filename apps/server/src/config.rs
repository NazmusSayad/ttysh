use std::{
    fs,
    io::{self, Write},
    path::PathBuf,
};

use axum::{Json, http::StatusCode};
use serde::{Deserialize, Serialize};

use crate::utils::{
    fs::write_atomic,
    paths::{self, expand_home},
};

const DEFAULT: &str = include_str!("default-config.json");
const THEMES: &str = include_str!("themes.json");
const CUSTOM_THEME: &str = "custom";

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Config {
    shell: Shells,
    font: Font,
    cursor: Cursor,
    padding: Padding,
    scrollback: u32,
    theme: Theme,
    #[serde(default)]
    behavior: Behavior,
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Behavior {
    shift_enter_newline: bool,
}

impl Default for Behavior {
    fn default() -> Self {
        Behavior {
            shift_enter_newline: true,
        }
    }
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
struct Shells {
    macos: Shell,
    linux: Shell,
    windows: Shell,
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
struct Theme {
    name: String,
    bold_is_bright: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    colors: Option<Colors>,
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
    palette: [String; 16],
}

#[derive(Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BuiltinTheme {
    id: String,
    name: String,
    colors: Colors,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Launch {
    command: Option<String>,
    cwd: PathBuf,
    pub cwd_from: Option<u64>,
}

pub fn create() -> io::Result<()> {
    fs::create_dir_all(paths::root())?;
    match fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(paths::config_file())
    {
        Ok(mut file) => file.write_all(DEFAULT.as_bytes()),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists => Ok(()),
        Err(error) => Err(error),
    }
}

fn builtin_themes() -> Vec<BuiltinTheme> {
    serde_json::from_str(THEMES).expect("built-in themes are valid")
}

fn validate(config: &Config) -> Result<(), String> {
    let theme = &config.theme;
    if theme.name == CUSTOM_THEME {
        if theme.colors.is_none() {
            return Err("the custom theme needs colors".to_string());
        }
    } else if !builtin_themes()
        .iter()
        .any(|builtin| builtin.id == theme.name)
    {
        return Err(format!("unknown theme {}", theme.name));
    }
    match &theme.colors {
        Some(colors) => validate_colors(colors),
        None => Ok(()),
    }
}

fn validate_colors(colors: &Colors) -> Result<(), String> {
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

fn parse(value: &serde_json::Value) -> Result<Config, String> {
    let config: Config =
        serde_json::from_value(value.clone()).map_err(|error| error.to_string())?;
    validate(&config)?;
    Ok(config)
}

fn read() -> Config {
    let path = paths::config_file();
    let defaults: serde_json::Value =
        serde_json::from_str(DEFAULT).expect("default config is valid");
    let user = match fs::read_to_string(&path) {
        Ok(text) => match serde_json::from_str::<serde_json::Value>(&text) {
            Ok(serde_json::Value::Object(user)) => user,
            Ok(_) => {
                tracing::warn!(
                    "{} is not an object, using the default config",
                    path.display()
                );
                serde_json::Map::new()
            }
            Err(error) => {
                tracing::warn!(
                    "invalid {}, using the default config: {error}",
                    path.display()
                );
                serde_json::Map::new()
            }
        },
        Err(error) => {
            tracing::warn!(
                "could not read {}, using the default config: {error}",
                path.display()
            );
            serde_json::Map::new()
        }
    };
    let mut value = defaults.clone();
    for key in defaults
        .as_object()
        .expect("default config is an object")
        .keys()
    {
        let Some(section) = user.get(key) else {
            continue;
        };
        let mut candidate = value.clone();
        candidate[key] = section.clone();
        match parse(&candidate) {
            Ok(_) => value = candidate,
            Err(error) => {
                tracing::warn!(
                    "invalid {key} in {}, using its default: {error}",
                    path.display()
                )
            }
        }
    }
    parse(&value).expect("merged config is valid")
}

pub async fn handler() -> Json<Config> {
    Json(read())
}

pub fn save(config: Config) -> Result<Config, (StatusCode, String)> {
    validate(&config).map_err(|error| (StatusCode::BAD_REQUEST, error))?;
    let mut text = serde_json::to_string_pretty(&config).expect("config serializes");
    text.push('\n');
    write_atomic(&paths::config_file(), text.as_bytes())
        .map_err(|error| (StatusCode::INTERNAL_SERVER_ERROR, error.to_string()))?;
    Ok(config)
}

pub async fn defaults() -> Json<Config> {
    Json(serde_json::from_str(DEFAULT).expect("default config is valid"))
}

pub async fn themes() -> Json<Vec<BuiltinTheme>> {
    Json(builtin_themes())
}

pub async fn platform() -> Json<&'static str> {
    Json(std::env::consts::OS)
}

pub fn launch(directory: Option<&str>) -> Result<Launch, String> {
    let shells = read().shell;
    let shell = match std::env::consts::OS {
        "macos" => shells.macos,
        "linux" => shells.linux,
        "windows" => shells.windows,
        other => return Err(format!("unsupported platform {other}")),
    };
    Ok(Launch {
        command: shell.command,
        cwd: expand_home(match directory {
            Some(directory) => directory,
            None => &shell.cwd,
        }),
        cwd_from: None,
    })
}
