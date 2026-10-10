# sshtty

A terminal in your browser, with groups and tabs, that keeps your shells running.

[![sshtty in action](https://raw.githubusercontent.com/NazmusSayad/sshtty/main/.github/assets/sshtty.gif)](https://github.com/NazmusSayad/sshtty/raw/main/.github/assets/sshtty.mp4)

▶️ [Watch the 1-minute video](https://github.com/NazmusSayad/sshtty/raw/main/.github/assets/sshtty.mp4)

## Quick start

```sh
npx sshtty
```

Then open [http://127.0.0.1:47831](http://127.0.0.1:47831).

Runs on macOS (Apple Silicon and Intel), Linux (x64 and arm64) and Windows (x64).

## Features

- **Groups and tabs.** A tab for every task, a group for every project. Give each group its own logo.
- **Shells that keep running.** Close the browser, reopen it, or restart the server: your terminals are still there, mid-command.
- **Images in the terminal.** Shows both sixel and iTerm2 inline images, on Windows too. Windows Terminal shows sixel but not iTerm2 images.
- **Paste images.** Paste an image and sshtty saves it to a file and types its path. Coding agents like Claude Code and OpenCode pick it up directly.
- **Built for coding agents.** Run Claude Code, OpenCode or any other terminal app, each in its own tab.
- **Themes and fonts.** 9 built-in themes (One Dark Extreme, Dracula, Tokyo Night, Catppuccin Mocha, Nord, Gruvbox Dark, Solarized Dark, GitHub Dark, Rosé Pine), custom colors, and bundled Nerd Fonts with ligatures.
- **Works on your phone.** The layout adapts to small screens.
- **The usual terminal comforts.** Search, clickable links, a large scrollback buffer and a settings page for shell, font, cursor and padding.

## Usage

```sh
sshtty [OPTIONS]
sshtty stop
```

| Option           | Default     | Description                                                                        |
| ---------------- | ----------- | ---------------------------------------------------------------------------------- |
| `--host <HOST>`  | `127.0.0.1` | Address to listen on                                                               |
| `--port <PORT>`  | `47831`     | Port to listen on                                                                  |
| `--config <DIR>` | `~/.sshtty` | Folder for settings, logs and the keeper; use another folder to run another sshtty |
| `--debug`        |             | Write detailed logs and serve them at `/api/debug/logs`                            |

`sshtty stop` stops sshtty and ends all its terminals.

> [!WARNING]
> sshtty has no login. Anyone who can reach its port gets a shell on your machine. Keep the default `127.0.0.1`, and only change `--host` on a network you trust.

## Development

Requires Node.js, pnpm and Rust.

```sh
pnpm install
pnpm dev
pnpm build
```

## Status

sshtty is in its early stages and actively maintained.

## License

[MIT](LICENSE)
