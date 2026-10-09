# ttysh

A terminal in your browser, with groups in a sidebar and tabs along the top. Your shells keep running even if the server crashes or restarts.

## Features

- Groups and tabs, saved on the server and the same on every device
- Native scrolling, no tmux
- Shells survive server crashes and restarts
- One active device at a time, with a "Resume here" prompt on the others
- Works on phones and tablets
- Uses your Ghostty config for fonts, colors, padding, cursor, shell, and working directory
- Runs on macOS, Linux, and Windows

## Install

With npm:

```sh
npm install -g ttysh
```

Or download the binary for your platform from [GitHub Releases](https://github.com/NazmusSayad/ttysh/releases).

## Usage

```sh
ttysh
```

Then open http://localhost:47831.

> [!WARNING]
> ttysh listens on all network interfaces and has no authentication. Anyone who can reach port 47831 can use your shell. Only run it on networks you trust.

Data is stored in `~/.ttysh`.

## Development

```sh
pnpm install
pnpm dev
```

The web UI runs on Vite's dev server and proxies to the Rust server on port 47831.

## License

MIT
