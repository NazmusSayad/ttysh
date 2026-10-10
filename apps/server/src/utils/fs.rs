use std::{fs, io, path::Path};

pub fn write_atomic(path: &Path, contents: &[u8]) -> io::Result<()> {
    let path = match fs::canonicalize(path) {
        Ok(resolved) => resolved,
        Err(error) if error.kind() == io::ErrorKind::NotFound => path.to_path_buf(),
        Err(error) => return Err(error),
    };
    fs::create_dir_all(path.parent().expect("file path has a parent directory"))?;
    let mut temporary = path.as_os_str().to_owned();
    temporary.push(".tmp");
    fs::write(&temporary, contents)?;
    fs::rename(&temporary, &path)
}
