use std::{
    fs, io,
    process::{Command, Stdio},
    sync::{Arc, atomic::Ordering},
    time::Duration,
};

use tokio::{io::AsyncWriteExt, net::TcpStream, sync::mpsc};

use super::app::App;
use crate::{frame, utils::paths::data_directory};

pub(super) async fn link(app: Arc<App>, mut frames: mpsc::UnboundedReceiver<Vec<u8>>) {
    loop {
        while app.stopping.load(Ordering::SeqCst) {
            app.keeper_gone.notify_waiters();
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        let Some(stream) = connect_keeper(&app).await else {
            continue;
        };
        let (mut reader, mut writer) = stream.into_split();
        let reading = async {
            loop {
                match frame::read_async(&mut reader).await {
                    Ok(message) => app.keeper_frame(message),
                    Err(error) => {
                        eprintln!("keeper connection lost: {error}");
                        break;
                    }
                }
            }
        };
        let writing = async {
            while let Some(bytes) = frames.recv().await {
                if let Err(error) = writer.write_all(&bytes).await {
                    eprintln!("could not write to keeper: {error}");
                    break;
                }
            }
        };
        tokio::select! {
            _ = reading => {}
            _ = writing => {}
        }
    }
}

async fn connect_keeper(app: &App) -> Option<TcpStream> {
    loop {
        if app.stopping.load(Ordering::SeqCst) {
            return None;
        }
        if let Ok(stream) = TcpStream::connect(("127.0.0.1", crate::KEEPER_PORT)).await {
            return Some(stream);
        }
        if let Err(error) = start_keeper() {
            eprintln!("could not start keeper: {error}");
        }
        for _ in 0..50 {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if let Ok(stream) = TcpStream::connect(("127.0.0.1", crate::KEEPER_PORT)).await {
                return Some(stream);
            }
        }
        eprintln!("keeper did not start in time, trying again");
    }
}

fn start_keeper() -> io::Result<()> {
    let directory = data_directory();
    fs::create_dir_all(&directory)?;
    let log = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(directory.join("keeper.log"))?;
    let mut command = Command::new(std::env::current_exe()?);
    command
        .arg("keeper")
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log);
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x0000_0008 | 0x0000_0200);
    }
    command.spawn()?;
    Ok(())
}
