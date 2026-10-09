use std::{collections::HashSet, fs, io, path::Path};

use serde::{Deserialize, Serialize};

use crate::utils::fs::write_atomic;

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub(super) struct Layout {
    pub(super) groups: Vec<Group>,
    pub(super) active_group: Option<u64>,
    pub(super) next_id: u64,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Group {
    pub(super) id: u64,
    pub(super) name: String,
    pub(super) logo: Option<String>,
    pub(super) tabs: Vec<Tab>,
    pub(super) active_tab: Option<u64>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Tab {
    pub(super) id: u64,
    pub(super) custom_name: Option<String>,
}

pub(super) fn load(path: &Path) -> Layout {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str(&text).expect("layout file is corrupt"),
        Err(error) if error.kind() == io::ErrorKind::NotFound => Layout::default(),
        Err(error) => panic!("could not read layout file: {error}"),
    }
}

pub(super) fn write_layout(path: &Path, layout: &Layout) -> io::Result<()> {
    write_atomic(path, &serde_json::to_vec_pretty(layout)?)
}

pub(super) fn remove_tab(layout: &mut Layout, id: u64) -> bool {
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

pub(super) fn tab_ids(layout: &Layout) -> Vec<u64> {
    layout
        .groups
        .iter()
        .flat_map(|group| group.tabs.iter().map(|tab| tab.id))
        .collect()
}

pub(super) fn unused_name<'a>(names: impl Iterator<Item = &'a String>) -> String {
    let taken: HashSet<&String> = names.collect();
    (1..)
        .map(|number: u64| number.to_string())
        .find(|name| !taken.contains(name))
        .expect("a free name exists")
}
