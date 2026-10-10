use std::io::{self, Read};

use tokio::io::{AsyncRead, AsyncReadExt};

pub const SPAWN: u8 = 1;
pub const INPUT: u8 = 2;
pub const RESIZE: u8 = 3;
pub const KILL: u8 = 4;
pub const REPLAY: u8 = 5;
pub const SHUTDOWN: u8 = 6;
pub const LIST: u8 = 10;
pub const OUTPUT: u8 = 11;
pub const SNAPSHOT: u8 = 12;
pub const EXIT: u8 = 13;
pub const BRANCH: u8 = 14;

pub struct Frame {
    pub kind: u8,
    pub id: u64,
    pub payload: Vec<u8>,
}

pub fn encode(kind: u8, id: u64, payload: &[u8]) -> Vec<u8> {
    let mut bytes = Vec::with_capacity(13 + payload.len());
    bytes.extend_from_slice(&((9 + payload.len()) as u32).to_be_bytes());
    bytes.push(kind);
    bytes.extend_from_slice(&id.to_be_bytes());
    bytes.extend_from_slice(payload);
    bytes
}

pub fn read(reader: &mut impl Read) -> io::Result<Frame> {
    let mut length = [0; 4];
    reader.read_exact(&mut length)?;
    let mut body = vec![0; u32::from_be_bytes(length) as usize];
    reader.read_exact(&mut body)?;
    decode(body)
}

pub async fn read_async(reader: &mut (impl AsyncRead + Unpin)) -> io::Result<Frame> {
    let length = reader.read_u32().await?;
    let mut body = vec![0; length as usize];
    reader.read_exact(&mut body).await?;
    decode(body)
}

fn decode(mut body: Vec<u8>) -> io::Result<Frame> {
    if body.len() < 9 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            "frame is too short",
        ));
    }
    let payload = body.split_off(9);
    Ok(Frame {
        kind: body[0],
        id: read_u64(&body[1..]),
        payload,
    })
}

pub fn read_u64(bytes: &[u8]) -> u64 {
    let mut value = [0; 8];
    value.copy_from_slice(&bytes[..8]);
    u64::from_be_bytes(value)
}

pub fn encode_size(cols: u16, rows: u16) -> Vec<u8> {
    [cols.to_be_bytes(), rows.to_be_bytes()].concat()
}

pub fn decode_size(payload: &[u8]) -> Option<(u16, u16)> {
    if payload.len() != 4 {
        return None;
    }
    Some((
        u16::from_be_bytes([payload[0], payload[1]]),
        u16::from_be_bytes([payload[2], payload[3]]),
    ))
}
