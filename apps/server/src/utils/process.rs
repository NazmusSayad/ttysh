use std::{io, path::PathBuf};

#[cfg(target_os = "linux")]
pub fn current_directory(pid: u32) -> io::Result<PathBuf> {
    std::fs::read_link(format!("/proc/{pid}/cwd"))
}

#[cfg(target_os = "macos")]
pub fn current_directory(pid: u32) -> io::Result<PathBuf> {
    use std::{ffi::CStr, mem, os::unix::ffi::OsStrExt};

    let pid = libc::c_int::try_from(pid).map_err(io::Error::other)?;
    let mut info: libc::proc_vnodepathinfo = unsafe { mem::zeroed() };
    let size = mem::size_of::<libc::proc_vnodepathinfo>() as libc::c_int;
    let written = unsafe {
        libc::proc_pidinfo(
            pid,
            libc::PROC_PIDVNODEPATHINFO,
            0,
            (&raw mut info).cast(),
            size,
        )
    };
    if written != size {
        return Err(io::Error::last_os_error());
    }
    let path = unsafe { CStr::from_ptr(info.pvi_cdir.vip_path.as_ptr().cast()) };
    Ok(PathBuf::from(std::ffi::OsStr::from_bytes(path.to_bytes())))
}

#[cfg(windows)]
pub fn current_directory(_pid: u32) -> io::Result<PathBuf> {
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "reading the directory of another process is not supported on Windows",
    ))
}
