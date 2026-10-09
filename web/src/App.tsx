import clsx from "clsx";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { clientId, getState, mount, send, sendInput, subscribe, toggleCtrl } from "./session";

const keys = [
  { label: "Esc", sequence: "\x1b" },
  { label: "Tab", sequence: "\t" },
  { label: "↑", sequence: "\x1b[A" },
  { label: "↓", sequence: "\x1b[B" },
  { label: "←", sequence: "\x1b[D" },
  { label: "→", sequence: "\x1b[C" },
];

export function App() {
  const state = useSyncExternalStore(subscribe, getState);
  const [drawer, setDrawer] = useState(false);
  const layout = state.layout;
  const group = layout.groups.find((item) => item.id === layout.activeGroup);
  const tabId = group?.activeTab ?? null;

  return (
    <div className="app">
      {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}
      <aside className={clsx("sidebar", drawer && "open")}>
        {layout.groups.map((item) => (
          <button
            key={item.id}
            className={clsx("group", item.id === layout.activeGroup && "selected")}
            title={item.name}
            onClick={() => {
              send({ type: "select", groupId: item.id, tabId: null });
              setDrawer(false);
            }}
            onDoubleClick={() => rename(item.id, item.name)}
          >
            <span className="initials">{initials(item.name)}</span>
            <span className="label">{item.name}</span>
          </button>
        ))}
        <button
          className="group add"
          title="New group"
          onClick={() => {
            send({ type: "createGroup" });
            setDrawer(false);
          }}
        >
          +
        </button>
      </aside>
      <main className="main">
        <header className="tabs">
          <button className="icon menu" aria-label="Groups" onClick={() => setDrawer(!drawer)}>
            ☰
          </button>
          {group && (
            <>
              <div className="tablist">
                {group.tabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={clsx("tab", tab.id === tabId && "selected")}
                    onClick={() => send({ type: "select", groupId: group.id, tabId: tab.id })}
                    onDoubleClick={() => rename(tab.id, tab.name)}
                  >
                    <span>{tab.name}</span>
                    <button
                      className="close"
                      aria-label="Close tab"
                      onClick={(event) => {
                        event.stopPropagation();
                        send({ type: "close", id: tab.id });
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button className="icon" aria-label="New tab" onClick={() => send({ type: "createTab", groupId: group.id })}>
                  +
                </button>
              </div>
              <button className="icon" title="Rename group" onClick={() => rename(group.id, group.name)}>
                ✎
              </button>
              <button
                className="icon"
                title="Close group"
                onClick={() => {
                  if (confirm(`Close "${group.name}" and all its terminals?`)) send({ type: "close", id: group.id });
                }}
              >
                ✕
              </button>
            </>
          )}
        </header>
        <div className="stage">
          {tabId !== null && <TerminalPane key={tabId} id={tabId} />}
          {state.status === "active" && !group && (
            <div className="empty">
              <button className="primary" onClick={() => send({ type: "createGroup" })}>
                New group
              </button>
            </div>
          )}
          {group && group.tabs.length === 0 && (
            <div className="empty">
              <button className="primary" onClick={() => send({ type: "createTab", groupId: group.id })}>
                New terminal
              </button>
            </div>
          )}
        </div>
        {tabId !== null && (
          <div className="keys">
            {keys.map((key) => (
              <button key={key.label} onPointerDown={(event) => event.preventDefault()} onClick={() => sendInput(tabId, key.sequence)}>
                {key.label}
              </button>
            ))}
            <button className={clsx(state.ctrl && "selected")} onPointerDown={(event) => event.preventDefault()} onClick={toggleCtrl}>
              Ctrl
            </button>
          </div>
        )}
      </main>
      {state.status === "paused" && (
        <div className="overlay">
          <div className="notice">
            <h2>Session paused</h2>
            <button className="primary" onClick={() => send({ type: "resume", clientId })}>
              Resume here
            </button>
          </div>
        </div>
      )}
      {state.status === "connecting" && (
        <div className="overlay">
          <div className="notice">
            <p>Connecting…</p>
          </div>
        </div>
      )}
    </div>
  );
}

function TerminalPane(props: { id: number }) {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) throw new Error("terminal container missing");
    return mount(props.id, container.current);
  }, [props.id]);

  return <div className="pane" ref={container} />;
}

function rename(id: number, current: string) {
  const name = prompt("Name", current)?.trim();
  if (name) send({ type: "rename", id, name });
}

function initials(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}
