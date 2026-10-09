# ttysh

A terminal in your browser, with groups in a sidebar and tabs along the top. Your shells keep running even if the server crashes or restarts.

## Features

- Groups and tabs, saved on the server and the same on every device
- Native scrolling, no tmux
- Shells survive server crashes and restarts
- One active device at a time, with a "Resume here" prompt on the others
- Works on phones and tablets
- Settings for shell, font, cursor, padding, and colors, saved in `~/.ttysh/config.json`
- Runs on macOS, Linux, and Windows

## Install

```sh
npm install -g ttysh
```

## Usage

```sh
ttysh
```

Then open http://localhost:47831.

| Option          | Default     | Description          |
| --------------- | ----------- | -------------------- |
| `--host <HOST>` | `127.0.0.1` | Address to listen on |
| `--port <PORT>` | `47831`     | Port to listen on    |

> [!WARNING]
> ttysh has no authentication. With `--host 0.0.0.0`, anyone who can reach the port can use your shell. Only do that on networks you trust.

Data is stored in `~/.ttysh`.

## Development

```sh
pnpm install
pnpm dev
```

The web UI runs on Vite's dev server and proxies to the Rust server on port 47831.

## License

MIT
