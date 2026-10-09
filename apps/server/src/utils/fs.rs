use std::{fs, io, path::Path};

pub fn write_atomic(path: &Path, contents: &[u8]) -> io::Result<()> {
    fs::create_dir_all(path.parent().expect("file path has a parent directory"))?;
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".tmp");
    fs::write(&temporary, contents)?;
    fs::rename(&temporary, path)
}
