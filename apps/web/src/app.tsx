import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  Menu01Icon,
  PencilEdit02Icon,
  Settings01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  clientId,
  getState,
  mount,
  send,
  sendInput,
  subscribe,
  tabTitle,
  toggleCtrl,
} from '@/session'
import { SettingsDialog } from '@/settings-dialog'

type Prompt = {
  type: 'rename' | 'close'
  target: 'tab' | 'group'
  id: number
  name: string
}

const keys = [
  { label: 'Esc', sequence: '\x1b' },
  { label: 'Tab', sequence: '\t' },
  { label: '↑', sequence: '\x1b[A' },
  { label: '↓', sequence: '\x1b[B' },
  { label: '←', sequence: '\x1b[D' },
  { label: '→', sequence: '\x1b[C' },
]

export function App() {
  const state = useSyncExternalStore(subscribe, getState)
  const [drawer, setDrawer] = useState(false)
  const [settings, setSettings] = useState(false)
  const [prompt, setPrompt] = useState<Prompt | null>(null)
  const layout = state.layout
  const group = layout.groups.find((item) => item.id === layout.activeGroup)
  const tabId = group?.activeTab ?? null

  return (
    <div className="flex h-dvh text-sm">
      {drawer && (
        <div
          className="fixed inset-0 z-10 bg-black/50 md:hidden"
          onClick={() => setDrawer(false)}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-20 flex w-60 -translate-x-full flex-col gap-0.5 overflow-y-auto border-r bg-card p-2 transition-transform select-none motion-reduce:transition-none md:static md:w-12 md:translate-x-0 md:items-center md:px-0',
          drawer && 'translate-x-0'
        )}
      >
        {layout.groups.map((item) => (
          <ItemMenu
            key={item.id}
            closeLabel="Close group"
            onRename={() =>
              setPrompt({
                type: 'rename',
                target: 'group',
                id: item.id,
                name: item.name,
              })
            }
            onClose={() =>
              setPrompt({
                type: 'close',
                target: 'group',
                id: item.id,
                name: item.name,
              })
            }
          >
            <button
              className={cn(
                'flex h-8 flex-none items-center rounded-md px-2.5 text-[13px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground md:size-8 md:justify-center md:px-0 md:text-[11px] md:font-medium',
                item.id === layout.activeGroup && 'bg-accent text-foreground'
              )}
              title={item.name}
              onClick={() => {
                send({ type: 'select', groupId: item.id, tabId: null })
                setDrawer(false)
              }}
              onDoubleClick={() =>
                setPrompt({
                  type: 'rename',
                  target: 'group',
                  id: item.id,
                  name: item.name,
                })
              }
            >
              <span className="hidden md:inline">{initials(item.name)}</span>
              <span className="truncate md:hidden">{item.name}</span>
            </button>
          </ItemMenu>
        ))}
        <button
          className="text-muted-foreground hover:bg-accent hover:text-foreground flex h-8 flex-none items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors md:size-8 md:justify-center md:px-0"
          title="New group"
          onClick={() => {
            send({ type: 'createGroup' })
            setDrawer(false)
          }}
        >
          <HugeiconsIcon icon={Add01Icon} className="size-4" />
          <span className="md:hidden">New group</span>
        </button>
        <button
          className="text-muted-foreground hover:bg-accent hover:text-foreground mt-auto flex h-8 flex-none items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors md:size-8 md:justify-center md:px-0"
          title="Settings"
          onClick={() => {
            setSettings(true)
            setDrawer(false)
          }}
        >
          <HugeiconsIcon icon={Settings01Icon} className="size-4" />
          <span className="md:hidden">Settings</span>
        </button>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="bg-card flex h-8 flex-none border-b select-none">
          <button
            className="text-muted-foreground hover:text-foreground grid w-9 flex-none place-items-center md:hidden"
            aria-label="Groups"
            onClick={() => setDrawer(!drawer)}
          >
            <HugeiconsIcon icon={Menu01Icon} className="size-4" />
          </button>
          {group && (
            <>
              <div className="flex min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto">
                {group.tabs.map((tab) => (
                  <ItemMenu
                    key={tab.id}
                    closeLabel="Close tab"
                    onRename={() =>
                      setPrompt({
                        type: 'rename',
                        target: 'tab',
                        id: tab.id,
                        name: tab.customName ?? '',
                      })
                    }
                    onClose={() => send({ type: 'close', id: tab.id })}
                  >
                    <div
                      className={cn(
                        'group/tab relative flex min-w-28 flex-1 items-center justify-center border-r px-7 text-xs text-muted-foreground transition-colors last:border-r-0 hover:text-foreground',
                        tab.id === tabId && 'bg-background text-foreground'
                      )}
                      onClick={() =>
                        send({
                          type: 'select',
                          groupId: group.id,
                          tabId: tab.id,
                        })
                      }
                      onDoubleClick={() =>
                        setPrompt({
                          type: 'rename',
                          target: 'tab',
                          id: tab.id,
                          name: tab.customName ?? '',
                        })
                      }
                    >
                      <span className="truncate">{tabTitle(tab)}</span>
                      <button
                        className={cn(
                          'absolute left-1.5 grid size-4.5 place-items-center rounded text-muted-foreground opacity-0 transition-opacity group-hover/tab:opacity-100 hover:bg-accent hover:text-foreground',
                          tab.id === tabId && 'pointer-coarse:opacity-100'
                        )}
                        aria-label="Close tab"
                        onClick={(event) => {
                          event.stopPropagation()
                          send({ type: 'close', id: tab.id })
                        }}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-3" />
                      </button>
                    </div>
                  </ItemMenu>
                ))}
              </div>
              <button
                className="text-muted-foreground hover:text-foreground grid w-8 flex-none place-items-center border-l transition-colors"
                aria-label="New tab"
                title="New tab"
                onClick={() => send({ type: 'createTab', groupId: group.id })}
              >
                <HugeiconsIcon icon={Add01Icon} className="size-4" />
              </button>
            </>
          )}
        </header>
        <div className="relative min-h-0 flex-1">
          {tabId !== null && <TerminalPane key={tabId} id={tabId} />}
          {state.status === 'active' && !group && (
            <div className="absolute inset-0 grid place-items-center">
              <Button
                variant="outline"
                onClick={() => send({ type: 'createGroup' })}
              >
                New group
              </Button>
            </div>
          )}
          {group && group.tabs.length === 0 && (
            <div className="absolute inset-0 grid place-items-center">
              <Button
                variant="outline"
                onClick={() => send({ type: 'createTab', groupId: group.id })}
              >
                New terminal
              </Button>
            </div>
          )}
        </div>
        {tabId !== null && (
          <div className="bg-card hidden flex-none gap-1.5 overflow-x-auto border-t p-1.5 pointer-coarse:flex">
            {keys.map((key) => (
              <Button
                key={key.label}
                variant="secondary"
                className="min-w-11"
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => sendInput(tabId, key.sequence)}
              >
                {key.label}
              </Button>
            ))}
            <Button
              variant={state.ctrl ? 'default' : 'secondary'}
              className="min-w-11"
              onPointerDown={(event) => event.preventDefault()}
              onClick={toggleCtrl}
            >
              Ctrl
            </Button>
          </div>
        )}
      </main>
      {prompt?.type === 'rename' && (
        <RenameDialog
          key={prompt.id}
          prompt={prompt}
          onDone={() => setPrompt(null)}
        />
      )}
      <AlertDialog
        open={prompt?.type === 'close'}
        onOpenChange={(open) => {
          if (!open) setPrompt(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close “{prompt?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              All terminals in this group will be closed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                if (prompt) send({ type: 'close', id: prompt.id })
              }}
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {settings && <SettingsDialog onDone={() => setSettings(false)} />}
      {state.status !== 'active' && (
        <div className="bg-background/85 fixed inset-0 z-50 grid place-items-center backdrop-blur-xs">
          {state.status === 'paused' && (
            <div className="grid justify-items-center gap-3.5">
              <h2 className="font-semibold">Session paused</h2>
              <Button onClick={() => send({ type: 'resume', clientId })}>
                Resume here
              </Button>
            </div>
          )}
          {state.status === 'connecting' && (
            <p className="text-muted-foreground">Connecting…</p>
          )}
        </div>
      )}
    </div>
  )
}

function TerminalPane(props: { id: number }) {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!container.current) throw new Error('terminal container missing')
    return mount(props.id, container.current)
  }, [props.id])

  return (
    <div
      className="bg-background absolute inset-0 pt-(--pad-top) pr-(--pad-right) pb-(--pad-bottom) pl-(--pad-left)"
      ref={container}
    />
  )
}

function RenameDialog(props: { prompt: Prompt; onDone: () => void }) {
  const [name, setName] = useState(props.prompt.name)

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onDone()
      }}
    >
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = name.trim()
            if (props.prompt.target === 'tab' || trimmed)
              send({ type: 'rename', id: props.prompt.id, name: trimmed })
            props.onDone()
          }}
        >
          <DialogHeader>
            <DialogTitle>Rename {props.prompt.target}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Name"
            placeholder={
              props.prompt.target === 'tab' ? 'Use terminal title' : undefined
            }
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={props.onDone}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ItemMenu(props: {
  closeLabel: string
  onRename: () => void
  onClose: () => void
  children: ReactNode
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{props.children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onSelect={props.onRename}>
          <HugeiconsIcon icon={PencilEdit02Icon} />
          Rename
        </ContextMenuItem>
        <ContextMenuItem variant="destructive" onSelect={props.onClose}>
          <HugeiconsIcon icon={Delete02Icon} />
          {props.closeLabel}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}

function initials(name: string) {
  const words = name.trim().split(/\s+/)
  if (words.length > 1) return (words[0][0] + words[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}
