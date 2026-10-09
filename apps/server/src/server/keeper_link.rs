use std::{
    io,
    process::{Command, Stdio},
    sync::{Arc, atomic::Ordering},
    time::Duration,
};

use tokio::{io::AsyncWriteExt, net::TcpStream, sync::mpsc};

use super::app::App;
use crate::frame;

pub(super) async fn link(app: Arc<App>, mut frames: mpsc::UnboundedReceiver<Vec<u8>>) {
    loop {
        while app.stopping.load(Ordering::SeqCst) {
            app.keeper_gone.notify_waiters();
            tokio::time::sleep(Duration::from_millis(100)).await;
        }
        let Some(stream) = connect_keeper(&app).await else {
            continue;
        };
        tracing::info!("connected to the keeper");
        let (mut reader, mut writer) = stream.into_split();
        let reading = async {
            loop {
                match frame::read_async(&mut reader).await {
                    Ok(message) => app.keeper_frame(message),
                    Err(error) => {
                        tracing::warn!("keeper connection lost: {error}");
                        break;
                    }
                }
            }
        };
        let writing = async {
            while let Some(bytes) = frames.recv().await {
                if let Err(error) = writer.write_all(&bytes).await {
                    tracing::error!("could not write to keeper: {error}");
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
        tracing::info!("keeper is not running, starting it");
        if let Err(error) = start_keeper(app.debug) {
            tracing::error!("could not start keeper: {error}");
        }
        for _ in 0..50 {
            tokio::time::sleep(Duration::from_millis(100)).await;
            if let Ok(stream) = TcpStream::connect(("127.0.0.1", crate::KEEPER_PORT)).await {
                return Some(stream);
            }
        }
        tracing::warn!("keeper did not start in time, trying again");
    }
}

fn start_keeper(debug: bool) -> io::Result<()> {
    let mut command = Command::new(std::env::current_exe()?);
    if debug {
        command.arg("--debug");
    }
    command
        .arg("keeper")
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
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
